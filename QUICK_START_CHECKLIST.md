# ✅ Nexus Planner 백엔드 구축 체크리스트

## 🎯 아침에 일어나서 해야 할 일

### 1단계: Supabase 프로젝트 생성 (10분)

- [ ] [supabase.com](https://supabase.com)에 접속하여 로그인
- [ ] "New Project" 클릭
- [ ] 프로젝트 정보 입력:
  - Name: `Nexus Planner` (또는 원하는 이름)
  - Database Password: 강력한 비밀번호 (저장해두기!)
  - Region: 가장 가까운 지역 선택
- [ ] "Create new project" 클릭
- [ ] 프로젝트 생성 대기 (~2분)

### 2단계: API 키 복사 (2분)

- [ ] Supabase 프로젝트 대시보드에서 Settings (⚙️) 클릭
- [ ] "API" 섹션으로 이동
- [ ] 다음 두 값 복사:
  - [ ] Project URL: `https://xxxxxxxxxxxxx.supabase.co`
  - [ ] anon public key: `eyJ...`로 시작하는 긴 문자열

### 3단계: 환경 변수 설정 (2분)

- [ ] 프로젝트 폴더에서 `.env` 파일 열기
- [ ] 복사한 값으로 업데이트:
  ```env
  VITE_SUPABASE_URL=여기에_Project_URL_붙여넣기
  VITE_SUPABASE_ANON_KEY=여기에_anon_key_붙여넣기
  ```
- [ ] 파일 저장

### 4단계: 데이터베이스 스키마 적용 (5분)

- [ ] Supabase 대시보드에서 "SQL Editor" 클릭
- [ ] "New query" 클릭
- [ ] 로컬 프로젝트에서 `supabase/schema.sql` 파일 열기
- [ ] 전체 내용 복사
- [ ] Supabase SQL Editor에 붙여넣기
- [ ] "Run" 버튼 클릭 (또는 Cmd/Ctrl + Enter)
- [ ] "Success. No rows returned" 메시지 확인

### 5단계: (선택) 샘플 데이터 로드 (3분)

- [ ] Supabase SQL Editor에서 새 쿼리 생성
- [ ] `supabase/seed.sql` 파일 내용 복사
- [ ] 붙여넣기 후 "Run" 클릭
- [ ] 성공 메시지 확인

### 6단계: 개발 서버 재시작 (1분)

- [ ] 터미널에서 현재 실행 중인 서버 중지 (Ctrl + C)
- [ ] 다시 시작:
  ```bash
  npm run dev
  ```
- [ ] 브라우저에서 `http://localhost:8080` 열기

### 7단계: 첫 계정 생성 (2분)

- [ ] 로그인/회원가입 페이지가 표시되는지 확인
- [ ] "Sign Up" 탭 클릭
- [ ] 정보 입력:
  - Full Name: 본인 이름
  - Email: 본인 이메일
  - Password: 6자 이상
- [ ] "Create Account" 클릭
- [ ] (이메일 확인이 활성화된 경우) 이메일 확인

### 8단계: 관리자 권한 부여 (3분)

- [ ] Supabase 대시보드 → "Table Editor" 이동
- [ ] `profiles` 테이블 선택
- [ ] 방금 생성한 사용자 찾기
- [ ] `role` 열 클릭
- [ ] `MEMBER`를 `ADMIN`으로 변경
- [ ] 체크마크 클릭하여 저장
- [ ] 앱 새로고침

### 9단계: 기능 테스트 (5분)

- [ ] 로그인 성공 확인
- [ ] 캘린더 페이지 로드 확인
- [ ] 프로젝트 페이지 확인
- [ ] 새 프로젝트 생성 시도
- [ ] 새 이벤트 생성 시도
- [ ] 채팅 페이지 확인
- [ ] Admin 페이지 접근 확인 (관리자만)

### 10단계: 완료! 🎉

- [ ] 모든 기능이 작동하는지 확인
- [ ] 문제가 있다면 `SUPABASE_SETUP.md`의 "Troubleshooting" 섹션 참조

---

## 📚 참고 문서

- **전체 설정 가이드**: `SUPABASE_SETUP.md`
- **배포 가이드**: `DEPLOYMENT.md`
- **프로젝트 개요**: `README.md`
- **작업 완료 보고서**: `BACKEND_SETUP_COMPLETE.md`

## 🆘 문제 해결

### "Supabase not configured" 오류
1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. 개발 서버 재시작
3. 환경 변수가 `VITE_`로 시작하는지 확인

### 로그인 실패
1. 이메일 확인 필요 여부 체크
2. 비밀번호 최소 6자 확인
3. 브라우저 콘솔에서 에러 메시지 확인

### 데이터가 보이지 않음
1. 시드 데이터를 로드했는지 확인
2. RLS 정책이 올바른지 확인
3. 프로필 테이블에 사용자가 있는지 확인

---

## ⏱️ 예상 소요 시간

**총 소요 시간**: 약 30-40분

- Supabase 설정: 10분
- 환경 변수: 2분
- 스키마 적용: 5분
- 샘플 데이터: 3분
- 서버 재시작: 1분
- 계정 생성: 2분
- 관리자 설정: 3분
- 테스트: 5분
- 여유 시간: 10분

---

## 🎯 성공 기준

다음 항목이 모두 작동하면 성공입니다:

✅ 로그인/회원가입 페이지 표시  
✅ 계정 생성 가능  
✅ 로그인 성공  
✅ 프로젝트 목록 표시  
✅ 새 프로젝트 생성 가능  
✅ 캘린더 이벤트 표시  
✅ 채팅 기능 작동  
✅ Admin 페이지 접근 (관리자)  

---

**화이팅! 🚀**

문제가 있으면 `SUPABASE_SETUP.md`를 참조하세요!
