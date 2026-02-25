# Smart Call Architecture v1

> "미팅 녹음만 해도 업무가 자동으로 정리된다"

## 현재 상태 (Already Built)

```
[Audio Upload] → voice-transcribe (Google STT, 화자분리)
                    → voice-brain-analyze (Claude Haiku)
                        → { summary, decisions, events, todos, quotes }
```

**Missing**: 분석 결과가 DB에만 저장되고, RAG에 시딩되지 않음. 화자 식별 없음.

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Smart Call Pipeline                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 Input Sources                                            │
│  ├─ Phone call recording (mobile)                           │
│  ├─ Offline meeting recording (mobile mic)                  │
│  ├─ Online meeting capture (desktop: Teams/Zoom/Meet)       │
│  └─ Manual audio upload (web)                               │
│                                                              │
│  🔄 Processing Pipeline                                      │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Upload   │──▶│  Transcribe  │──▶│  Brain Analyze   │    │
│  │  (Storage)│   │  (Google STT)│   │  (Claude Haiku)  │    │
│  └──────────┘   │  + Diarize   │   │  + RAG Context   │    │
│                  └──────────────┘   └────────┬─────────┘    │
│                                              │               │
│                        ┌─────────────────────┼───────┐      │
│                        ▼                     ▼       ▼      │
│              ┌──────────────┐  ┌─────────┐  ┌──────────┐   │
│              │ RAG Ingest   │  │ Calendar│  │   Todo   │   │
│              │ (knowledge   │  │ Events  │  │  Items   │   │
│              │  _items)     │  │ (gcal)  │  │          │   │
│              └──────────────┘  └─────────┘  └──────────┘   │
│                                                              │
│  🎤 Voice Fingerprint (Phase 2)                              │
│  ├─ voiceprint hash (256-dim) stored locally                │
│  ├─ speaker_profiles table                                  │
│  └─ retroactive speaker ID when users join                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: voice-call-ingest (New Edge Function)

### Purpose
분석 완료된 voice_recording의 결과를 RAG knowledge_items로 자동 시딩.

### Trigger
`voice-brain-analyze` 완료 후 자동 호출 (status = 'completed')

### Knowledge Extraction Rules

| Brain Analysis Field | → knowledge_type | confidence | dialectic_tag |
|---------------------|-------------------|------------|---------------|
| decisions[] | decision_pattern | decision.confidence | opportunity |
| actionItems[] (HIGH) | recurring_risk | 0.85 | constraint |
| actionItems[] (MEDIUM/LOW) | workflow | 0.75 | NULL |
| keyQuotes[] (budget) | budget_judgment | 0.90 | constraint |
| keyQuotes[] (risk) | recurring_risk | 0.85 | risk |
| keyQuotes[] (decision) | decision_pattern | 0.85 | opportunity |
| followups[] | schedule_change | 0.70 | NULL |
| summary | context | 0.80 | NULL |

### Content Template
```
[미팅 결정] {decision.content}
- 결정자: {decision.decidedBy}
- 미팅: {recording.title}
- 일시: {recording.created_at}
- 참석자: {speakers from transcript}
```

### Embedding
- Voyage AI voyage-3-lite (512-dim) → embedding_v2
- source_type: 'voice_recording'
- source_id: recording.id

## Phase 2: voice_recordings Schema Extension

```sql
ALTER TABLE voice_recordings
  ADD COLUMN IF NOT EXISTS recording_type TEXT DEFAULT 'manual'
    CHECK (recording_type IN ('phone_call', 'offline_meeting', 'online_meeting', 'manual')),
  ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS rag_ingested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS knowledge_item_ids UUID[] DEFAULT '{}';
```

## Phase 3: speaker_profiles Table

```sql
CREATE TABLE IF NOT EXISTS speaker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID,
  display_name TEXT NOT NULL,
  -- Voice fingerprint (local-only, not stored on server in v1)
  -- voiceprint_hash TEXT,  -- Phase 2: 256-dim hash
  known_aliases TEXT[] DEFAULT '{}',
  phone_number TEXT,  -- for phone call matching
  email TEXT,
  ark_id TEXT,  -- future: Ark.works identity link
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Phase 4: Smart Call → RAG Pipeline Integration

### voice-brain-analyze Enhancement
After analysis, automatically call voice-call-ingest:

```typescript
// At end of voice-brain-analyze, after saving analysis:
if (analysis.decisions?.length || analysis.keyQuotes?.length) {
  // Invoke voice-call-ingest
  await fetch(`${supabaseUrl}/functions/v1/voice-call-ingest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      recordingId,
      analysis,
      transcript
    })
  });
}
```

## Data Flow Summary

```
Audio → STT → Transcript → Claude Analysis → Knowledge Items → RAG
                                            → Calendar Events → GCal
                                            → Action Items → Todos
                                            → Follow-ups → Reminders
```

## Cost Estimate (per call/meeting)

| Step | Provider | Cost |
|------|----------|------|
| STT | Google Cloud | ~$0.006/15sec = ~$0.48/20min |
| Analysis | Claude Haiku | ~$0.01-0.03 |
| Embedding | Voyage AI | ~$0.001 |
| **Total** | | **~$0.50/20min call** |

## Data Sovereignty
- Audio files: Supabase Storage (user's project)
- Transcripts: Supabase DB (encrypted at rest)
- Voice fingerprints: Local device only (Phase 2)
- STT: Google Cloud (stateless, no data retention)
- Analysis: Anthropic Claude (no training on API data)
- Embeddings: Voyage AI (no data retention)
