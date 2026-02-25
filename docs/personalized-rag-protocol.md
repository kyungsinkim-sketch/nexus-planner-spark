# Personalized RAG Protocol v1
## "Your Data, Your Agent, Your Choice of Brain"

> Re-Be의 미션: 모든 이들이 시도/충돌/실패/성공의 경험, 그 가속화를 통해 사고가 확장되고 인류가 더욱 진보하는 것. AI가 그 중심 역할을 맡는 것.

---

## 1. Problem Statement

현재 AI 도구의 한계:
- ChatGPT/Claude는 **범용** — 개인의 맥락이 없음
- 기업 RAG 솔루션은 **IT팀 필수** — 설정이 복잡
- 개인 데이터는 **외부 서버에 종속** — 주권 없음
- 경험 데이터(통화, 미팅, 판단)는 **휘발** — 기록되지 않음

## 2. Protocol Vision

**어떤 크리에이터든, 설정 없이, 일하는 것만으로 자신만의 RAG가 구축되는 프로토콜.**

```
┌─────────────────────────────────────────────────────────────┐
│              Personalized RAG Protocol Stack                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 4: Agent Layer (선택)                                 │
│  ├─ Brain AI (Re-Be.io 내장)                                │
│  ├─ Custom Agent (사용자 직접 구축)                          │
│  └─ LLM Neutral: Claude / GPT / Llama / Gemini             │
│                                                              │
│  Layer 3: Knowledge Graph                                    │
│  ├─ knowledge_items (구조화된 판단 데이터)                   │
│  ├─ Ontology (knowledge_type, dialectic_tag, scope_layer)   │
│  └─ Relationships (source_id, project_id, decision_maker)   │
│                                                              │
│  Layer 2: Embedding & Search                                 │
│  ├─ Server: Voyage AI voyage-3-lite (512-dim)               │
│  ├─ Local: ONNX MiniLM-L6-v2 (384-dim)                     │
│  ├─ search_knowledge_v3 (hybrid: vector + relevance + usage)│
│  └─ Dialectic Search (正反合: 반론 자동 제공)                │
│                                                              │
│  Layer 1: Data Ingestion (Zero-Config)                       │
│  ├─ 채팅 → brain-digest → knowledge_items                   │
│  ├─ 음성 → voice-transcribe → voice-call-ingest             │
│  ├─ 이메일 → gmail-brain-analyze → knowledge_items          │
│  ├─ 캘린더 → gcal-sync → context                            │
│  ├─ 노션 → notion-api → knowledge_items                     │
│  └─ 수동 입력 → rag-ingest                                  │
│                                                              │
│  Layer 0: Data Sovereignty                                   │
│  ├─ Local-First: Tauri + SQLite (디바이스에 원본)            │
│  ├─ Server Sync: Supabase (암호화, 사용자 소유)             │
│  ├─ DID: 탈중앙 신원 (Phase 2)                              │
│  └─ Export: 언제든 전체 데이터 내보내기                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 3. Zero-Config Principle

**"Signal만 저장"** — 모든 데이터가 아닌, 판단/결정/충돌만 저장.

### 자동 시딩 파이프라인

| 소스 | 트리거 | 추출 대상 | knowledge_type |
|------|--------|-----------|----------------|
| 프로젝트 채팅 | 매 대화 | 판단, 결정, 리스크 | decision_pattern, recurring_risk |
| 음성 녹음 | 업로드 시 | 결정, 핵심 발언, 액션 | decision_pattern, budget_judgment |
| 이메일 | 수신 시 | 클라이언트 요청, 계약 변경 | stakeholder_alignment |
| 피드백 | 제출 시 | 팀원 평가, 개선점 | feedback_pattern |
| 프로젝트 완료 | 마감 시 | 교훈, 성과 | lesson_learned |

### 사용자가 해야 하는 것: **없음**

1. 그냥 Re-Be.io에서 일한다
2. 채팅하고, 미팅하고, 이메일 보낸다
3. Brain AI가 자동으로 판단 데이터를 추출하여 RAG에 시딩
4. 시간이 지나면 **"나를 아는 AI"**가 완성됨

## 4. Ontology Schema (표준화)

모든 크리에이터가 동일한 온톨로지를 사용하되, 각자의 데이터로 채워짐.

### 4.1 knowledge_type (15종)

| Category | Types | 설명 |
|----------|-------|------|
| **판단** | decision_pattern, preference, judgment | 正 — 내가 내린 결정 |
| **충돌** | recurring_risk, feedback_pattern | 反 — 문제, 실패, 갈등 |
| **학습** | lesson_learned, domain_expertise | 合 — 경험에서 배운 것 |
| **소통** | collaboration_pattern, communication_style | 나의 소통 방식 |
| **실행** | workflow, creative_direction, pitch_execution | 일하는 방식 |
| **관리** | budget_judgment, schedule_change, stakeholder_alignment | 운영 패턴 |
| **맥락** | context, talent_casting | 배경 정보 |

### 4.2 dialectic_tag (정반합 검색)

```
사용자가 낙관적 → risk, constraint 태그 검색 → 반론 제공
사용자가 비관적 → opportunity 태그 검색 → 기회 제시
사용자가 클라이언트 대응 중 → client_concern 검색 → 과거 유사 사례
```

### 4.3 scope_layer (조직 내 위치)

```
strategy   → CEO 전략적 판단
creative   → 크리에이티브 방향
operations → 운영/제작
pitch      → 입찰/프레젠테이션
execution  → 실행/배포
culture    → 팀 문화/관계
```

## 5. RAG Evolution Roles (3단계)

빠불로가 정의한 RAG의 3가지 진화 역할:

### Stage 1: 충돌의 기록자 (Conflict Chronicler)
- 正: 사용자의 판단/결정을 기록
- 反: 실패/충돌/리스크를 기록
- **현재 단계** — CEO 온톨로지 + 음성 파이프라인으로 구현 완료

### Stage 2: 실패의 기억자 (Failure Memory)
- 과거 실패 패턴을 검색하여 유사 상황에서 경고
- "지난번 이 클라이언트와 비슷한 상황에서 이런 문제가 있었습니다"
- dialectic_tag 기반 반론 자동 제공

### Stage 3: 사고의 파트너 (Thinking Partner)
- 正+反 = 合: 사용자의 판단과 과거 충돌을 종합하여 새로운 인사이트 생성
- "이 결정은 과거 3건의 유사 사례와 비교하면..."
- Agent OS로 진화하는 단계

## 6. Protocol Specification

### 6.1 Data Format (knowledge_item)

```json
{
  "content": "판단/결정/학습 내용 (자연어)",
  "summary": "요약 (80자 이내)",
  "knowledge_type": "enum(15종)",
  "source_type": "데이터 소스",
  "source_id": "원본 참조 ID",
  "scope": "global | personal | team | role",
  "scope_layer": "strategy | creative | operations | ...",
  "confidence": 0.0-1.0,
  "dialectic_tag": "risk | opportunity | constraint | quality | client_concern | null",
  "embedding_v2": "vector(512)",  // Voyage AI
  "embedding_model": "voyage-3-lite"
}
```

### 6.2 Search API

```
search_knowledge_v3(
  query_embedding,     -- 512-dim Voyage vector
  query_dims = 512,
  match_threshold = 0.3,
  match_count = 5,
  vector_weight = 0.70,
  relevance_weight = 0.20,
  usage_weight = 0.10
)
→ hybrid_score = vector_similarity * 0.7 + relevance * 0.2 + usage * 0.1
```

### 6.3 New User Onboarding (Zero-Config)

```
Day 1:   계정 생성 → 빈 knowledge_items
Day 1-7: 프로젝트 채팅 시작 → brain-digest가 자동 시딩
Week 2:  첫 음성 녹음 → voice-call-ingest가 미팅 결정 시딩
Week 3:  Gmail 연동 → gmail-brain-analyze가 이메일 패턴 시딩
Month 1: ~50-100개 knowledge_items → Brain AI가 맥락 있는 답변 시작
Month 3: ~200-500개 → "나를 아는 AI" 형성
Month 6: ~1000+개 → 사고의 파트너 수준
```

## 7. Multi-Creator Architecture

### 각 크리에이터가 자신만의 RAG를 소유

```
Creator A (영상 감독)           Creator B (광고 CD)
├─ knowledge_items (user_id=A)  ├─ knowledge_items (user_id=B)
├─ scope: personal + team       ├─ scope: personal + team
├─ 자신의 판단 패턴             ├─ 자신의 판단 패턴
├─ 자신의 프로젝트 맥락         ├─ 자신의 프로젝트 맥락
└─ 자신의 LLM 선택              └─ 자신의 LLM 선택
```

### 팀 레벨 지식 공유 (scope = 'team')

```
Team Project "GV90 Campaign"
├─ Creator A의 판단 (role: Director)
├─ Creator B의 판단 (role: CD)
├─ 공유된 결정 (scope: team)
└─ Brain AI는 팀 전체 맥락으로 답변
```

## 8. Data Sovereignty Guarantees

1. **소유권**: 모든 knowledge_items는 user_id로 귀속. 탈퇴 시 완전 삭제.
2. **이동성**: 전체 RAG 데이터를 JSON으로 내보내기 가능.
3. **투명성**: 어떤 데이터가 RAG에 들어갔는지 사용자가 확인/삭제 가능.
4. **LLM 중립**: Claude, GPT, Llama 등 어떤 모델이든 연결 가능. 임베딩만 표준화.
5. **Local-First**: Tauri 앱에서 로컬 RAG 동작. 서버는 sync/backup 용도.

## 9. Roadmap

| Phase | 기간 | 내용 | 상태 |
|-------|------|------|------|
| 0 | 완료 | Voyage AI 마이그레이션 + 인프라 | ✅ |
| 1 | 완료 | CEO 온톨로지 시딩 (89 items) | ✅ |
| 2 | 완료 | Smart Call 파이프라인 | ✅ |
| 3 | 진행중 | Zero-Config RAG 프로토콜 설계 | 🔄 |
| 4 | 다음 | 모바일 앱 + 음성 녹음 UI | ⬜ |
| 5 | 다음 | 멀티 크리에이터 + 팀 RAG | ⬜ |
| 6 | 이후 | Agent OS + Hardware 진화 | ⬜ |

## 10. Killer Sales Pitch

> **"미팅 녹음만 해도 업무가 자동으로 정리된다"**

- 처음 1주: 그냥 일하세요. 채팅하고, 미팅하고.
- 1달 후: AI가 당신의 판단 패턴을 알기 시작합니다.
- 3달 후: "이 클라이언트 저번에도 이렇게 했는데, 그때는 이렇게 대응했잖아요"
- 6달 후: 당신의 사고 파트너가 됩니다.

**경쟁사와의 차이**: 
- Notion AI / ChatGPT: 범용, 맥락 없음
- Re-Be.io: **당신의 시도/충돌/실패/성공이 축적된 AI**
