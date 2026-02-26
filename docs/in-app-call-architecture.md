# In-App Call Architecture — LiveKit + Brain AI

## Overview

앱 내 실시간 음성 통화 + AI 자동 분석 시스템.
통화 종료 → Brain AI가 자동으로 이벤트/TODO/중요 기록 제안 → 승인 시 생성 + RAG 자동 저장.

## Core Features

### Feature 1: Brain AI 자동 제안
통화 종료 후 Brain AI가 통화 내용을 분석하여:
- **이벤트 생성 제안** — 미팅, 데드라인, 일정 자동 감지
- **TODO 생성 제안** — 액션 아이템, 할당자, 우선순위 자동 추출
- **중요 기록 사항** — 핵심 결정, 리스크, 예산 관련 발언 정리

사용자가 카드형 UI로 한눈에 확인 → 체크/수정/승인 → 자동 생성

### Feature 2: RAG 자동 구축
기존 voice-call-ingest 파이프라인 활용:
- 통화 결정사항 → knowledge_items (decision_pattern)
- 핵심 발언 → knowledge_items (context)
- 액션 아이템 → knowledge_items (workflow)
- Voyage AI 512-dim embedding 자동 생성

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Re-Be.io App                        │
│                                                         │
│  ┌──────────┐    WebRTC     ┌──────────┐               │
│  │  User A   │◄────────────►│  User B   │               │
│  │  (React)  │              │  (React)  │               │
│  └─────┬─────┘              └─────┬─────┘               │
│        │ livekit-react              │                    │
│        └──────────┬─────────────────┘                    │
│                   │                                      │
└───────────────────┼──────────────────────────────────────┘
                    │ WebRTC
                    ▼
          ┌─────────────────┐
          │  LiveKit Server  │  (Cloud or Self-hosted)
          │                  │
          │  - Room mgmt     │
          │  - Audio routing │
          │  - Composite     │
          │    Recording     │
          └────────┬────────┘
                   │ Webhook: room_finished
                   ▼
          ┌─────────────────┐
          │  call-room-hook  │  (New Edge Function)
          │                  │
          │  1. Download     │
          │     recording    │
          │  2. Upload to    │
          │     Supabase     │
          │     Storage      │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ voice-transcribe │  (Existing)
          │  Whisper STT     │
          └────────┬────────┘
                   │
                   ▼
          ┌──────────────────┐
          │voice-brain-analyze│  (Existing)
          │  Claude Haiku     │
          │                   │
          │  Output:          │
          │  - suggestedEvents│
          │  - actionItems    │
          │  - decisions      │
          │  - keyQuotes      │
          │  - followups      │
          └────────┬─────────┘
                   │
          ┌────────┼────────────┐
          │        │            │
          ▼        ▼            ▼
     ┌─────────┐ ┌──────┐ ┌───────────────┐
     │ Events  │ │ TODOs│ │voice-call-    │
     │ (gcal)  │ │      │ │ingest (RAG)   │
     └─────────┘ └──────┘ └───────────────┘
```

## User Flow

1. **통화 시작**: User A가 앱에서 User B에게 통화 요청
2. **통화 진행**: LiveKit WebRTC로 실시간 음성 통화
3. **통화 종료**: 양측 중 한 명이 종료
4. **자동 분석**: 녹음 → STT → Brain AI 분석 (백그라운드)
5. **제안 카드**: 앱 내 알림 + 제안 카드 UI 표시
   - 📅 이벤트 제안 (날짜, 시간, 참석자 자동 입력)
   - ✅ TODO 제안 (담당자, 기한, 우선순위 자동 입력)
   - 📝 중요 기록 (결정사항, 리스크, 핵심 발언)
6. **승인/수정**: 사용자가 각 항목 확인 후 승인
7. **자동 생성**: 승인된 항목 → Events/TODOs 생성 + RAG 저장

## Tech Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| WebRTC | LiveKit | Cloud (MVP) → Self-host (후기) |
| Frontend | @livekit/components-react | React 컴포넌트 라이브러리 |
| Client SDK | livekit-client | WebRTC 클라이언트 |
| Room Token | Supabase Edge Function | JWT 발급 |
| Recording | LiveKit Egress API | Composite recording |
| STT | voice-transcribe (existing) | Whisper |
| Analysis | voice-brain-analyze (existing) | Claude Haiku |
| RAG | voice-call-ingest (existing) | Voyage AI |

## New Components

### 1. Edge Functions (New)
- `call-room-create` — LiveKit room 생성 + 참가 토큰 발급
- `call-room-hook` — LiveKit webhook 수신 → 녹음 처리 트리거

### 2. Frontend Components (New)
- `CallWidget.tsx` — 통화 UI (다이얼러, 통화중, 종료)
- `CallSuggestionCard.tsx` — Brain AI 제안 카드 (이벤트/TODO/기록)
- `callService.ts` — LiveKit 연결 + Room 관리

### 3. DB Changes
- `call_rooms` table — room metadata, participants, status
- `call_suggestions` table — Brain AI 제안 + 승인 상태

## Phase Plan

### Phase 1: MVP (현재)
- [ ] LiveKit Cloud 계정 + API key
- [ ] call-room-create Edge Function
- [ ] CallWidget 기본 UI (1:1 음성 통화)
- [ ] 통화 종료 후 녹음 → 기존 파이프라인 연결
- [ ] CallSuggestionCard UI

### Phase 2: Polish
- [ ] 통화 중 음소거/스피커 토글
- [ ] 통화 히스토리 목록
- [ ] Push notification (수신 알림)
- [ ] 그룹 통화 (3인 이상)

### Phase 3: Advanced
- [ ] 실시간 STT (통화 중 자막)
- [ ] LiveKit self-host 전환
- [ ] 화면 공유
- [ ] Voice fingerprint (화자 식별)

## Cost Estimate (MVP)

| Item | Cost |
|------|------|
| LiveKit Cloud | Free tier (50K participant-min/mo) |
| STT (Whisper) | ~$0.006/min |
| Brain (Claude Haiku) | ~$0.001/analysis |
| RAG (Voyage) | ~$0.00001/embed |
| **Total per 20min call** | **~$0.13** |
