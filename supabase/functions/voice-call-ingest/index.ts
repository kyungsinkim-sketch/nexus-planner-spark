/**
 * voice-call-ingest — Auto-seed RAG knowledge_items from meeting analysis.
 *
 * Called after voice-brain-analyze completes.
 * Extracts decisions, key quotes, action items → knowledge_items with Voyage embeddings.
 *
 * Pipeline:
 * 1. Receive analysis + transcript from voice-brain-analyze
 * 2. Build knowledge items from decisions, quotes, summary
 * 3. Embed with Voyage AI (voyage-3-lite, 512-dim)
 * 4. Insert into knowledge_items with embedding_v2
 * 5. Update voice_recordings.rag_ingested = true
 *
 * Data Sovereignty: Voyage AI does NOT retain or train on API data.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-lite';

// ─── Types ───────────────────────────────────────────

interface Decision {
  content: string;
  decidedBy?: string;
  confidence?: number;
}

interface KeyQuote {
  speaker: string;
  text: string;
  timestamp?: number;
  importance?: 'budget_constraint' | 'deadline' | 'risk' | 'decision';
}

interface ActionItem {
  title: string;
  assigneeNames?: string[];
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  projectId?: string;
}

interface Followup {
  content: string;
  remindDate?: string;
}

interface Analysis {
  summary?: string;
  decisions?: Decision[];
  keyQuotes?: KeyQuote[];
  actionItems?: ActionItem[];
  followups?: Followup[];
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface KnowledgeItem {
  content: string;
  summary: string;
  knowledge_type: string;
  source_type: string;
  source_id: string;
  source_context: string;
  role_tag: string | null;
  scope: string;
  scope_layer: string;
  confidence: number;
  dialectic_tag: string | null;
}

// ─── Knowledge Extraction ────────────────────────────

function extractKnowledgeItems(
  analysis: Analysis,
  recordingId: string,
  recordingTitle: string,
  recordingDate: string,
  speakers: string[],
): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  const speakerList = speakers.join(', ');
  const dateStr = recordingDate.split('T')[0];

  // 1. Decisions → decision_pattern
  if (analysis.decisions?.length) {
    for (const d of analysis.decisions) {
      items.push({
        content: `[미팅 결정] ${d.content}\n- 결정자: ${d.decidedBy || '미확인'}\n- 미팅: ${recordingTitle}\n- 일시: ${dateStr}\n- 참석자: ${speakerList}`,
        summary: `미팅 결정: ${d.content.slice(0, 80)}`,
        knowledge_type: 'decision_pattern',
        source_type: 'voice_recording',
        source_id: recordingId,
        source_context: `${recordingTitle} (${dateStr})`,
        role_tag: null,
        scope: 'global',
        scope_layer: 'operations',
        confidence: d.confidence || 0.85,
        dialectic_tag: 'opportunity',
      });
    }
  }

  // 2. Key Quotes → mapped by importance
  if (analysis.keyQuotes?.length) {
    for (const q of analysis.keyQuotes) {
      const typeMap: Record<string, { kt: string; dt: string | null }> = {
        budget_constraint: { kt: 'budget_judgment', dt: 'constraint' },
        risk: { kt: 'recurring_risk', dt: 'risk' },
        decision: { kt: 'decision_pattern', dt: 'opportunity' },
        deadline: { kt: 'schedule_change', dt: 'constraint' },
      };
      const mapping = typeMap[q.importance || 'decision'] || typeMap.decision;

      items.push({
        content: `[미팅 발언] "${q.text}"\n- 발언자: ${q.speaker}\n- 미팅: ${recordingTitle}\n- 일시: ${dateStr}`,
        summary: `${q.speaker}: ${q.text.slice(0, 80)}`,
        knowledge_type: mapping.kt,
        source_type: 'voice_recording',
        source_id: recordingId,
        source_context: `${recordingTitle} (${dateStr})`,
        role_tag: null,
        scope: 'global',
        scope_layer: 'operations',
        confidence: 0.85,
        dialectic_tag: mapping.dt,
      });
    }
  }

  // 3. High-priority action items → recurring_risk
  if (analysis.actionItems?.length) {
    const highPriority = analysis.actionItems.filter(a => a.priority === 'HIGH');
    for (const a of highPriority) {
      items.push({
        content: `[긴급 액션] ${a.title}\n- 담당: ${a.assigneeNames?.join(', ') || '미배정'}\n- 기한: ${a.dueDate || '미정'}\n- 미팅: ${recordingTitle} (${dateStr})`,
        summary: `긴급 액션: ${a.title.slice(0, 80)}`,
        knowledge_type: 'recurring_risk',
        source_type: 'voice_recording',
        source_id: recordingId,
        source_context: `${recordingTitle} (${dateStr})`,
        role_tag: null,
        scope: 'global',
        scope_layer: 'execution',
        confidence: 0.85,
        dialectic_tag: 'constraint',
      });
    }
  }

  // 4. Summary → context (always, one per recording)
  if (analysis.summary) {
    items.push({
      content: `[미팅 요약] ${analysis.summary}\n- 미팅: ${recordingTitle}\n- 일시: ${dateStr}\n- 참석자: ${speakerList}`,
      summary: `미팅 요약: ${recordingTitle} (${dateStr})`,
      knowledge_type: 'context',
      source_type: 'voice_recording',
      source_id: recordingId,
      source_context: `${recordingTitle} (${dateStr})`,
      role_tag: null,
      scope: 'global',
      scope_layer: 'operations',
      confidence: 0.80,
      dialectic_tag: null,
    });
  }

  return items;
}

// ─── Voyage Embedding ────────────────────────────────

async function getVoyageEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 5;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    if (i > 0) {
      await new Promise(r => setTimeout(r, 2000)); // rate limit buffer
    }

    const resp = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
      }),
    });

    if (resp.status === 429) {
      // Rate limited — wait and retry once
      console.warn('[voice-call-ingest] Rate limited, waiting 30s...');
      await new Promise(r => setTimeout(r, 30000));
      const retry = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: batch, model: VOYAGE_MODEL }),
      });
      if (!retry.ok) {
        throw new Error(`Voyage API retry failed: ${retry.status}`);
      }
      const retryData = await retry.json();
      for (const item of retryData.data) {
        embeddings.push(item.embedding);
      }
      continue;
    }

    if (!resp.ok) {
      throw new Error(`Voyage API error: ${resp.status} - ${await resp.text()}`);
    }

    const data = await resp.json();
    for (const item of data.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, recordingId, analysis, transcript } = await req.json();

    if (!userId || !recordingId || !analysis) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, recordingId, analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const voyageKey = Deno.env.get('VOYAGE_API_KEY');
    if (!voyageKey) {
      return new Response(
        JSON.stringify({ error: 'VOYAGE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get recording metadata
    const { data: recording } = await supabase
      .from('voice_recordings')
      .select('title, created_at')
      .eq('id', recordingId)
      .single();

    const recordingTitle = recording?.title || 'Untitled Meeting';
    const recordingDate = recording?.created_at || new Date().toISOString();

    // Extract unique speakers from transcript
    const speakers = [...new Set(
      ((transcript as TranscriptSegment[]) || []).map(s => s.speaker)
    )];

    // Build knowledge items
    const knowledgeItems = extractKnowledgeItems(
      analysis as Analysis,
      recordingId,
      recordingTitle,
      recordingDate,
      speakers,
    );

    if (knowledgeItems.length === 0) {
      console.log('[voice-call-ingest] No knowledge items to ingest');
      return new Response(
        JSON.stringify({ ingested: 0, message: 'No extractable knowledge' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[voice-call-ingest] Extracting ${knowledgeItems.length} knowledge items`);

    // Get Voyage embeddings
    const texts = knowledgeItems.map(item => item.content);
    const embeddings = await getVoyageEmbeddings(texts, voyageKey);

    // Insert into knowledge_items
    const insertedIds: string[] = [];
    for (let i = 0; i < knowledgeItems.length; i++) {
      const item = knowledgeItems[i];
      const { data, error } = await supabase
        .from('knowledge_items')
        .insert({
          user_id: userId,
          scope: item.scope,
          content: item.content,
          summary: item.summary,
          knowledge_type: item.knowledge_type,
          source_type: item.source_type,
          source_id: item.source_id,
          source_context: item.source_context,
          role_tag: item.role_tag,
          scope_layer: item.scope_layer,
          confidence: item.confidence,
          dialectic_tag: item.dialectic_tag,
          embedding_v2: JSON.stringify(embeddings[i]),
          embedding_model: 'voyage-3-lite',
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[voice-call-ingest] Insert error for item ${i}:`, error.message);
      } else if (data) {
        insertedIds.push(data.id);
      }
    }

    // Update voice_recordings with ingestion status
    // Note: rag_ingested and knowledge_item_ids columns may not exist yet
    try {
      await supabase
        .from('voice_recordings')
        .update({
          rag_ingested: true,
          knowledge_item_ids: insertedIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordingId);
    } catch {
      // Columns might not exist yet — that's OK for v1
      console.warn('[voice-call-ingest] Could not update rag_ingested (column may not exist yet)');
    }

    console.log(`[voice-call-ingest] Ingested ${insertedIds.length}/${knowledgeItems.length} items`);

    return new Response(
      JSON.stringify({
        ingested: insertedIds.length,
        total: knowledgeItems.length,
        knowledgeItemIds: insertedIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[voice-call-ingest] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
