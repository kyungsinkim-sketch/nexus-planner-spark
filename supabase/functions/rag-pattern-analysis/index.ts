/**
 * rag-pattern-analysis — Personal decision pattern extraction.
 *
 * Analyzes a user's recent knowledge_items and extracts higher-level
 * decision patterns (conservative/bold/collaborative etc.) per domain.
 * Results are stored in user_decision_patterns table.
 *
 * Actions:
 *   - analyze: Analyze recent knowledge for a user and extract patterns
 *   - getPatterns: Get existing patterns for a user
 *
 * Request body: { action: string, ...params }
 * Authentication: JWT token in Authorization header (userId extracted from token)
 */

import { authenticateRequest } from '../_shared/auth.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // JWT Authentication — userId comes from verified token
    const { user, supabase } = await authenticateRequest(req);
    const userId = user.id;

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ─── Analyze & extract patterns ────────────────
      case 'analyze': {
        const limit = body.limit || 20;

        // 1. Check rate limit: max once per 24h per user
        const { data: existingPatterns } = await supabase
          .from('user_decision_patterns')
          .select('updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (existingPatterns && existingPatterns.length > 0) {
          const lastUpdate = new Date(existingPatterns[0].updated_at);
          const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceUpdate < 24) {
            return jsonResponse({
              success: true,
              skipped: true,
              message: `Last analysis was ${Math.round(hoursSinceUpdate)}h ago. Next analysis in ${Math.round(24 - hoursSinceUpdate)}h.`,
            });
          }
        }

        // 2. Fetch recent knowledge items for this user
        const { data: knowledgeItems, error: fetchError } = await supabase
          .from('knowledge_items')
          .select('id, content, knowledge_type, scope, confidence, source_type, created_at')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fetchError) {
          return jsonResponse({ error: fetchError.message }, 500);
        }

        if (!knowledgeItems || knowledgeItems.length < 5) {
          return jsonResponse({
            success: true,
            skipped: true,
            message: `Not enough knowledge items (${knowledgeItems?.length || 0}/5 minimum).`,
          });
        }

        // 3. Call Claude to analyze patterns
        const knowledgeText = knowledgeItems.map((item, i) =>
          `[${i + 1}] (${item.knowledge_type}) ${item.content}`
        ).join('\n');

        const systemPrompt = `You are analyzing a Korean creative production professional's decision patterns.
Based on their accumulated knowledge items, identify their decision-making tendencies.

Output a JSON array. Each item:
{
  "knowledge_domain": "budget|creative|risk|schedule|stakeholder",
  "pattern_type": "string (e.g., conservative, bold, risk_averse, collaborative, detail_oriented, deadline_flexible, cost_conscious)",
  "pattern_summary": "Korean description of the pattern (2-3 sentences)",
  "confidence": 0.0-1.0,
  "evidence_indices": [1, 3, 7]  // indices of knowledge items that support this pattern
}

Rules:
- Identify patterns, NOT individual events
- Max 5 patterns total
- Confidence reflects how consistent the pattern is across evidence
- pattern_summary should be practical and actionable (e.g., "예산 변경 시 항상 전체 팀 합의를 거치는 경향")
- Return [] if no clear patterns emerge
- Always respond with valid JSON array only`;

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20250514',
            max_tokens: 2000,
            system: systemPrompt,
            messages: [
              { role: 'user', content: `다음 ${knowledgeItems.length}개의 지식 항목을 분석해주세요:\n\n${knowledgeText}` },
            ],
          }),
        });

        if (!claudeResponse.ok) {
          const errText = await claudeResponse.text();
          console.error('Claude API error:', errText);
          return jsonResponse({ error: 'LLM analysis failed' }, 500);
        }

        const claudeData = await claudeResponse.json();
        const responseText = claudeData.content?.[0]?.text || '[]';

        // Parse the JSON array from Claude's response
        let patterns: Array<{
          knowledge_domain: string;
          pattern_type: string;
          pattern_summary: string;
          confidence: number;
          evidence_indices: number[];
        }>;

        try {
          // Try to extract JSON from response (handle markdown code blocks)
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          patterns = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
          console.warn('Failed to parse patterns JSON:', responseText.slice(0, 200));
          patterns = [];
        }

        // 4. Upsert patterns into user_decision_patterns
        let upserted = 0;
        for (const pattern of patterns) {
          const evidenceIds = (pattern.evidence_indices || [])
            .filter((idx: number) => idx >= 1 && idx <= knowledgeItems.length)
            .map((idx: number) => knowledgeItems[idx - 1].id);

          const { error: upsertError } = await supabase
            .from('user_decision_patterns')
            .upsert(
              {
                user_id: userId,
                knowledge_domain: pattern.knowledge_domain,
                pattern_type: pattern.pattern_type,
                pattern_summary: pattern.pattern_summary,
                evidence_item_ids: evidenceIds,
                confidence: Math.max(0, Math.min(1, pattern.confidence || 0.5)),
                sample_count: knowledgeItems.length,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,knowledge_domain' },
            );

          if (!upsertError) upserted++;
        }

        return jsonResponse({
          success: true,
          patternsFound: patterns.length,
          upserted,
          analyzedItems: knowledgeItems.length,
        });
      }

      // ─── Get existing patterns ─────────────────────
      case 'getPatterns': {
        const { data, error } = await supabase
          .from('user_decision_patterns')
          .select('*')
          .eq('user_id', userId)
          .order('confidence', { ascending: false });

        if (error) {
          return jsonResponse({ error: error.message }, 500);
        }

        return jsonResponse({ patterns: data || [] });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    if (err instanceof Response) return err; // Auth error
    console.error('[rag-pattern-analysis] Error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
