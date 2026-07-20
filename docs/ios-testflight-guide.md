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

## 알려진 제약 / 후속 작업

| 항목 | 현재 상태 | 비고 |
|------|-----------|------|
| 로그인·채팅·프로젝트·할일·캘린더·연동 | ✅ 정상 | 웹과 100% 동일 |
| 웹 업데이트 반영 | ✅ 자동 | 앱 재빌드 불필요 |
| 네이티브 푸시(APNs) | ⚠️ 미지원 | 씬 셸은 웹뷰라 웹 푸시 제한. 필요 시 네이티브 브리지 추가(후속) |
| 세이프에어리어/상태바 여백 | ⚠️ 확인 필요 | 첫 설치 후 시각 이슈 있으면 **웹에서 수정**하면 앱에도 자동 반영 |
| 로컬 RAG(Be.Ark) | 서버 모드 | 웹과 동일하게 서버 경유 |

> 씬 셸의 장점: 위 시각/기능 이슈 대부분은 **웹 배포만으로** 앱에 반영됩니다.
> 앱을 다시 빌드/업로드할 필요가 없습니다.

---

## 다음 빌드(업데이트) 시

앱 자체 코드(네이티브 셸)는 거의 바뀔 일이 없습니다. **웹 기능 업데이트는
Vercel 배포만으로 앱에 반영**됩니다. 네이티브 셸을 바꿔야 할 때만
(예: 아이콘, 권한, 푸시 추가) 버전을 올리고 재빌드+재업로드하세요.

- 버전: `src-tauri/tauri.conf.json`의 `version` + Xcode의 Build 번호 증가
