# Changelog

## v0.7.0 (2026-03-25)

### ✨ New Features
- **Living Notes** — 정(Thesis)/반(Antithesis)/합(Synthesis) 구조의 프로젝트 기록 시스템
  - 타임라인 뷰, Bojagi 색상, 마크다운 렌더러
  - 데스크톱 위젯 + 모바일 전체 지원
  - 기존 Important Notes → Living Notes 데이터 마이그레이션
- **Calendar TODO Toggle** — 캘린더에서 할 일 표시 on/off (기본 OFF)
  - 대시보드 위젯: 헤더 토글 버튼
  - 프로젝트 캘린더: 필터 기본값 변경
  - 모바일: TODO 이벤트 기본 숨김

### ⚡ Performance
- **emoji-mart lazy loading** — ChatPanel 초기 번들 484KB → 62KB (-87%)
- **ActiveCallOverlay / IncomingCallDialog / AutoCheckInDialog lazy** — index.js -55KB

### 🐛 Bug Fixes
- Calendar event deduplication fix
- Brain AI DM history dual-ID resolution
- `#` channel message routing fix
- Korean word-break fix (`overflowWrap: 'break-word'`)
- `#` autocomplete sub-rooms
- `@` mention email filter fix
- DM PDF file download/preview fix
- Living Notes JSX syntax fix

### 🔧 Improvements
- Chat performance: pre-indexed messages by room/project/DM (Map-based O(1) lookup)
- Bundle optimization across lazy-loaded components
- Debug logging cleanup for production

---

## v0.6.4 and earlier
See git history.
