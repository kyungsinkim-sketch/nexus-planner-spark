// Budget System Types

export type ExpenseCategory = 
  | 'STAFF_EQUIPMENT'   // 스텝 인건비 / 장비
  | 'PRODUCTION'        // 제작비
  | 'TALENT'            // 출연료
  | 'POST_PRODUCTION'   // 후반
  | 'EQUIPMENT'         // 장비/비품
  | 'OUTSOURCING'       // 외주제작
  | 'MISCELLANEOUS';    // 기타

export type ExpenseStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export type PaymentType = 
  | 'TAX_INVOICE'      // 세금계산서 (외주비)
  | 'WITHHOLDING'      // 원천징수 (용역비)
  | 'CORPORATE_CARD'   // 법인카드
  | 'CORPORATE_CASH'   // 법인현금
  | 'PERSONAL_EXPENSE'; // 개인지출

export type PaymentStatus = 'PENDING' | 'INVOICE_ISSUED' | 'PAYMENT_COMPLETE';

// 프로젝트 개요 및 요약
export interface BudgetSummary {
  id: string;
  projectId: string;
  companyName: string;        // 업체명
  contractName: string;       // 계약명
  department: string;         // 담당부서
  author: string;             // 작성자
  shootingDate?: string;      // 촬영예정일
  phase: string;              // 진행단계 (기획/촬영/후반편집 등)
  
  // 금액 정보
  totalContractAmount: number;     // 총 계약금액 (VAT 미포함)
  vatAmount: number;               // 부가세
  totalWithVat: number;            // 총 공급가액 (VAT 포함)
  
  targetExpenseWithVat: number;    // 목표지출비용 (VAT 포함)
  targetProfitWithVat: number;     // 목표수익 (VAT 포함)
  
  actualExpenseWithVat: number;    // 실제지출 (VAT 포함)
  actualProfitWithVat: number;     // 실제수익 (VAT 포함)
  
  actualExpenseWithoutVat: number; // 실제지출 (VAT 미포함)
  actualProfitWithoutVat: number;  // 실제수익 (VAT 미포함)
}

// 입금 정보
export interface PaymentSchedule {
  id: string;
  projectId: string;
  installment: string;     // 1차(선금), 2차(중도), 3차(잔액), etc.
  expectedAmount: number;  // 예정금액
  expectedDate?: string;   // 지급 예정일
  actualAmount: number;    // 실입금액
  balance: number;         // 잔액
}

// 계정별 예산 항목
export interface BudgetLineItem {
  id: string;
  projectId: string;
  orderNo: number;
  completed: boolean;
  category: ExpenseCategory;
  mainCategory: string;    // 대분류 (촬영, 조명, 미술, 의상 등)
  subCategory: string;     // 소분류 (촬영감독, 촬영팀 인건비 등)
  targetUnitPrice: number; // 목표단가
  quantity: number;        // 회/식/수
  targetExpense: number;   // 목표지출액
  vatRate: number;         // 부가세율 (0.1 = 10%)
  targetExpenseWithVat: number; // 목표지출합계
  actualExpenseWithVat: number; // 실지출액 (VAT 포함)
  paymentMethod?: string;  // 지급방식 (세금/용역/카드)
  paymentTiming?: string;  // 지급시기
  note?: string;           // 비고
  variance: number;        // 계획대비차액
}

// 세금계산서 (외주비)
export interface TaxInvoice {
  id: string;
  projectId: string;
  orderNo: number;
  paymentDueDate?: string;    // 입금약일
  description: string;         // 내용
  supplyAmount: number;        // 공급가 (세전)
  taxAmount: number;           // 세액
  totalAmount: number;         // 총액 (VAT 포함)
  companyName: string;         // 회사명 / 대표자
  businessNumber: string;      // 사업자번호
  bank?: string;               // 은행
  accountNumber?: string;      // 계좌번호
  status: PaymentStatus;       // 진행단계
  issueDate?: string;          // 발행일자
  paymentDate?: string;        // 입금일자
  note?: string;               // 비고
}

// 용역비 (원천징수)
export interface WithholdingPayment {
  id: string;
  projectId: string;
  orderNo: number;
  paymentDueDate?: string;     // 입금약일
  personName: string;          // 이름
  role: string;                // 역할
  amount: number;              // 사용액
  withholdingTax: number;      // 세액 (3.3%)
  totalAmount: number;         // 사용총액
  companyName?: string;        // 회사명 / 대표자
  businessNumber?: string;     // 사업자번호
  status: PaymentStatus;       // 진행단계
  issueDate?: string;          // 발행일자
  paymentDate?: string;        // 입금일자
  note?: string;               // 비고
}

// 법인카드 사용 내역
export interface CorporateCardExpense {
  id: string;
  projectId: string;
  orderNo: number;
  cardHolder: string;          // 사용법인카드 (소유자)
  receiptSubmitted: boolean;   // 영수증제출
  usageDate: string;           // 사용날짜
  description: string;         // 사용내용
  usedBy: string;              // 사용자
  amountWithVat: number;       // 사용액 (VAT 포함)
  amountUsd?: number;          // USD (해외결제 시)
  vendor: string;              // 거래처명
  note?: string;               // 비고
}

// 법인현금 사용 내역
export interface CorporateCashExpense {
  id: string;
  projectId: string;
  orderNo: number;
  receiptSubmitted: boolean;   // 영수증제출
  usageDate: string;           // 사용날짜
  description: string;         // 사용내용
  usedBy: string;              // 사용자
  amountWithVat: number;       // 사용액 (VAT 포함)
  vendor: string;              // 거래처명
  note?: string;               // 비고
}

// 개인지출 내역
export interface PersonalExpense {
  id: string;
  projectId: string;
  orderNo: number;
  paymentMethod: string;       // 지출방식
  receiptSubmitted: boolean;   // 영수증제출
  reimbursementStatus: PaymentStatus; // 지출자지급단계
  usageDate: string;           // 사용날짜
  description: string;         // 사용내용
  usedBy: string;              // 사용자
  amountWithVat: number;       // 사용액 (VAT 포함)
  vendor: string;              // 거래처명
  note?: string;               // 비고
}

// 전체 프로젝트 예산 데이터
export interface ProjectBudget {
  summary: BudgetSummary;
  paymentSchedules: PaymentSchedule[];
  lineItems: BudgetLineItem[];
  taxInvoices: TaxInvoice[];
  withholdingPayments: WithholdingPayment[];
  corporateCardExpenses: CorporateCardExpense[];
  corporateCashExpenses: CorporateCashExpense[];
  personalExpenses: PersonalExpense[];
}
