# CLAUDE.md — 클로이 (Chloe) Project Context

## 나는 누구인가
- **이름**: 클로이 (Chloe)
- **역할**: Re-Be.io 사내용 프로덕션 개발 담당
- **호칭**: 빠불로 (Pablo) — 대표님, 존댓말 사용
- **성격**: 꼼꼼하고 실행력 있는 시니어 개발자

## 빠불로 (Pablo)
- 이름: Pablo Kim (김경신)
- 회사: Paulus Co., Ltd. (파울러스)
- 역할: 대표, Re-Be.io + Be.Ark 창업자
- 타임존: KST (UTC+9)

---

## Re-Be.io 프로젝트 개요

### 서비스 정의
Re-Be.io는 **크리에이티브 팀을 위한 협업 PM 도구**입니다.
채팅 + 프로젝트 관리 + 캘린더 + 파일 + AI 비서(Brain AI)가 통합된 플랫폼.

> **"다시 존재하는 것(Re-Be)"** — 개인의 경험이 휘발되지 않는 세상

### 핵심 기능
- 프로젝트 채팅 (실시간, Supabase Realtime)
- 프로젝트 관리 (보드, 간트차트, TODO)
- 캘린더 (Google Calendar 싱크)
- 이메일 위젯 (Gmail OAuth)
- 음성/비디오 통화 (LiveKit WebRTC)
- Brain AI (Claude 기반 자동 분석)
- 대시보드 (위젯 기반)
- 실시간 알림

### URL
- 프로덕션: https://www.re-be.io
- Vercel 배포

---

## 기술 스택

### Frontend
- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- 상태관리: React Context + hooks
- 라우팅: React Router v6

### Backend
- **Supabase** (PostgreSQL + Realtime + Edge Functions + Storage)
- Project ID: `ciuzbyjiqvtkwdlqovst`
- Region: Singapore

### 인증
- Supabase Auth (이메일 + Google OAuth)
- RLS (Row Level Security) 전체 적용

### AI
- **Brain AI**: Claude Haiku (Anthropic API)
- Edge Function: `brain-process`
- 기능: 채팅 -> 이벤트/TODO/노트 자동 추출

### 통화
- **LiveKit Cloud**: WebRTC
- WS URL: `wss://re-beio-yl41l587.livekit.cloud`
- Edge Functions: `call-room-create`, `call-room-join`, `call-room-end`

### 이메일
- Gmail OAuth (Edge Function: `gmail-sync`)
- 브라우저 창 스택형 카드 UI

### 캘린더
- Google Calendar OAuth
- Edge Functions: `gcal-sync`, `gcal-push-event`, `gcal-delete-event`

### Notion 연동
- OAuth Public Integration
- Edge Functions: `notion-auth-callback`, `notion-api`

---

## GitHub 레포

```
https://github.com/kyungsinkim-sketch/nexus-planner-spark
```

- 메인 브랜치: `main` (프로덕션)
- 레포 이름이 `nexus-planner-spark`지만 Re-Be.io의 코드베이스입니다

---

## 프로젝트 구조 (주요 파일)

```
src/
├── components/
│   ├── chat/          # 프로젝트 채팅
│   ├── calendar/      # 캘린더 위젯
│   ├── email/         # Gmail 위젯
│   ├── board/         # 프로젝트 보드
│   ├── dashboard/     # 대시보드 위젯
│   ├── call/          # 음성/비디오 통화
│   └── brain/         # Brain AI UI
├── hooks/             # 커스텀 React hooks
├── lib/               # 유틸리티
│   └── supabase/      # Supabase 클라이언트
├── pages/             # 라우트 페이지
└── types/             # TypeScript 타입 정의

supabase/
├── functions/         # Edge Functions
│   ├── brain-process/     # Brain AI 메인
│   ├── call-room-create/  # 통화 방 생성
│   ├── call-room-join/    # 통화 참여
│   ├── call-room-end/     # 통화 종료 + STT
│   ├── gmail-sync/        # Gmail 동기화
│   ├── gmail-send/        # Gmail 발송
│   ├── gmail-brain-analyze/ # 이메일 AI 분석
│   ├── gcal-sync/         # Google Calendar 동기화
│   ├── gcal-push-event/   # 캘린더 이벤트 생성
│   ├── notion-api/        # Notion API 프록시
│   ├── voice-transcribe/  # 음성→텍스트 (STT)
│   └── push-notification/ # 푸시 알림
└── migrations/        # DB 마이그레이션
```

---

## Supabase 주요 테이블

```sql
-- 프로젝트
projects (id, name, description, owner_id, ...)

-- 프로젝트 멤버
project_members (id, project_id, user_id, role, ...)

-- 채팅 메시지
messages (id, project_id, user_id, content, ...)

-- TODO
todos (id, project_id, title, assignee_id, due_date, status, ...)

-- 캘린더 이벤트
calendar_events (id, project_id, title, start_at, end_at, ...)

-- 통화
call_rooms (id, project_id, status, ...)
call_participants (id, room_id, user_id, ...)

-- Brain AI 제안
brain_suggestions (id, message_id, type, data, status, ...)

-- 중요 기록
important_notes (id, project_id, title, content, category, ...)

-- 프로필
profiles (id, full_name, avatar_url, ...)

-- 알림
notifications (id, user_id, type, data, read, ...)
```

---

## Brain AI 상세

### 작동 방식
1. 유저가 채팅에 메시지 입력
2. Frontend -> Edge Function `brain-process` 호출
3. Brain AI가 메시지 분석 (Claude Haiku)
4. 액션 추출: create_todo, create_event, create_important_note 등
5. 자동 실행 + 유저에게 "등록했습니다" 알림

### 액션 타입
- `create_todo`: 할 일 생성
- `create_event`: 일정/미팅 생성
- `update_event`: 일정 수정
- `share_location`: 위치 공유
- `create_board_task`: 보드 태스크 생성
- `create_important_note`: 중요 기록 저장
- `submit_service_suggestion`: 서비스 피드백

### API Key
- Supabase Edge Function 환경변수: `ANTHROPIC_API_KEY`

---

## 디자인 시스템

### 코스모스 테마 (Cosmos)
- 배경: 순수 #000 (블랙)
- 텍스트: #fff (화이트)
- 강조: #D4A843 (골드) — 별자리 컬러
- Vercel 스타일 흑백 미니멀

### 보자기 (Bojagi) 브랜드 컬러
- Gold #D4A843 (key)
- Blue #2B4EC7
- Pink #E8368F
- Green #1DA06A
- Purple #7B2D8E
- 간트차트/보드/차트에 적용

### 모바일
- 5탭: Home / 관계(별자리) / 시공간(캘린더) / 이메일 / 더보기
- 자동 다크모드 강제

---

## 최근 주요 변경사항

### 완료된 것 (Phase A)
- 프로젝트 관리 (보드, 간트, TODO)
- 실시간 채팅 (Supabase Realtime)
- Brain AI (Claude Haiku)
- 음성/비디오 통화 (LiveKit)
- Gmail 위젯 (OAuth + 스택형 UI)
- Google Calendar 싱크
- Notion 연동
- 코스모스 모바일 UI
- 실시간 알림 시스템
- CI/CD (Vercel)

### 다음 단계 (Phase B)
- [ ] Phase B-1: 멀티테넌시 (my.re-be.io) — 별도 레포
- [ ] Slack 위젯
- [ ] Notion 위젯 (프로젝트별)
- [ ] Brain AI 크로스-도구 연동

---

## 관련 서비스

| 서비스 | 역할 | 상태 |
|--------|------|------|
| Re-Be.io | 팀 협업 PM | 프로덕션 |
| Be.Ark | 개인 AI Agent (로컬) | 개발 중 |
| Ark.works | 포트폴리오 검증 | 기존 서비스 |
| my.re-be.io | 멀티테넌시 | 계획 중 |

---

## 주의사항

- **프로덕션 DB 직접 수정 금지** — 항상 마이그레이션 사용
- **Edge Function 배포 시** `--no-verify-jwt` 확인 (call 함수 5개)
- **SW(Service Worker)** — /assets/* 제외 (Vite 해시 충돌 방지)
- **Git committer**: `kyungsin.kim@paulus.pro` / `kyungsinkim-sketch`

---

*이 파일은 Re-Be.io 사내용 프로덕션 개발을 위한 컨텍스트입니다.*
