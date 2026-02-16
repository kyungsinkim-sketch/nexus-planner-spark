// Brain Context Edge Function
// Generates project intelligence panel data by aggregating recent chat_digests.
// Caches results in project_context_snapshots with 1-hour TTL.
//
// Flow:
//   1. Check project_context_snapshots for valid cache
//   2. If cached and not expired, return cached data
//   3. If cache miss, aggregate recent chat_digests for the project
//   4. Upsert into project_context_snapshots
//   5. Return snapshot data

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { ContextRequest, ProjectInsightsData, DigestItem } from '../_shared/brain-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ContextRequest = await req.json();
    const { projectId, forceRefresh } = body;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: projectId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create Supabase service client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check cache (unless force refresh)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('project_context_snapshots')
        .select('*')
        .eq('project_id', projectId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached) {
        return new Response(
          JSON.stringify({
            success: true,
            snapshot: cached.snapshot_data,
            cached: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // 2. Aggregate recent digests (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: digests, error: digestError } = await supabase
      .from('chat_digests')
      .select('*')
      .eq('project_id', projectId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (digestError) {
      throw new Error(`Failed to fetch digests: ${digestError.message}`);
    }

    // 3. Aggregate by type
    const recentDecisions: DigestItem[] = [];
    const openActionItems: DigestItem[] = [];
    const identifiedRisks: DigestItem[] = [];
    let conversationSummary = '';
    let totalMessageCount = 0;
    let lastAnalyzedAt = '';

    for (const digest of (digests || [])) {
      const content = digest.content as { items?: DigestItem[]; summary?: string };
      totalMessageCount += digest.message_count || 0;

      if (!lastAnalyzedAt || digest.created_at > lastAnalyzedAt) {
        lastAnalyzedAt = digest.created_at;
      }

      switch (digest.digest_type) {
        case 'decisions':
          if (content.items) {
            recentDecisions.push(...content.items.slice(0, 5)); // Top 5
          }
          break;
        case 'action_items':
          if (content.items) {
            openActionItems.push(...content.items.slice(0, 5));
          }
          break;
        case 'risks':
          if (content.items) {
            identifiedRisks.push(...content.items.slice(0, 3));
          }
          break;
        case 'summary':
          if (content.summary && !conversationSummary) {
            conversationSummary = content.summary; // Use most recent summary
          }
          break;
      }
    }

    // Determine activity level
    let activityLevel: 'low' | 'medium' | 'high' = 'low';
    if (totalMessageCount > 50) activityLevel = 'high';
    else if (totalMessageCount > 20) activityLevel = 'medium';

    const snapshot: ProjectInsightsData = {
      recentDecisions: recentDecisions.slice(0, 5),
      openActionItems: openActionItems.slice(0, 5),
      identifiedRisks: identifiedRisks.slice(0, 3),
      conversationSummary: conversationSummary || '최근 7일간 분석된 대화가 없습니다.',
      activityLevel,
      lastAnalyzedAt: lastAnalyzedAt || new Date().toISOString(),
      messageCount: totalMessageCount,
    };

    // 4. Cache the snapshot (1-hour TTL)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await supabase
      .from('project_context_snapshots')
      .upsert({
        project_id: projectId,
        snapshot_data: snapshot,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'project_id' });

    // 5. Log activity
    await supabase.from('brain_activity_log').insert({
      activity_type: 'context_generated',
      project_id: projectId,
      details: {
        digestCount: (digests || []).length,
        decisions: recentDecisions.length,
        actionItems: openActionItems.length,
        risks: identifiedRisks.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        snapshot,
        cached: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('brain-context error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
