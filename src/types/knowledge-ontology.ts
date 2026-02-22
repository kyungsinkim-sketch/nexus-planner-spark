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
  // 신규 5종 (migration 053)
  creative_direction: '크리에이티브 방향성',
  budget_judgment: '예산 관련 판단',
  stakeholder_alignment: '이해관계자 조율',
  schedule_change: '일정 변경',
  context: '일반 맥락 정보',
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
  // 신규 3종 (migration 053)
  notion_page: 'Notion 문서',
  gmail: '이메일 (Gmail)',
  voice_recording: '음성 녹음',
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
  // 신규 5종 (migration 053)
  PRODUCER: '프로듀서 (확장)',
  CREATIVE_DIRECTOR: '크리에이티브 디렉터 (확장)',
  BUDGET_MANAGER: '예산 관리자',
  PROJECT_MANAGER: '프로젝트 매니저',
  STAKEHOLDER: '이해관계자',
  VENDOR: '외주 업체',
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
