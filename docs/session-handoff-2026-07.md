# 세션 인수인계 — Re-Be.io (2026년 7월)

> 이 문서는 이전 세션의 작업 내용을 다음 세션이 이어받기 위한 요약입니다.
> 작성: 클로이 / 대상: 빠불로(Pablo)
> 개발 브랜치: `claude/re-be-io-dev-MWqSb` · 모든 작업은 `main`에 머지·푸시 완료.

---

## 0. 지금 당장 이어서 할 일 (가장 중요) ⏳

**iOS 앱을 TestFlight로 배포 + 채팅 푸시 알림 활성화** 작업 진행 중.
방식은 **씬 셸(Thin Shell)** — 네이티브 앱이 라이브 `https://www.re-be.io`를
그대로 로드. (상세: `docs/ios-testflight-guide.md`)

### 진행 상태 체크리스트
- [x] Apple 개발자 프로그램 가입 완료
- [x] `tauri.conf.json` — 메인 윈도우가 `https://www.re-be.io` 로드하도록 설정
- [x] 웹/네이티브 푸시 코드 씬 셸 호환 처리 (아래 3-C 참고)
- [x] App Store Connect 앱 레코드 생성 (Bundle ID `io.re-be.app`)
- [x] **APNs 인증 키(.p8) 생성** — Environment: Sandbox & Production /
      Type: Team Scoped (All Topics)로 발급 완료
- [ ] **← 여기서 멈춤. Supabase 시크릿 4개 등록** (아래 명령 참고)
- [ ] `push-notification` Edge Function 배포
- [ ] 마이그레이션 `105_group_room_push.sql` 프로덕션 적용
- [ ] Mac에서 Xcode에 **Push Notifications capability** 추가
- [ ] `npm run tauri:ios:build` → Xcode Archive → App Store Connect 업로드
- [ ] TestFlight 내부 테스터(최대 100명, 심사 없음) 배포 + 푸시 실제 테스트

### 다음 세션 첫 명령 (Supabase 시크릿 등록)
```bash
cd ~/Documents/nexus-planner-spark   # repo 위치

supabase secrets set \
  APNS_KEY_ID=<10자리 Key ID> \
  APNS_TEAM_ID=<10자리 Team ID> \
  APNS_ENVIRONMENT=production \
  --project-ref ciuzbyjiqvtkwdlqovst

supabase secrets set \
  APNS_PRIVATE_KEY="$(cat ~/Downloads/AuthKey_XXXXXXXXXX.p8)" \
  --project-ref ciuzbyjiqvtkwdlqovst

# 확인
supabase secrets list --project-ref ciuzbyjiqvtkwdlqovst
```
그다음:
```bash
supabase functions deploy push-notification --project-ref ciuzbyjiqvtkwdlqovst
# 105_group_room_push.sql 은 대시보드 SQL 에디터로 실행해도 됨
```

### ⚠️ 푸시 환경 일치 (가장 흔한 함정)
`aps-environment=production`(엔타이틀먼트) + 토큰 `environment='production'`
+ 시크릿 `APNS_ENVIRONMENT=production` — **세 곳이 모두 production**이어야 함.
현재 코드/설정은 셋 다 production으로 맞춰져 있음. 안 맞으면 토큰은 받는데
발송이 400 BadDeviceToken으로 실패함.

---

## 1. 이번 세션에서 완료한 작업 (시간순)

### A. Live Caption 실시간 번역 수정
- **문제**: "Translating…"에서 멈춤.
- **원인 3중**: ① `translate.googleapis.com` 브라우저 CORS 차단
  ② Edge Function JWT 검증 켜짐(401) ③ **React 18 batching 버그** —
  `setLines` updater 안에서 `newFinals` 배열을 채우고 밖에서 순회 →
  항상 빈 배열 → `runTranslate` 미호출 (진짜 근본 원인).
- **해결**: 서버사이드 프록시 Edge Function `translate-text` 신설 +
  fallback 병렬화(최악 18초→5초) + ID 계산을 updater 밖으로 이동.
- 커밋: `9eb8bdf`, `c07e985`, `cac30c5`, `3f3e2d1`

### B. 데이터/알림 버그 3종
- **다른 유저 TODO 노출**: 로그아웃 시 `personalTodos` 미삭제 + localStorage
  영속화 → 다음 유저에게 잔존 캐시 노출. `signOut`에서 삭제 + `TodosTab`/
  `ActionsWidget`에 소유권 필터 추가.
- **DM 알림 클릭 이동 안 됨**: `directUserId`가 알림 페이로드에서 누락 →
  메시지가 스토어에 없으면 이동 실패. 페이로드에 실어서 해결 + 그룹방 이동 보강.
- **대시보드 자동 스크롤 튐**: `scrollIntoView`가 상위(대시보드)까지 스크롤 →
  컨테이너 직접 `scrollTop`으로 변경 (LiveCaption/Slack/Files 위젯).
- 커밋: `b6468fd`

### C. 앱 전체 성능 최적화
- **렌더**: `useTranslation` 훅이 스토어 전체 구독 → 채팅 메시지마다 ~91개
  컴포넌트 리렌더. 필드 선택자로 전환. `ChatMessageBubble` memo화 +
  ChatPanel `useShallow` + 핸들러 `useCallback` 안정화.
- **번들**: `livekit-client`(~123KB gz)가 초기 로드에 포함 → 통화 연결 시에만
  동적 import. `vendor-livekit` 청크 분리.
- **네트워크**: 중복 `personal_todos` realtime 채널 제거, 캘린더 realtime
  2초 debounce, Gmail 동기화 30초 스로틀, 통화 폴링 백그라운드 15초,
  `getMessagesByRoom` 최근 200개 제한.
- 커밋: `e89e36d`, `87b57cf`

### D. 모바일 키보드 문제 (고질병) — 완전 해결
- **증상 변천**: ① 입력창 누르면 중간 빈 공간 ② 첫 탭만 깨짐 ③ 하단 네비가
  입력창 겹침 ④ 배경 흰색 플래시 ⑤ 스크롤이 이전 내용으로 밀림.
- **근본 원인**: iOS가 키보드 열 때 레이아웃 뷰포트를 **비동기 패닝**하는데
  `scrollTo(0,0)`로 싸우면 경합에서 짐.
- **해결**: `useKeyboardViewport` 훅 신설 — 패닝과 싸우지 않고
  `visualViewport.offsetTop`을 추적해 `translateY`로 따라감. `focusin`을
  1차 신호로 즉시 breakout(첫 탭 레이스 제거) + rAF 버스트 추적. 키보드 열릴 때
  네비 숨김 + 배경 `widget-area-bg` 통일 + 스크롤 다중 재고정.
- 적용: `MobileChatView/DmChatView/ChatListView/AIChatView` + `ChatWidget` +
  `MobileBottomNav` + `ChatPanel`.
- 커밋: `d29dafb`, `1cbf2a5`, `3217e6d`, `07378e4`, `05b3ad5`

### E. iOS TestFlight 준비 + 채팅 푸시 (진행 중 — 위 0번)
- App Store 심사 대비 v1.0.0, 권한 설명, portrait 고정, 다크 런치스크린,
  Associated Domains, iOS 15.0. (커밋 `ec8edb9`)
- 씬 셸 전환 + 가이드 문서. (커밋 `454d371`)
- 채팅 푸시 씬 셸 호환 + 그룹방 푸시 트리거. (커밋 `c163772`)

---

## 2. 보류 중인 항목 (아직 안 함)

- **Gemini 429 (`gmail-brain-analyze`)**: 이메일 AI 분석이 Gemini 2.0 Flash
  무료 티어(15 RPM) 초과. "일단 Gemini로 두고 나중에 고민"으로 빠불로 결정.
  옵션: throttle / Claude Haiku 통일 / 유료 전환 / Arcee Trinity 전환.
  (Gmail 동기화 30초 스로틀로 완화는 됨)
- **로컬 dev 서버 `.env.local`**: `VITE_SUPABASE_ANON_KEY`가 비어 있음.
  (씬 셸 빌드엔 불필요 — 원격 로드라 무관)
- **APNs 개발(sandbox) 테스트**: 현재 production 기준. Xcode 기기 직접 실행으로
  푸시 테스트하려면 세 환경값을 development/sandbox로 맞춰야 함.

---

## 3. 알아둘 아키텍처 사실

### A. 배포 워크플로우 (CLAUDE.md 규칙)
- Vercel 프로덕션은 **`main` 브랜치만** 배포.
- 소규모 수정은 feature 브랜치 커밋 → **자동으로 main 머지·푸시**.
- SW 번들 해시 바뀌면 `public/sw.js`의 `CACHE_NAME` bump (현재 **`re-be-v26`**).
- 파괴적 마이그레이션·대규모 리팩·보안/권한·비용 영향은 **먼저 빠불로 확인**.

### B. iOS 씬 셸 구조
- `src-tauri/tauri.conf.json` 메인 윈도우 `url: https://www.re-be.io`.
- 원격 페이지라 `isTauriApp()`은 **false** → 앱은 모바일 웹과 동일하게 동작.
- 웹 배포(Vercel)만으로 앱에 자동 반영 (시각/기능 수정은 재빌드 불필요).

### C. 채팅 푸시(APNs) 파이프라인 — 이미 구현됨
- **네이티브**: `src-tauri/gen/apple/Sources/re-be-app/APNsSetup.swift` +
  `APNsLoader.m`. Tauri IPC가 아니라 **WKWebView JS 주입**으로
  `window.__APNS_DEVICE_TOKEN__` 세팅 → 씬 셸(원격 페이지)에서도 작동.
- **웹**: `src/services/pushNotificationService.ts` — 토큰을 `device_tokens`
  테이블에 등록. 탭 핸들러는 `appStore.ts` `initPushAndSync` (line ~26).
- **DB**: `device_tokens`, `push_notification_queue` + 트리거
  `fn_queue_push_on_chat_message` (마이그레이션 070). 그룹방 브랜치는 105에서 추가.
- **발송**: Edge Function `push-notification` — APNs HTTP/2 (ES256 .p8 JWT).
  시크릿: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_ENVIRONMENT`.

### D. 로그인 방식
- **이메일/비밀번호** (Supabase Auth). Google OAuth 로그인 아님 →
  앱 안에서 리다이렉트 이슈 없음. (Gmail/캘린더/Notion "연동"은 별개 OAuth지만
  씬 셸이라 origin이 re-be.io로 정상 작동.)

### E. 주요 경로
- Supabase Project: `ciuzbyjiqvtkwdlqovst` (Singapore)
- GitHub: `kyungsinkim-sketch/nexus-planner-spark`
- iOS Xcode: `src-tauri/gen/apple/re-be-app.xcodeproj`
- 빌드 가이드: `docs/ios-testflight-guide.md` ← **푸시 설정 5단계 상세**

---

## 4. 다음 세션 시작 시 추천 첫 마디

> "docs/session-handoff-2026-07.md 읽고, iOS 푸시 Supabase 시크릿 등록부터
> 이어서 진행하자" — 그러면 위 0번 체크리스트부터 재개됩니다.
