// Brain Digest Edge Function
// Batch processes chat messages to extract decisions, action items, risks, and summaries.
//
// Flow:
//   1. Query brain_processing_queue for rooms with pending_count >= threshold
//   2. Fetch unprocessed messages from chat_messages
//   3. Call Claude Haiku via llm-digest.ts for conversation analysis
//   4. Store results in chat_digests table
//   5. Reset queue counters and set cooldown
//   6. Log activity for transparency
//
// Trigger: Supabase pg_cron (5min interval) or client-side manual trigger

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { analyzeConversation } from '../_shared/llm-digest.ts';
import type { DigestRequest } from '../_shared/brain-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_MESSAGE_THRESHOLD = 15;
const COOLDOWN_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse optional request body
    let body: DigestRequest = {};
    try {
      body = await req.json();
    } catch {
      // No body — process all eligible rooms
    }

    const threshold = body.messageThreshold || DEFAULT_MESSAGE_THRESHOLD;

    // Create Supabase service client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find rooms ready for processing
    let query = supabase
      .from('brain_processing_queue')
      .select('*')
      .gte('pending_message_count', threshold)
      .eq('status', 'idle');

    if (body.roomId) {
      query = query.eq('room_id', body.roomId);
    }

    const { data: queueItems, error: queueError } = await query;

    if (queueError) {
      throw new Error(`Failed to query processing queue: ${queueError.message}`);
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No rooms ready for processing', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results = [];

    for (const queueItem of queueItems) {
      try {
        // 2. Mark as processing
        await supabase
          .from('brain_processing_queue')
          .update({ status: 'processing' })
          .eq('id', queueItem.id);

        // 3. Fetch messages since last processing
        let messageQuery = supabase
          .from('chat_messages')
          .select('id, user_id, content, created_at')
          .eq('room_id', queueItem.room_id)
          .neq('user_id', '00000000-0000-0000-0000-000000000099') // Exclude bot
          .order('created_at', { ascending: true });

        if (queueItem.last_processed_at) {
          messageQuery = messageQuery.gt('created_at', queueItem.last_processed_at);
        }

        const { data: messages, error: msgError } = await messageQuery.limit(100);

        if (msgError || !messages || messages.length === 0) {
          // Reset and skip
          await supabase
            .from('brain_processing_queue')
            .update({ status: 'idle', pending_message_count: 0 })
            .eq('id', queueItem.id);
          continue;
        }

        // 4. Get project info and team members for context
        let projectTitle: string | undefined;
        let teamMembers: { id: string; name: string }[] = [];

        if (queueItem.project_id) {
          const { data: project } = await supabase
            .from('projects')
            .select('title, team_member_ids')
            .eq('id', queueItem.project_id)
            .single();

          if (project) {
            projectTitle = project.title;
            const memberIds = (project.team_member_ids || []) as string[];
            if (memberIds.length > 0) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, name')
                .in('id', memberIds);
              teamMembers = (profiles || []).map((p: { id: string; name: string }) => ({
                id: p.id,
                name: p.name,
              }));
            }
          }
        }

        // Build user name lookup
        const userIds = [...new Set(messages.map((m: { user_id: string }) => m.user_id))];
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        const userMap = new Map((userProfiles || []).map((p: { id: string; name: string }) => [p.id, p.name]));

        // Format messages for LLM
        const formattedMessages = messages.map((m: { user_id: string; content: string; created_at: string }) => ({
          userId: m.user_id,
          userName: userMap.get(m.user_id) || 'Unknown',
          content: m.content,
          createdAt: m.created_at,
        }));

        // 5. Call Claude Haiku for analysis
        const digestResult = await analyzeConversation(
          formattedMessages,
          apiKey,
          projectTitle,
          teamMembers,
        );

        const messageRangeStart = messages[0].created_at;
        const messageRangeEnd = messages[messages.length - 1].created_at;

        // 6. Store results in chat_digests
        const digestInserts = [];

        if (digestResult.decisions.length > 0) {
          digestInserts.push({
            room_id: queueItem.room_id,
            project_id: queueItem.project_id,
            digest_type: 'decisions',
            content: { items: digestResult.decisions },
            message_range_start: messageRangeStart,
            message_range_end: messageRangeEnd,
            message_count: messages.length,
            model_used: 'claude-haiku-4-5-20251001',
            confidence: digestResult.decisions.reduce((sum: number, d: { confidence: number }) => sum + d.confidence, 0) / digestResult.decisions.length,
          });
        }

        if (digestResult.actionItems.length > 0) {
          digestInserts.push({
            room_id: queueItem.room_id,
            project_id: queueItem.project_id,
            digest_type: 'action_items',
            content: { items: digestResult.actionItems },
            message_range_start: messageRangeStart,
            message_range_end: messageRangeEnd,
            message_count: messages.length,
            model_used: 'claude-haiku-4-5-20251001',
            confidence: digestResult.actionItems.reduce((sum: number, a: { confidence: number }) => sum + a.confidence, 0) / digestResult.actionItems.length,
          });
        }

        if (digestResult.risks.length > 0) {
          digestInserts.push({
            room_id: queueItem.room_id,
            project_id: queueItem.project_id,
            digest_type: 'risks',
            content: { items: digestResult.risks },
            message_range_start: messageRangeStart,
            message_range_end: messageRangeEnd,
            message_count: messages.length,
            model_used: 'claude-haiku-4-5-20251001',
            confidence: digestResult.risks.reduce((sum: number, r: { confidence: number }) => sum + r.confidence, 0) / digestResult.risks.length,
          });
        }

        if (digestResult.summary) {
          digestInserts.push({
            room_id: queueItem.room_id,
            project_id: queueItem.project_id,
            digest_type: 'summary',
            content: { items: [], summary: digestResult.summary },
            message_range_start: messageRangeStart,
            message_range_end: messageRangeEnd,
            message_count: messages.length,
            model_used: 'claude-haiku-4-5-20251001',
            confidence: 0.8,
          });
        }

        if (digestInserts.length > 0) {
          await supabase.from('chat_digests').insert(digestInserts);
        }

        // 7. Update queue — reset counter, set cooldown
        const cooldownUntil = new Date();
        cooldownUntil.setMinutes(cooldownUntil.getMinutes() + COOLDOWN_MINUTES);

        await supabase
          .from('brain_processing_queue')
          .update({
            status: 'idle',
            pending_message_count: 0,
            last_processed_at: new Date().toISOString(),
            cooldown_until: cooldownUntil.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);

        // 8. Log activity
        await supabase.from('brain_activity_log').insert({
          activity_type: 'digest_created',
          room_id: queueItem.room_id,
          project_id: queueItem.project_id,
          details: {
            messageCount: messages.length,
            digestCount: digestInserts.length,
            processingTimeMs: Date.now() - startTime,
            decisions: digestResult.decisions.length,
            actionItems: digestResult.actionItems.length,
            risks: digestResult.risks.length,
          },
        });

        results.push({
          roomId: queueItem.room_id,
          messageCount: messages.length,
          digestCount: digestInserts.length,
        });
      } catch (roomError) {
        console.error(`Failed to process room ${queueItem.room_id}:`, roomError);

        // Reset queue status on error
        await supabase
          .from('brain_processing_queue')
          .update({ status: 'idle' })
          .eq('id', queueItem.id);

        // Log error
        await supabase.from('brain_activity_log').insert({
          activity_type: 'error',
          room_id: queueItem.room_id,
          project_id: queueItem.project_id,
          details: {
            error: roomError instanceof Error ? roomError.message : 'Unknown error',
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('brain-digest error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
