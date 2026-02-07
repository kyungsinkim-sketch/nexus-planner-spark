# 🌐 Admin 페이지 영/한 번역 작업 요약

**작업 일시:** 2026-02-05  
**상태:** ✅ 부분 완료 (주요 컴포넌트 완료, 추가 작업 필요)

---

## ✅ 완료된 작업

### 1. 번역 키 추가 (i18n.ts)

**한국어 번역 추가:**
- `organizationChart`: '조직도'
- `employeeDirectory`: '임직원명부'
- `salaryTable`: '연봉규정표'
- `diligence`: '근태'
- `paulusOrgChart`: 'PAULUS CO., LTD 조직도'
- `ceo`: '대표이사'
- `employeeList`: '임직원 목록'
- `position`: '직급'
- `hireDate`: '입사일'
- `paulusSalaryTable`: '2025 파울러스 연봉규정표'
- `baseSalary`: '기본급'
- `performanceBonus`: '성과급'
- `totalCompensation`: '총 보수'
- `projectFinance`: '프로젝트 재무'
- `contractStatus`: '계약 현황'
- `expenseDetails`: '지출 내역'
- `revenueAnalysis`: '수익 분석'
- `facilityManagement`: '시설 관리'
- `assetManagement`: '자산 관리'
- `supplies`: '비품'
- `maintenance`: '유지보수'

**영어 번역 추가:**
- 모든 한국어 번역에 대응하는 영어 번역 추가 완료

### 2. 컴포넌트 업데이트

#### ✅ HumanResourceTab.tsx
- `조직도` → `{t('organizationChart')}`
- `임직원명부` → `{t('employeeDirectory')}`
- `연봉규정표` → `{t('salaryTable')}`
- `Productivity` → `{t('productivity')}`
- `Diligence` → `{t('diligence')}`

#### ✅ OrganizationChart.tsx
- `PAULUS CO., LTD 조직도` → `{t('paulusOrgChart')}`

#### ✅ SalaryTable.tsx
- `2025 파울러스 연봉규정표` → `{t('paulusSalaryTable')}`
- `내보내기` → `{t('export')}`

---

## 🔄 추가 작업 필요

### 1. FinanceTab.tsx
**하드코딩된 한국어:**
- `월 매출`, `월 지출`, `순이익`, `수익률`
- `vs 전월`
- `계약현황`, `지출 예정`, `지출 세부`

**필요한 번역 키:**
```typescript
monthlyRevenue: '월 매출',
monthlyExpense: '월 지출',
netProfit: '순이익',
profitMargin: '수익률',
vsPreviousMonth: 'vs 전월',
contractStatus: '계약 현황',
upcomingExpenses: '지출 예정',
expenseDetails: '지출 세부',
```

### 2. GeneralAffairsTab.tsx
**하드코딩된 한국어:**
- `자산 관리`, `시설 관리`, `문서 관리`, `계정 관리`, `비품 관리`, `일반 설정`
- 각 항목의 설명 텍스트
- `예정`, `총무 관리 모듈`
- 안내 메시지

**필요한 번역 키:**
```typescript
assetManagement: '자산 관리',
facilityManagement: '시설 관리',
documentManagement: '문서 관리',
accountManagement: '계정 관리',
suppliesManagement: '비품 관리',
generalSettings: '일반 설정',
planned: '예정',
generalAffairsModule: '총무 관리 모듈',
```

### 3. ContractStatusSection.tsx
**하드코딩된 한국어:**
- `1차 (선금)`, `2차 (중도)`, `3차 (잔금)`
- `입금완료`, `연체`, `대기`
- `총 계약금액`, `미수금`, `상태`
- `입금 예정 일정`
- `프로젝트 또는 클라이언트 검색...`
- `날짜순`, `금액순`
- 테이블 헤더: `프로젝트`, `클라이언트`, `진행률`, `회차`, `예정일`, `예정금액`

**필요한 번역 키:**
```typescript
firstInstallmentAdvance: '1차 (선금)',
secondInstallmentMid: '2차 (중도)',
thirdInstallmentFinal: '3차 (잔금)',
received: '입금완료',
overdue: '연체',
pending: '대기',
totalContractAmount: '총 계약금액',
receivables: '미수금',
status: '상태',
upcomingPaymentSchedule: '입금 예정 일정',
searchProjectOrClient: '프로젝트 또는 클라이언트 검색...',
sortByDate: '날짜순',
sortByAmount: '금액순',
project: '프로젝트',
client: '클라이언트',
progress: '진행률',
installment: '회차',
expectedDate: '예정일',
expectedAmount: '예정금액',
```

### 4. ExpenseDetailsSection.tsx
**하드코딩된 텍스트 확인 필요**

### 5. UpcomingExpensesSection.tsx
**하드코딩된 텍스트 확인 필요**

### 6. EmployeeList.tsx
**하드코딩된 텍스트 확인 필요**

### 7. ProductivityTab.tsx
**하드코딩된 텍스트 확인 필요**

### 8. DiligenceTab.tsx
**하드코딩된 텍스트 확인 필요**

---

## 📝 작업 우선순위

### High Priority (즉시 작업 필요)
1. ✅ HumanResourceTab 메인 탭 (완료)
2. ✅ OrganizationChart 헤더 (완료)
3. ✅ SalaryTable 헤더 (완료)
4. ⏳ FinanceTab 메인 통계
5. ⏳ ContractStatusSection 전체

### Medium Priority (다음 단계)
6. ⏳ GeneralAffairsTab 전체
7. ⏳ ExpenseDetailsSection
8. ⏳ UpcomingExpensesSection

### Low Priority (추후 작업)
9. ⏳ EmployeeList 상세
10. ⏳ ProductivityTab 상세
11. ⏳ DiligenceTab 상세

---

## 🎯 다음 단계

1. **FinanceTab.tsx 번역 작업**
   - 통계 카드 레이블
   - 탭 레이블
   - 비교 텍스트

2. **ContractStatusSection.tsx 번역 작업**
   - 입금 단계 텍스트
   - 상태 배지
   - 테이블 헤더
   - 검색 플레이스홀더

3. **GeneralAffairsTab.tsx 번역 작업**
   - 기능 카드 레이블 및 설명
   - 상태 배지
   - 안내 메시지

4. **나머지 컴포넌트 검토**
   - 각 컴포넌트의 하드코딩된 텍스트 확인
   - 필요한 번역 키 추가
   - 컴포넌트 업데이트

---

## 💡 권장사항

1. **일관성 유지**: 동일한 의미의 텍스트는 동일한 번역 키 사용
2. **컨텍스트 고려**: 같은 단어라도 문맥에 따라 다른 번역 키 사용 고려
3. **재사용성**: 공통으로 사용되는 텍스트는 Common 섹션에 추가
4. **테스트**: 각 컴포넌트 업데이트 후 한/영 전환 테스트

---

## 📊 진행 상황

- **완료**: 3/11 컴포넌트 (27%)
- **진행 중**: 0/11 컴포넌트
- **대기 중**: 8/11 컴포넌트 (73%)

**예상 소요 시간**: 약 2-3시간 (나머지 컴포넌트 기준)
