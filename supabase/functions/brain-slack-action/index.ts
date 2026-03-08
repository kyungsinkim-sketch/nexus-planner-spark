/**
 * brain-slack-action — Analyze a Slack message and create TODO/Calendar/Important note.
 *
 * Called when user clicks 🧠 Brain AI on a specific Slack message.
 * Uses Claude to extract structured data, then creates the item.
 *
 * Request: { userId, channelId, channelName, messageText, messageTs, senderName, actionType }
 * actionType: 'todo' | 'calendar' | 'important'
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateOrFallback } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Simple Claude API call
async function callClaude(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || body.userId;
    const { channelId, channelName, messageText, messageTs, senderName, actionType } = body;

    if (!userId || !messageText || !actionType) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const context = `Slack 채널: #${channelName || channelId}\n보낸 사람: ${senderName}\n메시지: "${messageText}"`;

    if (actionType === 'todo') {
      // Use Claude to extract a clean TODO title and description
      const systemPrompt = `You are a task extraction assistant. Given a Slack message, extract a clear TODO item. Respond in JSON only: {"title": "...", "description": "..."}. Title should be concise (under 50 chars). Description includes context. Always respond in Korean.`;
      const raw = await callClaude(context, systemPrompt);

      let title = messageText.slice(0, 50);
      let description = `Slack #${channelName} — ${senderName}`;
      try {
        const parsed = JSON.parse(raw);
        title = parsed.title || title;
        description = parsed.description || description;
      } catch { /* use defaults */ }

      // Create personal_todo
      const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
      const { error: todoErr } = await supabase
        .from('personal_todos')
        .insert({
          title: `${title} — ${description}`,
          requested_by_id: userId,
          assignee_ids: [userId],
          status: 'PENDING',
          priority: 'NORMAL',
          due_date: tomorrow,
        });

      if (todoErr) return jsonResponse({ error: todoErr.message }, 500);
      return jsonResponse({ success: true, type: 'todo', title });
    }

    if (actionType === 'calendar') {
      // Use Claude to extract date/time
      const systemPrompt = `You are a calendar event extraction assistant. Given a Slack message, extract an event. Today is ${todayStr}. Respond in JSON only: {"title": "...", "date": "YYYY-MM-DD", "startHour": 9, "endHour": 10, "description": "..."}. If no specific date mentioned, use tomorrow. Always respond in Korean.`;
      const raw = await callClaude(context, systemPrompt);

      let title = messageText.slice(0, 50);
      let date = new Date(now.getTime() + 86400000).toISOString().split('T')[0]; // tomorrow
      let startHour = 9;
      let endHour = 10;
      let description = `Slack #${channelName} — ${senderName}`;
      try {
        const parsed = JSON.parse(raw);
        title = parsed.title || title;
        date = parsed.date || date;
        startHour = parsed.startHour ?? startHour;
        endHour = parsed.endHour ?? endHour;
        description = parsed.description || description;
      } catch { /* use defaults */ }

      const startAt = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+09:00`);
      const endAt = new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00+09:00`);

      // Create calendar event
      const { error: calErr } = await supabase
        .from('calendar_events')
        .insert({
          title: `${title} — ${description}`,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          owner_id: userId,
          attendee_ids: [userId],
          type: 'MEETING',
          source: 'PAULUS',
        });

      if (calErr) return jsonResponse({ error: calErr.message }, 500);
      return jsonResponse({ success: true, type: 'calendar', title, date });
    }

    if (actionType === 'important') {
      // Use Claude to create a structured important note
      const systemPrompt = `You are a note-taking assistant. Given a Slack message, create a concise important note. Respond in JSON only: {"title": "...", "content": "..."}. Title should be concise. Content should capture the key information. Always respond in Korean.`;
      const raw = await callClaude(context, systemPrompt);

      let title = messageText.slice(0, 50);
      let content = `${senderName} (Slack #${channelName}): ${messageText}`;
      try {
        const parsed = JSON.parse(raw);
        title = parsed.title || title;
        content = parsed.content || content;
      } catch { /* use defaults */ }

      // Create important note (knowledge_items)
      const { error: noteErr } = await supabase
        .from('knowledge_items')
        .insert({
          user_id: userId,
          content: `[${title}] ${content}`,
          summary: title,
          knowledge_type: 'decision_pattern',
          source_type: 'brain_action',
          source_id: `${channelId}:${messageTs}`,
          source_context: `Slack #${channelName} — ${senderName}`,
          scope_layer: 'operations',
          scope: 'personal',
          is_active: true,
          confidence: 1.0,
        });

      if (noteErr) return jsonResponse({ error: noteErr.message }, 500);
      return jsonResponse({ success: true, type: 'important', title });
    }

    return jsonResponse({ error: `Unknown action type: ${actionType}` }, 400);
  } catch (err) {
    console.error('[brain-slack-action] Error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
