/**
 * Knowledge Ontology — Re-Be Brain RAG 시스템의 Single Source of Truth
 *
 * 모든 knowledge_items의 분류 체계를 정의합니다.
 * DB CHECK constraint, Edge Function, 프론트엔드가 이 정의를 공유합니다.
 */

// ─── Knowledge Types ─────────────────────────────────
// 지식 항목의 성격/유형 분류
export const KNOWLEDGE_TYPES = {
  // 기존 10종 (migration 052)
  decision_pattern: '의사결정 패턴',
  preference: '작업 스타일 선호',
  judgment: '판단 기준 (리스크/예산/품질)',
  collaboration_pattern: '협업 패턴',
  recurring_risk: '반복 리스크',
  workflow: '표준 작업 절차',
  domain_expertise: '전문 지식',
  feedback_pattern: '피드백 패턴',
  communication_style: '커뮤니케이션 스타일',
  lesson_learned: '교훈/시행착오',
  // 확장 5종 (migration 053)
  creative_direction: '크리에이티브 방향성',
  budget_judgment: '예산 관련 판단',
  stakeholder_alignment: '이해관계자 조율',
  schedule_change: '일정 변경',
  context: '일반 맥락 정보',
  // Pablo AI Ontology 9종 (migration 057)
  deal_decision: '수주/거래 결정',
  budget_decision: '예산 판단 (금액, 배분, 견적)',
  payment_tracking: '대금 추적 (입금일정, 선금/잔금, 캐시플로우)',
  vendor_selection: '외주/파트너 선정',
  campaign_strategy: '캠페인/마케팅 전략',
  naming_decision: '네이밍/카피 확정',
  award_strategy: '어워드/광고제 전략',
  pitch_execution: '제안서/피칭 전략',
  talent_casting: '인재/모델/캐스팅',
} as const;

export type KnowledgeType = keyof typeof KNOWLEDGE_TYPES;

// ─── Source Types ────────────────────────────────────
// 지식이 추출된 원본 출처
export const SOURCE_TYPES = {
  // 기존 6종 (migration 052)
  chat_digest: '채팅 다이제스트',
  brain_action: 'Brain 액션',
  peer_review: '동료 리뷰',
  decision_log: '의사결정 기록',
  meeting_note: '미팅 노트',
  manual: '수동 입력',
  // 확장 3종 (migration 053)
  notion_page: 'Notion 문서',
  gmail: '이메일 (Gmail)',
  voice_recording: '음성 녹음',
  // Pablo AI Pipeline (migration 057)
  flow_chat_log: 'Flow 채팅 TXT 배치 분석',
} as const;

export type SourceType = keyof typeof SOURCE_TYPES;

// ─── Role Tags ───────────────────────────────────────
// 지식 항목의 역할 태그 (Role-based RAG)
export const ROLE_TAGS = {
  // 기존 7종 (migration 052)
  CD: '크리에이티브 디렉터',
  PD: '프로듀서',
  EDITOR: '편집',
  DIRECTOR: '연출',
  WRITER: '작가',
  DESIGNER: '디자인',
  MANAGER: '매니저',
  // 확장 5종 (migration 053)
  PRODUCER: '프로듀서 (확장)',
  CREATIVE_DIRECTOR: '크리에이티브 디렉터 (확장)',
  BUDGET_MANAGER: '예산 관리자',
  PROJECT_MANAGER: '프로젝트 매니저',
  STAKEHOLDER: '이해관계자',
  VENDOR: '외주 업체',
  // Pablo AI 확장 8종 (migration 057)
  CEO: '대표이사',
  EXECUTIVE_PRODUCER: '총괄 프로듀서',
  LINE_PD: '라인 프로듀서',
  SENIOR_ART_DIRECTOR: '시니어 아트 디렉터',
  ART_DIRECTOR: '아트 디렉터',
  COPYWRITER_CD: '카피라이터/CD 겸직',
  CLIENT: '클라이언트 (외부)',
  EXTERNAL_PARTNER: '외부 파트너',
} as const;

export type RoleTag = keyof typeof ROLE_TAGS;

// ─── Knowledge Scope ─────────────────────────────────
export const KNOWLEDGE_SCOPES = {
  personal: '개인 Brain',
  team: '팀/프로젝트 Brain',
  role: '역할 Brain',
  global: '전체 공유',
} as const;

export type KnowledgeScope = keyof typeof KNOWLEDGE_SCOPES;

// ─── Scope Layer (Pablo AI 3-Layer Ontology) ─────────
export const SCOPE_LAYERS = {
  operations: '운영/제작 (Layer 1: CEO-EPD-PD)',
  creative: '크리에이티브/전략 (Layer 2: CEO-CD)',
  pitch: '입찰/멀티팀 (Layer 3)',
} as const;

export type ScopeLayer = keyof typeof SCOPE_LAYERS;

// ─── Outcome (판단 결과) ─────────────────────────────
export const OUTCOMES = {
  confirmed: '확정',
  rejected: '기각',
  pending: '보류',
  escalated: '상위 결재',
} as const;

export type Outcome = keyof typeof OUTCOMES;

// ─── Knowledge Domain (for user_decision_patterns) ───
export const KNOWLEDGE_DOMAINS = {
  budget: '예산',
  creative: '크리에이티브',
  risk: '리스크',
  schedule: '일정',
  stakeholder: '이해관계자',
} as const;

export type KnowledgeDomain = keyof typeof KNOWLEDGE_DOMAINS;

// ─── KnowledgeItem Interface ─────────────────────────
export interface KnowledgeItem {
  id: string;
  userId?: string;
  projectId?: string;
  scope: KnowledgeScope;
  content: string;
  summary?: string;
  knowledgeType: KnowledgeType;
  sourceType: SourceType;
  sourceId?: string;
  roleTag?: RoleTag;
  confidence: number;
  relevanceScore: number;
  usageCount: number;
  lastUsedAt?: string;
  isActive: boolean;
  expiresAt?: string;
  // Pablo AI 확장 (migration 057)
  scopeLayer?: ScopeLayer;
  decisionMaker?: string;
  outcome?: Outcome;
  financialImpactKrw?: number;
  // timestamps
  createdAt: string;
  updatedAt: string;
}

// ─── UserDecisionPattern Interface ───────────────────
export interface UserDecisionPattern {
  id: string;
  userId: string;
  knowledgeDomain: KnowledgeDomain;
  patternType: string;
  patternSummary?: string;
  evidenceItemIds: string[];
  confidence: number;
  sampleCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Persona Interface (Pablo AI 등) ──────────────
export interface AiPersona {
  id: string;
  name: string;
  displayName: string;
  roleTag: RoleTag;
  systemPrompt: string;
  description?: string;
  avatarUrl?: string;
  isActive: boolean;
  config: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    ragFilter?: {
      decisionMaker?: string;
      roleTag?: RoleTag;
      scopeLayer?: ScopeLayer;
    };
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Persona Query Log Interface ─────────────────────
export interface PersonaQueryLog {
  id: string;
  personaId: string;
  userId: string;
  projectId?: string;
  query: string;
  response: string;
  ragContext?: Record<string, unknown>;
  feedback?: 'helpful' | 'unhelpful';
  responseTimeMs?: number;
  createdAt: string;
}
