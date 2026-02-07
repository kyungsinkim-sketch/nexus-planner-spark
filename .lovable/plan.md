

# Finance 페이지 전면 업데이트 계획

## 목표
엑셀 데이터(경상비_운영비)를 기반으로 Admin Finance 탭을 실제 경영 대시보드로 전환하고, 순이익 배분 구조와 연도별 목표 관리 기능을 추가합니다.

---

## Phase 1: 데이터 정합성 수정

### 1-1. Mock Data 수정 (src/mock/data.ts)
- 총 매출액을 공급가 기준 ₩4,367,593,508로 수정
- p1 현대글로비스: ₩500,900,000 → ₩250,450,000 (잔금 기준)
- p23 UWB 잔금 프로젝트 삭제 (p15에 이미 포함)
- VAT 포함으로 설정된 프로젝트 금액을 공급가 기준으로 재조정
- p20 제품PR: ₩1,354,551,238 → ₩1,340,764,798로 수정
- financeSummary 재계산

### 1-2. 경상비/인건비/촬영진행비 데이터 추가
`src/mock/data.ts`에 새로운 데이터 구조 추가:

```text
annualFinancials (연도별 재무 데이터)
+-- year: 2025
|   +-- revenue: 4,367,593,508
|   +-- overhead (경상비): 1,100,167,210
|   |   +-- managementPayroll: 297,751,368
|   |   +-- officeRent: 180,000,000
|   |   +-- vehicleLease: 11,660,660
|   |   +-- utilities: 11,223,960
|   |   +-- insurance: 1,049,690
|   |   +-- fees: 69,932,189
|   |   +-- loanInterest: 106,841,355
|   |   +-- taxes: 297,551,624
|   |   +-- supplies: 17,591,740
|   |   +-- welfare: 70,996,323
|   |   +-- salesActivity: 54,209,731
|   +-- productionPayroll (인건비): 1,163,474,086
|   |   +-- leaders: 388,704,025
|   |   +-- seniors: 332,547,707
|   |   +-- juniors: 299,241,665
|   |   +-- interns: 18,908,756
|   |   +-- contractors: 23,002,010
|   |   +-- severance: 101,069,924
|   +-- productionCost (촬영진행비): 2,064,158,633
|   |   +-- projectProduction: 1,359,636,480
|   |   +-- eventProduction: 689,094,951
|   |   +-- overseas: 15,427,202
|   +-- netProfit: 654,822,819
|   +-- investment: 615,029,240
+-- year: 2026 (target)
|   +-- revenue: 5,022,732,534
|   +-- overhead: 1,023,033,474
|   +-- productionPayroll: 879,080,270
|   +-- productionCost: 2,136,404,185
|   +-- netProfit: 984,214,605
```

---

## Phase 2: Finance 탭 UI 재설계

### 2-1. FinanceTab 상단 요약 카드 개편 (src/components/admin/FinanceTab.tsx)
현재 4개 카드를 확장하여 핵심 P&L 지표를 보여줌:

```text
[연 매출(공급가)]  [경상비]  [인건비]  [촬영진행비]  [순이익]  [수익률]
 ₩43.7억           ₩11억     ₩11.6억   ₩20.6억       ₩6.5억    15%
```

### 2-2. 탭 구조 확장
기존 3개 탭에 2개 탭 추가:

```text
[계약현황] [지출 예정] [지출 세부] [연간 P&L] [이익배분]
```

---

## Phase 3: 연간 P&L 탭 (새 컴포넌트)

### 3-1. AnnualPLSection.tsx 신규 생성
`src/components/admin/finance/AnnualPLSection.tsx`

포함 내용:
- **연도 선택 드롭다운** (2025 실적 / 2026 목표)
- **손익계산서 형태 테이블**:
  - 매출액 (공급가)
  - (-) 경상비 (소분류별 펼치기/접기)
  - (-) 인건비 (직급별 펼치기/접기)
  - (-) 촬영진행비 (프로젝트별 펼치기/접기)
  - = 순이익
- **연도 비교 차트** (Recharts 막대그래프)
  - 2025 실적 vs 2026 목표
  - 항목별 증감률 표시
- **월별 캐시플로우 차트** (라인 차트)

### 3-2. 경상비 상세 뷰 (Accordion 형태)
각 경상비 카테고리를 펼치면 월별 상세 금액 테이블 표시:
- 경영실 인건비 (개인별 월급)
- 사무실/차량
- 대출이자 (건별)
- 세금 (종류별)
- 복리후생 등

---

## Phase 4: 이익배분 탭 (새 컴포넌트)

### 4-1. ProfitDistributionSection.tsx 신규 생성
`src/components/admin/finance/ProfitDistributionSection.tsx`

포함 내용:
- **순이익 기준 표시**: ₩654,822,819
- **배분 시뮬레이션 카드 4개**:

```text
[성과상여금 20%]     [신규사업 투자 30%]   [주주배당 20%]       [사내유보 30%]
 ₩130,964,564        ₩196,446,846         ₩130,964,564        ₩196,446,846
 (수식 추후 제공)     솔루션/광고제/참석     배당금               이월금
```

- **도넛 차트** (Recharts PieChart): 배분 비율 시각화
- **성과상여금 시뮬레이터** (향후 수식 연동 대비):
  - 현재는 20% 기본값 표시
  - 추후 개인별 성과 공식 입력 시 자동 계산
- **투자 계획 입력 영역**:
  - 솔루션 제작
  - 광고제 출품/참석
  - 기타 투자 항목
- **주주 배당 현황**: 주주명부 연동 (Page 3 데이터)
  - 주주별 지분율 및 예상 배당금

### 4-2. 2026 목표 시뮬레이션
- 2026 목표 순이익 ₩984,214,605 기준 배분 미리보기
- 슬라이더로 배분 비율 조정 가능 (What-if 분석)

---

## Phase 5: 기존 탭 데이터 정합성

### 5-1. ContractStatusSection 수정
- 프로젝트 금액을 정정된 공급가 기준으로 표시
- 중복 프로젝트 (p23) 제거 반영

### 5-2. ExpenseDetailSection 개편
- 엑셀 Page 6의 실제 촬영진행비 데이터로 교체
- 프로젝트별 실지출 금액을 정확히 반영
- 행사진행비/해외출장비 카테고리 추가

### 5-3. ExpenseScheduleSection
- 경상비 월별 고정비 데이터를 실제 값으로 교체
- 월별 현금 흐름 예측에 실데이터 반영

---

## 기술 상세

### 신규 파일
| 파일 | 설명 |
|------|------|
| `src/components/admin/finance/AnnualPLSection.tsx` | 연간 P&L 손익계산서 뷰 |
| `src/components/admin/finance/ProfitDistributionSection.tsx` | 이익배분 시뮬레이터 |

### 수정 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/mock/data.ts` | 매출 금액 정정, 중복 제거, annualFinancials 추가 |
| `src/components/admin/FinanceTab.tsx` | 요약 카드 확장 + 탭 2개 추가 |
| `src/components/admin/finance/ContractStatusSection.tsx` | 정정된 금액 반영 |
| `src/components/admin/finance/ExpenseDetailSection.tsx` | 실제 촬영진행비 데이터 반영 |
| `src/components/admin/finance/ExpenseScheduleSection.tsx` | 실제 경상비 월별 데이터 반영 |
| `src/components/admin/finance/index.ts` | 신규 컴포넌트 export 추가 |

### 데이터 보안
- 모든 재무 데이터는 mock/data.ts 내에서만 관리 (Confidential 처리)
- 외부 API 연동 없음, 로컬 데이터만 사용
- 향후 Supabase 연동 시 RLS 정책으로 admin-only 접근 제어 필요

