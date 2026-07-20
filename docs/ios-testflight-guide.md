# Re-Be.io iOS — TestFlight 배포 가이드

> 방식: **씬 셸(Thin Shell)** — 네이티브 앱이 라이브 `https://www.re-be.io`를
> 그대로 로드합니다. 웹에서 되는 모든 기능이 그대로 작동하고, 웹을 배포하면
> 앱에도 자동 반영됩니다(앱 재빌드 불필요).
>
> 설정 근거: `src-tauri/tauri.conf.json`의 메인 윈도우 `url`이
> `https://www.re-be.io`로 지정되어 있음.

---

## 0. 사전 준비 (Mac, 최초 1회)

```bash
# Xcode + Command Line Tools
xcode-select --install

# Rust + iOS 빌드 타겟
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-ios aarch64-apple-ios-sim

# CocoaPods (Tauri iOS 의존성)
brew install cocoapods
```

- **Apple Developer 계정**에 Xcode 로그인:
  Xcode → Settings → Accounts → `+` → Apple ID 로그인
- Bundle ID는 `io.re-be.app` (이미 프로젝트에 설정됨). 별도 등록 없이
  Xcode의 **Automatically manage signing**으로 자동 생성됩니다.

---

## 1. 코드 받기

```bash
cd ~/Documents            # 원하는 위치
git clone https://github.com/kyungsinkim-sketch/nexus-planner-spark.git
cd nexus-planner-spark
git checkout main
git pull origin main
npm install
```

> 이미 클론돼 있으면 `git pull origin main`만.

---

## 2. 시뮬레이터에서 먼저 확인 (선택)

```bash
npm run tauri:ios:dev
```

시뮬레이터에서 앱이 뜨고 `re-be.io` 로그인 화면이 보이면 성공.
(씬 셸이라 네트워크 필요 — 시뮬레이터에 인터넷 연결 확인)

---

## 3. Xcode에서 서명 설정

```bash
# Xcode 프로젝트 열기
open src-tauri/gen/apple/re-be-app.xcodeproj
```

Xcode에서:
1. 좌측 네비게이터에서 **re-be-app_iOS** 타겟 선택
2. **Signing & Capabilities** 탭
3. **Automatically manage signing** 체크
4. **Team** 드롭다운에서 본인 Apple Developer 팀 선택
5. Bundle Identifier가 `io.re-be.app`인지 확인

---

## 4. App Store Connect에 앱 레코드 생성 (최초 1회)

https://appstoreconnect.apple.com → **앱** → `+` → 신규 앱

- 플랫폼: iOS
- 이름: `Re-Be.io`
- 기본 언어: 한국어
- Bundle ID: `io.re-be.app` (드롭다운에 없으면 3단계 자동 서명 후 잠시 뒤 나타남)
- SKU: `rebe-ios` (아무 고유값)

---

## 5. 빌드 & 업로드

### 방법 A — Tauri CLI (권장)

```bash
npm run tauri:ios:build
```

빌드 성공 시 `.ipa`가 생성됩니다. 그 후 Xcode Organizer 또는
Transporter 앱으로 업로드하거나, 아래 방법 B로 진행.

### 방법 B — Xcode Archive (가장 확실)

1. Xcode 상단 디바이스 선택을 **Any iOS Device (arm64)**로
2. 메뉴 **Product → Archive**
3. Archive 완료되면 Organizer 창에서 **Distribute App**
4. **App Store Connect** → **Upload** 선택
5. 자동 서명으로 진행 → Upload

---

## 6. TestFlight 배포

App Store Connect → 해당 앱 → **TestFlight** 탭:

### 내부 테스터 (최대 100명, 심사 없음 — 가장 빠름) ⭐
1. 빌드가 "처리 중" → "테스트 준비 완료"로 바뀔 때까지 대기(보통 5~30분)
2. **내부 테스트** 그룹에 팀원 추가 (App Store Connect 사용자로 등록된 사람만)
3. 팀원은 **TestFlight 앱** 설치 후 초대 수락 → 즉시 설치 가능

### 외부 테스터 (최대 10,000명, 최초 1회 베타 심사)
1. **외부 테스트** 그룹 생성
2. 이메일로 초대 or 공개 링크 생성
3. 첫 빌드는 Apple 베타 심사(보통 하루 내) 통과 후 배포

> **팀 내부 배포라면 내부 테스터(100명)로 충분** — 심사 없이 바로 설치됩니다.

---

## 채팅 푸시 알림 (APNs) 설정 — 중요

씬 셸이어도 **네이티브 푸시는 작동합니다.** 네이티브 Swift 레이어
(`APNsSetup.swift`)가 로드된 페이지(원격 re-be.io 포함)에 디바이스 토큰을
주입하고, 웹앱이 이를 `device_tokens` 테이블에 등록 → Edge Function이 APNs로
발송하는 구조가 이미 구현되어 있습니다.

푸시가 실제로 울리려면 **아래 백엔드/서명 설정이 필요**합니다:

### 1. APNs 인증 키 생성 (Apple Developer, 최초 1회)
1. https://developer.apple.com/account → **Certificates, IDs & Profiles** → **Keys**
2. `+` → 이름 입력 → **Apple Push Notifications service (APNs)** 체크 → Continue
3. **.p8 키 파일 다운로드** (한 번만 받을 수 있음, 잘 보관)
4. 메모: **Key ID** (예: `ABC123DEFG`), **Team ID** (계정 우상단 10자리)

### 2. Xcode에서 Push Notifications capability 추가
1. `re-be-app.xcodeproj` → **re-be-app_iOS** 타겟 → **Signing & Capabilities**
2. **+ Capability** → **Push Notifications** 추가
3. 엔타이틀먼트의 `aps-environment`는 이미 `production`으로 설정됨(TestFlight용)

### 3. Supabase Edge Function 시크릿 등록
Supabase 대시보드 → Project Settings → Edge Functions → Secrets, 또는 CLI:
```bash
supabase secrets set APNS_KEY_ID=ABC123DEFG \
  APNS_TEAM_ID=YOUR_TEAM_ID \
  APNS_ENVIRONMENT=production \
  --project-ref ciuzbyjiqvtkwdlqovst
# .p8 파일 내용(PEM 전체)을 그대로:
supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_ABC123DEFG.p8)" \
  --project-ref ciuzbyjiqvtkwdlqovst
```

### 4. Edge Function 배포 + 마이그레이션 적용
```bash
supabase functions deploy push-notification --project-ref ciuzbyjiqvtkwdlqovst
# DB 트리거/큐(070) + 그룹방 푸시(105)가 프로덕션에 적용됐는지 확인
supabase db push   # 또는 대시보드 SQL 에디터로 105_group_room_push.sql 실행
```

### 5. 동작 확인
- TestFlight 빌드 설치 → 앱 실행 → **알림 권한 허용** 팝업 수락
- 다른 계정에서 채팅 메시지 전송 → 백그라운드에서 푸시 배너 확인
- 안 오면: Supabase `device_tokens`에 `platform='ios'` 토큰이 등록됐는지,
  Edge Function 로그에 APNs 응답(200 vs 400/410) 확인

> **환경 주의**: TestFlight/App Store 빌드는 **production APNs**를 씁니다
> (`aps-environment=production` + 토큰 `environment='production'` + 시크릿
> `APNS_ENVIRONMENT=production`, 세 곳이 일치해야 함). Xcode에서 기기로 직접
> 실행(development 서명)해 푸시를 테스트하려면 세 값을 `development`/`sandbox`로
> 맞춰야 합니다. **팀 배포는 TestFlight(production)로 하는 게 가장 단순합니다.**

---

## 알려진 제약 / 후속 작업

| 항목 | 현재 상태 | 비고 |
|------|-----------|------|
| 로그인·채팅·프로젝트·할일·캘린더·연동 | ✅ 정상 | 웹과 100% 동일 |
| 웹 업데이트 반영 | ✅ 자동 | 앱 재빌드 불필요 |
| **채팅 푸시(APNs)** | ✅ 지원 | 위 "채팅 푸시 알림" 설정 완료 시 DM·프로젝트·그룹방 모두 |
| 세이프에어리어/상태바 여백 | ⚠️ 확인 필요 | 첫 설치 후 시각 이슈 있으면 **웹에서 수정**하면 앱에도 자동 반영 |
| 로컬 RAG(Be.Ark) | 서버 모드 | 웹과 동일하게 서버 경유 |

> 씬 셸의 장점: 시각/기능 이슈 대부분은 **웹 배포만으로** 앱에 반영됩니다.
> (푸시 백엔드 설정만 위 5단계로 최초 1회 필요.)

---

## 다음 빌드(업데이트) 시

앱 자체 코드(네이티브 셸)는 거의 바뀔 일이 없습니다. **웹 기능 업데이트는
Vercel 배포만으로 앱에 반영**됩니다. 네이티브 셸을 바꿔야 할 때만
(예: 아이콘, 권한, 푸시 추가) 버전을 올리고 재빌드+재업로드하세요.

- 버전: `src-tauri/tauri.conf.json`의 `version` + Xcode의 Build 번호 증가
