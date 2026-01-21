import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Plus,
  FileText,
  Download,
  Receipt,
  CreditCard,
  Wallet,
  Building2,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { VendorAutocomplete, VendorInfo } from '@/components/ui/vendor-autocomplete';
import { toast } from 'sonner';
import type {
  ProjectBudget,
  BudgetLineItem,
  TaxInvoice,
  WithholdingPayment,
  CorporateCardExpense,
  CorporateCashExpense,
  PersonalExpense,
  PaymentStatus,
  ExpenseCategory,
} from '@/types/budget';

interface BudgetTabProps {
  projectId: string;
}

// Budget category options based on Excel structure
const BUDGET_CATEGORIES = [
  { value: 'STAFF_EQUIPMENT', label: '스텝 인건비 / 장비', subCategories: ['촬영', '조명', '미술', '의상', '분장', '동시녹음'] },
  { value: 'PRODUCTION', label: '제작비', subCategories: ['로케이션', '차량', '교통비', '식사', '진행비'] },
  { value: 'TALENT', label: '출연료', subCategories: ['주연', '조연', '보조출연', '이미지'] },
  { value: 'POST_PRODUCTION', label: '후반', subCategories: ['2D', '3D', '녹음', 'CG', '편집'] },
  { value: 'EQUIPMENT', label: '장비/비품', subCategories: ['촬영장비', '조명장비', '음향장비', '기타비품'] },
  { value: 'OUTSOURCING', label: '외주제작', subCategories: ['키링제작', '앵커제작', '모듈구매', '디자인/개발'] },
];

const PAYMENT_METHODS = [
  { value: 'tax_invoice', label: '세금계산서' },
  { value: 'withholding', label: '원천징수 (용역)' },
  { value: 'corporate_card', label: '법인카드' },
  { value: 'corporate_cash', label: '법인현금' },
  { value: 'personal', label: '개인지출' },
];

// Mock budget data based on actual Excel structure (현대 UWB 캠페인 예산안)
const mockBudgetData: ProjectBudget = {
  summary: {
    id: 'budget-1',
    projectId: 'p1',
    companyName: '현대자동차그룹',
    contractName: '[UWB 정밀 위치추정기술] 어린이집 통학차량 안전 시스템 시범 운영 캠페인',
    department: '영상제작사업부',
    author: '박민규',
    shootingDate: '2025-11-08',
    phase: '후반편집',
    totalContractAmount: 283690000,
    vatAmount: 28369000,
    totalWithVat: 312059000,
    targetExpenseWithVat: 97260000,
    targetProfitWithVat: 186430000,
    actualExpenseWithVat: 95085351,
    actualProfitWithVat: 186430000,
    actualExpenseWithoutVat: 86441228,
    actualProfitWithoutVat: 186430000,
  },
  paymentSchedules: [
    { id: 'ps-1', projectId: 'p1', installment: '1차(선금)', expectedAmount: 0, expectedDate: '', actualAmount: 0, balance: 312059000 },
    { id: 'ps-2', projectId: 'p1', installment: '2차(중도)', expectedAmount: 0, expectedDate: '', actualAmount: 0, balance: 312059000 },
    { id: 'ps-3', projectId: 'p1', installment: '3차(잔액)', expectedAmount: 0, expectedDate: '', actualAmount: 0, balance: 312059000 },
  ],
  lineItems: [
    // 스텝 인건비 / 장비 - 촬영
    { id: 'li-1', projectId: 'p1', orderNo: 1, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '촬영감독 (DOP)', targetUnitPrice: 1500000, quantity: 2, targetExpense: 3000000, vatRate: 0.1, targetExpenseWithVat: 3000000, actualExpenseWithVat: 4500000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: -1500000 },
    { id: 'li-2', projectId: 'p1', orderNo: 2, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '헌팅차지', targetUnitPrice: 750000, quantity: 1, targetExpense: 750000, vatRate: 0.1, targetExpenseWithVat: 750000, actualExpenseWithVat: 0, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 750000 },
    { id: 'li-3', projectId: 'p1', orderNo: 3, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '촬영팀 인건비', targetUnitPrice: 1600000, quantity: 2, targetExpense: 3200000, vatRate: 0.1, targetExpenseWithVat: 3200000, actualExpenseWithVat: 4996400, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: -1796400 },
    { id: 'li-4', projectId: 'p1', orderNo: 4, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '카메라봉고', targetUnitPrice: 400000, quantity: 2, targetExpense: 800000, vatRate: 0.1, targetExpenseWithVat: 800000, actualExpenseWithVat: 0, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: 800000 },
    { id: 'li-5', projectId: 'p1', orderNo: 5, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '촬영 장비', targetUnitPrice: 1200000, quantity: 2, targetExpense: 2400000, vatRate: 0.1, targetExpenseWithVat: 2400000, actualExpenseWithVat: 2123000, paymentMethod: 'corporate_card', paymentTiming: '2월말', note: '', variance: 277000 },
    // 스텝 인건비 / 장비 - 조명
    { id: 'li-6', projectId: 'p1', orderNo: 6, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '조명', subCategory: '조명팀 인건비', targetUnitPrice: 1600000, quantity: 2, targetExpense: 3200000, vatRate: 0.1, targetExpenseWithVat: 3200000, actualExpenseWithVat: 3250000, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: -50000 },
    { id: 'li-7', projectId: 'p1', orderNo: 7, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '조명', subCategory: '조명탑차', targetUnitPrice: 400000, quantity: 2, targetExpense: 800000, vatRate: 0.1, targetExpenseWithVat: 800000, actualExpenseWithVat: 4250000, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: -3450000 },
    { id: 'li-8', projectId: 'p1', orderNo: 8, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '조명', subCategory: '조명장비', targetUnitPrice: 1200000, quantity: 2, targetExpense: 2400000, vatRate: 0.1, targetExpenseWithVat: 2400000, actualExpenseWithVat: 0, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: 2400000 },
    // 스텝 인건비 / 장비 - 미술
    { id: 'li-9', projectId: 'p1', orderNo: 9, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '미술', subCategory: '미술 인건비', targetUnitPrice: 4700000, quantity: 1, targetExpense: 4700000, vatRate: 0.1, targetExpenseWithVat: 4700000, actualExpenseWithVat: 8200000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: -3500000 },
    { id: 'li-10', projectId: 'p1', orderNo: 10, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '미술', subCategory: '미술 재료비', targetUnitPrice: 3500000, quantity: 1, targetExpense: 3500000, vatRate: 0.1, targetExpenseWithVat: 3500000, actualExpenseWithVat: 3300000, paymentMethod: 'tax_invoice', paymentTiming: '11월초', note: '', variance: 200000 },
    // 스텝 인건비 / 장비 - 의상
    { id: 'li-11', projectId: 'p1', orderNo: 11, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '의상', subCategory: '의상 인건비', targetUnitPrice: 2000000, quantity: 1, targetExpense: 2000000, vatRate: 0.1, targetExpenseWithVat: 2000000, actualExpenseWithVat: 2000000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 0 },
    { id: 'li-12', projectId: 'p1', orderNo: 12, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '의상', subCategory: '의상 재료비 (카드)', targetUnitPrice: 1500000, quantity: 1, targetExpense: 1500000, vatRate: 0.1, targetExpenseWithVat: 1500000, actualExpenseWithVat: 1509780, paymentMethod: 'corporate_card', paymentTiming: '11월초', note: '쿠팡 - 법카로 결제', variance: -9780 },
    { id: 'li-13', projectId: 'p1', orderNo: 13, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '의상', subCategory: '의상 재료비 (현금)', targetUnitPrice: 500000, quantity: 1, targetExpense: 500000, vatRate: 0.1, targetExpenseWithVat: 500000, actualExpenseWithVat: 550000, paymentMethod: 'tax_invoice', paymentTiming: '11월 5일', note: '', variance: -50000 },
    // 스텝 인건비 / 장비 - 분장, 동시녹음
    { id: 'li-14', projectId: 'p1', orderNo: 14, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '분장', subCategory: '분장 인건비', targetUnitPrice: 800000, quantity: 2, targetExpense: 1600000, vatRate: 0.1, targetExpenseWithVat: 1600000, actualExpenseWithVat: 1600000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 0 },
    { id: 'li-15', projectId: 'p1', orderNo: 15, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '동시녹음', subCategory: '인건비(장비 포함)', targetUnitPrice: 1200000, quantity: 2, targetExpense: 2400000, vatRate: 0.1, targetExpenseWithVat: 2400000, actualExpenseWithVat: 2400000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 0 },
    // 제작비
    { id: 'li-16', projectId: 'p1', orderNo: 16, completed: false, category: 'PRODUCTION', mainCategory: '로케이션', subCategory: '유치원 섭외비', targetUnitPrice: 2000000, quantity: 1, targetExpense: 2000000, vatRate: 0.1, targetExpenseWithVat: 2000000, actualExpenseWithVat: 2000000, paymentMethod: 'tax_invoice', paymentTiming: '11월 10일', note: '', variance: 0 },
    { id: 'li-17', projectId: 'p1', orderNo: 17, completed: false, category: 'PRODUCTION', mainCategory: '로케이션', subCategory: '집', targetUnitPrice: 2500000, quantity: 1, targetExpense: 2500000, vatRate: 0.1, targetExpenseWithVat: 2500000, actualExpenseWithVat: 2872728, paymentMethod: 'tax_invoice', paymentTiming: '11월 7일', note: '세발 2건', variance: -372728 },
    { id: 'li-18', projectId: 'p1', orderNo: 18, completed: false, category: 'PRODUCTION', mainCategory: '차량', subCategory: '차량 렌탈', targetUnitPrice: 800000, quantity: 1, targetExpense: 800000, vatRate: 0.1, targetExpenseWithVat: 800000, actualExpenseWithVat: 800000, paymentMethod: 'tax_invoice', paymentTiming: '11월 10일', note: '', variance: 0 },
    { id: 'li-19', projectId: 'p1', orderNo: 19, completed: false, category: 'PRODUCTION', mainCategory: '차량', subCategory: '차량 앵커 시공', targetUnitPrice: 250000, quantity: 2, targetExpense: 500000, vatRate: 0.1, targetExpenseWithVat: 500000, actualExpenseWithVat: 250000, paymentMethod: 'tax_invoice', paymentTiming: '11월 5일', note: '세발 2건', variance: 250000 },
    { id: 'li-20', projectId: 'p1', orderNo: 20, completed: false, category: 'PRODUCTION', mainCategory: '교통비', subCategory: '유대 / 택시비 / 주차비 등', targetUnitPrice: 200000, quantity: 1, targetExpense: 200000, vatRate: 0.1, targetExpenseWithVat: 200000, actualExpenseWithVat: 353198, paymentMethod: 'corporate_card', paymentTiming: '11월초', note: '', variance: -153198 },
    { id: 'li-21', projectId: 'p1', orderNo: 21, completed: false, category: 'PRODUCTION', mainCategory: '식사', subCategory: '3끼 * 2회차 * 35명', targetUnitPrice: 30000, quantity: 70, targetExpense: 2100000, vatRate: 0.1, targetExpenseWithVat: 2100000, actualExpenseWithVat: 3197470, paymentMethod: 'corporate_card', paymentTiming: '11월초', note: '', variance: -1097470 },
    { id: 'li-22', projectId: 'p1', orderNo: 22, completed: false, category: 'PRODUCTION', mainCategory: '식사', subCategory: '야식 & 부식', targetUnitPrice: 10000, quantity: 70, targetExpense: 700000, vatRate: 0.1, targetExpenseWithVat: 700000, actualExpenseWithVat: 0, paymentMethod: 'corporate_card', paymentTiming: '11월초', note: '', variance: 700000 },
    { id: 'li-23', projectId: 'p1', orderNo: 23, completed: false, category: 'PRODUCTION', mainCategory: '진행비', subCategory: '연출비품', targetUnitPrice: 200000, quantity: 1, targetExpense: 200000, vatRate: 0.1, targetExpenseWithVat: 200000, actualExpenseWithVat: 931410, paymentMethod: 'corporate_card', paymentTiming: '11월초', note: '', variance: -731410 },
    // 출연료
    { id: 'li-24', projectId: 'p1', orderNo: 24, completed: false, category: 'TALENT', mainCategory: '출연료', subCategory: '주연 (운전기사 / 어린이)', targetUnitPrice: 2000000, quantity: 2, targetExpense: 4000000, vatRate: 0.1, targetExpenseWithVat: 4000000, actualExpenseWithVat: 4000000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 0 },
    { id: 'li-25', projectId: 'p1', orderNo: 25, completed: false, category: 'TALENT', mainCategory: '출연료', subCategory: '조연 (엄마)', targetUnitPrice: 1500000, quantity: 1, targetExpense: 1500000, vatRate: 0.1, targetExpenseWithVat: 1500000, actualExpenseWithVat: 1500000, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: 0 },
    { id: 'li-26', projectId: 'p1', orderNo: 26, completed: false, category: 'TALENT', mainCategory: '출연료', subCategory: '이미지 (어린이) * 2회차', targetUnitPrice: 500000, quantity: 6, targetExpense: 3000000, vatRate: 0.1, targetExpenseWithVat: 3000000, actualExpenseWithVat: 3260000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: -260000 },
    { id: 'li-27', projectId: 'p1', orderNo: 27, completed: false, category: 'TALENT', mainCategory: '출연료', subCategory: '보조출연 (어린이) * 2회차', targetUnitPrice: 200000, quantity: 14, targetExpense: 2800000, vatRate: 0.1, targetExpenseWithVat: 2800000, actualExpenseWithVat: 0, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 2800000 },
    // 후반
    { id: 'li-28', projectId: 'p1', orderNo: 28, completed: false, category: 'POST_PRODUCTION', mainCategory: '2D', subCategory: '자막 / 2D컷 제작', targetUnitPrice: 5000000, quantity: 1, targetExpense: 5000000, vatRate: 0.1, targetExpenseWithVat: 5000000, actualExpenseWithVat: 4500000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 500000 },
    { id: 'li-29', projectId: 'p1', orderNo: 29, completed: false, category: 'POST_PRODUCTION', mainCategory: '녹음', subCategory: '녹음비', targetUnitPrice: 1200000, quantity: 1, targetExpense: 1200000, vatRate: 0.1, targetExpenseWithVat: 1200000, actualExpenseWithVat: 0, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 1200000 },
    { id: 'li-30', projectId: 'p1', orderNo: 30, completed: false, category: 'POST_PRODUCTION', mainCategory: '녹음', subCategory: '성우', targetUnitPrice: 400000, quantity: 1, targetExpense: 400000, vatRate: 0.1, targetExpenseWithVat: 400000, actualExpenseWithVat: 0, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 400000 },
    // 외주제작 - 키링/앵커
    { id: 'li-31', projectId: 'p1', orderNo: 31, completed: false, category: 'OUTSOURCING', mainCategory: '키링/앵커제작비', subCategory: 'UWB 모듈 구매', targetUnitPrice: 42000, quantity: 120, targetExpense: 5040000, vatRate: 0.1, targetExpenseWithVat: 5040000, actualExpenseWithVat: 6541365, paymentMethod: 'corporate_card', paymentTiming: '9월말', note: '', variance: -1501365 },
    { id: 'li-32', projectId: 'p1', orderNo: 32, completed: false, category: 'OUTSOURCING', mainCategory: '키링/앵커제작비', subCategory: '디자인, 개발, 샘플', targetUnitPrice: 12900000, quantity: 1, targetExpense: 12900000, vatRate: 0.1, targetExpenseWithVat: 12900000, actualExpenseWithVat: 12900000, paymentMethod: 'tax_invoice', paymentTiming: '12월말', note: '', variance: 0 },
    { id: 'li-33', projectId: 'p1', orderNo: 33, completed: false, category: 'OUTSOURCING', mainCategory: '키링/앵커제작비', subCategory: '키링', targetUnitPrice: 120000, quantity: 120, targetExpense: 14400000, vatRate: 0.1, targetExpenseWithVat: 14400000, actualExpenseWithVat: 14400000, paymentMethod: 'tax_invoice', paymentTiming: '11월말', note: '선금 지급 완료', variance: 0 },
    { id: 'li-34', projectId: 'p1', orderNo: 34, completed: false, category: 'OUTSOURCING', mainCategory: '키링/앵커제작비', subCategory: '앵커', targetUnitPrice: 220000, quantity: 10, targetExpense: 2200000, vatRate: 0.1, targetExpenseWithVat: 2200000, actualExpenseWithVat: 2200000, paymentMethod: 'tax_invoice', paymentTiming: '', note: '', variance: 0 },
  ],
  taxInvoices: [
    { id: 'ti-1', projectId: 'p1', orderNo: 1, paymentDueDate: '25. 7. 28.', description: '키링제작 선금', supplyAmount: 20650000, taxAmount: 2065000, totalAmount: 22715000, companyName: '(주)블루베리 / 박정규', businessNumber: '819-86-00960', bank: '기업', accountNumber: '124-108385-01-027', status: 'PAYMENT_COMPLETE', issueDate: '2025-07-25', paymentDate: '2025-07-28' },
    { id: 'ti-2', projectId: 'p1', orderNo: 2, paymentDueDate: '25. 12. 31.', description: '키링제작 잔금', supplyAmount: 8850000, taxAmount: 885000, totalAmount: 9735000, companyName: '(주)블루베리 / 박정규', businessNumber: '819-86-00960', bank: '기업', accountNumber: '124-108385-01-027', status: 'PAYMENT_COMPLETE', issueDate: '2025-12-05', paymentDate: '2025-12-31' },
    { id: 'ti-3', projectId: 'p1', orderNo: 3, paymentDueDate: '25. 10. 20.', description: '키링 모듈 해외직구 관세', supplyAmount: 205120, taxAmount: 276920, totalAmount: 482040, companyName: '인천공항세관', businessNumber: '109-83-02763', bank: '-', accountNumber: '-', status: 'PAYMENT_COMPLETE', issueDate: '2025-10-17', paymentDate: '2025-10-20', note: '은행대납' },
    { id: 'ti-4', projectId: 'p1', orderNo: 4, paymentDueDate: '25.11.5', description: '앵커 시공비', supplyAmount: 227273, taxAmount: 22727, totalAmount: 250000, companyName: '포이보스/오영훈', businessNumber: '124-52-14959', bank: '우리', accountNumber: '1002-543-116314', status: 'PAYMENT_COMPLETE', issueDate: '2025-11-05', paymentDate: '2025-11-05' },
    { id: 'ti-5', projectId: 'p1', orderNo: 5, paymentDueDate: '25.11.10', description: '소품카 렌탈', supplyAmount: 800000, taxAmount: 80000, totalAmount: 880000, companyName: '(주)상일투어/김상귀', businessNumber: '141-81-11753', bank: '기업', accountNumber: '355-0006-4724-73', status: 'PAYMENT_COMPLETE', issueDate: '2025-11-05', paymentDate: '2025-11-10' },
  ],
  withholdingPayments: [
    { id: 'wp-1', projectId: 'p1', orderNo: 1, paymentDueDate: '26.2.27', personName: '한혜지', role: '배우(엄마)', amount: 1500000, withholdingTax: 49500, totalAmount: 1450500, status: 'PENDING' },
    { id: 'wp-2', projectId: 'p1', orderNo: 2, paymentDueDate: '26.2.27', personName: '한승희', role: '촬영팀', amount: 1816400, withholdingTax: 59941, totalAmount: 1756459, status: 'PENDING' },
    { id: 'wp-3', projectId: 'p1', orderNo: 3, paymentDueDate: '26.2.27', personName: '이은석', role: '촬영팀', amount: 1030000, withholdingTax: 33990, totalAmount: 996010, status: 'PENDING' },
    { id: 'wp-4', projectId: 'p1', orderNo: 4, paymentDueDate: '26.2.27', personName: '김용구', role: '조명감독', amount: 2250000, withholdingTax: 74250, totalAmount: 2175750, status: 'PENDING' },
  ],
  corporateCardExpenses: [
    { id: 'cc-1', projectId: 'p1', orderNo: 1, cardHolder: '법인카드', receiptSubmitted: true, usageDate: '2025-09-25', description: 'UWB 모듈 해외직구', usedBy: '담당자', amountWithVat: 6541365, vendor: '알리익스프레스', note: '120개' },
    { id: 'cc-2', projectId: 'p1', orderNo: 2, cardHolder: '법인카드', receiptSubmitted: true, usageDate: '2025-11-05', description: '의상 재료비', usedBy: '의상팀', amountWithVat: 1509780, vendor: '쿠팡', note: '' },
    { id: 'cc-3', projectId: 'p1', orderNo: 3, cardHolder: '법인카드', receiptSubmitted: true, usageDate: '2025-11-08', description: '촬영 장비 렌탈', usedBy: '촬영팀', amountWithVat: 2123000, vendor: '장비대여업체', note: '' },
  ],
  corporateCashExpenses: [],
  personalExpenses: [],
};

export function BudgetTab({ projectId }: BudgetTabProps) {
  const { t, language } = useTranslation();
  const [budget, setBudget] = useState<ProjectBudget>(mockBudgetData);
  const [activeTab, setActiveTab] = useState<'budget_plan' | 'actual_expense'>('budget_plan');
  const [expenseTab, setExpenseTab] = useState<'tax_invoice' | 'withholding' | 'corporate_card' | 'corporate_cash' | 'personal'>('tax_invoice');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddLineItemModal, setShowAddLineItemModal] = useState(false);
  const [expenseType, setExpenseType] = useState<'tax_invoice' | 'withholding' | 'corporate_card' | 'corporate_cash' | 'personal'>('corporate_card');
  
  // Editable contract amount states
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [editContractAmount, setEditContractAmount] = useState(budget.summary.totalContractAmount);

  // Line item form state
  const [lineItemForm, setLineItemForm] = useState({
    category: 'STAFF_EQUIPMENT' as ExpenseCategory,
    mainCategory: '',
    subCategory: '',
    targetUnitPrice: 0,
    quantity: 1,
    paymentMethod: 'tax_invoice',
    paymentTiming: '',
    note: '',
  });

  // Form state for expense modal
  const [formData, setFormData] = useState({
    // Tax Invoice / Withholding common
    companyName: '',
    representative: '',
    businessNumber: '',
    bank: '',
    accountNumber: '',
    role: '',
    // Freelancer name
    personName: '',
    // Vendor for card/cash
    vendorName: '',
  });

  // Handle vendor selection and auto-fill
  const handleVendorSelect = (vendor: VendorInfo) => {
    setFormData(prev => ({
      ...prev,
      companyName: vendor.name,
      representative: vendor.representative || '',
      businessNumber: vendor.businessNumber || '',
      bank: vendor.bank || '',
      accountNumber: vendor.accountNumber || '',
      role: vendor.role || '',
      personName: vendor.name,
      vendorName: vendor.name,
    }));
    
    toast.success('거래처 정보 자동입력 완료', {
      description: `${vendor.name}의 정보가 자동으로 입력되었습니다.`,
      icon: <Sparkles className="w-4 h-4" />,
    });
  };

  // Add new line item to budget plan
  const handleAddLineItem = () => {
    const targetExpense = lineItemForm.targetUnitPrice * lineItemForm.quantity;
    const targetExpenseWithVat = targetExpense; // VAT 별도 계산 시 수정
    
    const newItem: BudgetLineItem = {
      id: `li-${Date.now()}`,
      projectId,
      orderNo: budget.lineItems.length + 1,
      completed: false,
      category: lineItemForm.category,
      mainCategory: lineItemForm.mainCategory,
      subCategory: lineItemForm.subCategory,
      targetUnitPrice: lineItemForm.targetUnitPrice,
      quantity: lineItemForm.quantity,
      targetExpense,
      vatRate: 0.1,
      targetExpenseWithVat,
      actualExpenseWithVat: 0,
      paymentMethod: lineItemForm.paymentMethod,
      paymentTiming: lineItemForm.paymentTiming,
      note: lineItemForm.note,
      variance: targetExpenseWithVat,
    };

    setBudget(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem],
      summary: {
        ...prev.summary,
        targetExpenseWithVat: prev.summary.targetExpenseWithVat + targetExpenseWithVat,
      }
    }));

    setShowAddLineItemModal(false);
    setLineItemForm({
      category: 'STAFF_EQUIPMENT',
      mainCategory: '',
      subCategory: '',
      targetUnitPrice: 0,
      quantity: 1,
      paymentMethod: 'tax_invoice',
      paymentTiming: '',
      note: '',
    });
    
    toast.success('예산 항목이 추가되었습니다.');
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!showAddExpenseModal) {
      setFormData({
        companyName: '',
        representative: '',
        businessNumber: '',
        bank: '',
        accountNumber: '',
        role: '',
        personName: '',
        vendorName: '',
      });
    }
  }, [showAddExpenseModal]);

  const { summary, paymentSchedules, lineItems, taxInvoices, withholdingPayments, corporateCardExpenses } = budget;

  // Group line items by category for display
  const groupedLineItems = lineItems.reduce((acc, item) => {
    const key = `${item.category}-${item.mainCategory}`;
    if (!acc[key]) {
      acc[key] = {
        category: item.category,
        mainCategory: item.mainCategory,
        items: [],
      };
    }
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { category: ExpenseCategory; mainCategory: string; items: BudgetLineItem[] }>);

  // Calculate totals
  const totalTargetExpense = lineItems.reduce((sum, item) => sum + item.targetExpenseWithVat, 0);
  const totalActualExpense = lineItems.reduce((sum, item) => sum + item.actualExpenseWithVat, 0);
  const totalVariance = lineItems.reduce((sum, item) => sum + item.variance, 0);
  const achievementRate = totalTargetExpense > 0 ? ((totalActualExpense / totalTargetExpense) * 100).toFixed(1) : '0';
  const profitRate = summary.totalWithVat > 0 ? ((summary.actualProfitWithVat / summary.totalWithVat) * 100).toFixed(2) : '0';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === '미정') return dateString || '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: 'numeric',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'PAYMENT_COMPLETE':
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" />입금완료</Badge>;
      case 'INVOICE_ISSUED':
        return <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" />계산서발행</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3 mr-1" />대기중</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Contract Amount - Editable */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">총 계약금액</p>
              {isEditingContract ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="text"
                    value={editContractAmount.toLocaleString('ko-KR')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setEditContractAmount(Number(value) || 0);
                    }}
                    className="h-8 text-lg font-semibold w-full"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const vatAmount = editContractAmount * 0.1;
                        setBudget(prev => ({
                          ...prev,
                          summary: {
                            ...prev.summary,
                            totalContractAmount: editContractAmount,
                            vatAmount: vatAmount,
                            totalWithVat: editContractAmount + vatAmount,
                          }
                        }));
                        setIsEditingContract(false);
                        toast.success('계약금액이 수정되었습니다.');
                      }
                      if (e.key === 'Escape') {
                        setEditContractAmount(budget.summary.totalContractAmount);
                        setIsEditingContract(false);
                      }
                    }}
                    onBlur={() => {
                      const vatAmount = editContractAmount * 0.1;
                      setBudget(prev => ({
                        ...prev,
                        summary: {
                          ...prev.summary,
                          totalContractAmount: editContractAmount,
                          vatAmount: vatAmount,
                          totalWithVat: editContractAmount + vatAmount,
                        }
                      }));
                      setIsEditingContract(false);
                      toast.success('계약금액이 수정되었습니다.');
                    }}
                  />
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditingContract(true)}
                  className="text-left hover:bg-muted/50 rounded px-1 -mx-1 transition-colors w-full"
                >
                  <p className="text-xl font-semibold text-foreground">
                    {formatCurrency(summary.totalWithVat)}
                  </p>
                  <p className="text-xs text-muted-foreground">VAT 포함 (클릭하여 수정)</p>
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Target Expense - Clickable to Budget Plan */}
        <Card 
          className="p-5 shadow-card cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300"
          onClick={() => setActiveTab('budget_plan')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">목표지출비용</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(summary.targetExpenseWithVat)}
              </p>
              <p className="text-xs text-blue-600">
                {((summary.targetExpenseWithVat / summary.totalWithVat) * 100).toFixed(1)}% → 예산계획 보기
              </p>
            </div>
          </div>
        </Card>

        {/* Actual Expense - Clickable to Actual Expense tabs */}
        <Card 
          className="p-5 shadow-card cursor-pointer hover:shadow-md transition-shadow hover:border-orange-300"
          onClick={() => setActiveTab('actual_expense')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">실제지출</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(summary.actualExpenseWithVat)}
              </p>
              <p className="text-xs text-orange-600">
                {((summary.actualExpenseWithVat / summary.totalWithVat) * 100).toFixed(2)}% → 지출내역 보기
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">실제수익</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(summary.actualProfitWithVat)}
              </p>
              <p className="text-xs text-emerald-600 font-medium">
                {profitRate}% 수익률
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">예산 달성률</h3>
            <p className="text-sm text-muted-foreground">목표 대비 실제 지출 현황</p>
          </div>
          <div className="text-right">
            <Badge variant={Number(achievementRate) > 100 ? 'destructive' : Number(achievementRate) > 80 ? 'secondary' : 'default'}>
              {achievementRate}% 사용
            </Badge>
            <p className="text-sm text-emerald-600 mt-1">
              {formatCurrency(totalVariance)} 절감
            </p>
          </div>
        </div>
        <Progress value={Number(achievementRate)} className="h-3" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>실지출: {formatCurrency(totalActualExpense)}</span>
          <span>목표: {formatCurrency(totalTargetExpense)}</span>
        </div>
      </Card>

      {/* Main Section Toggle */}
      <div className="flex items-center gap-4 border-b">
        <button
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'budget_plan' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('budget_plan')}
        >
          예산 계획
        </button>
        <button
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'actual_expense' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('actual_expense')}
        >
          실제 지출
        </button>
      </div>

      {/* Budget Plan Section */}
      {activeTab === 'budget_plan' && (
        <Card className="shadow-card">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-semibold">예산 계획표</h3>
              <p className="text-sm text-muted-foreground">프로젝트 지출 계획을 수립합니다</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                내보내기
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setShowAddLineItemModal(true)}>
                <Plus className="w-4 h-4" />
                항목 추가
              </Button>
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>대분류</TableHead>
                  <TableHead>소분류</TableHead>
                  <TableHead className="text-right">목표단가</TableHead>
                  <TableHead className="text-center">수량</TableHead>
                  <TableHead className="text-right">목표지출합계</TableHead>
                  <TableHead>지급 시기</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Group items by mainCategory
                  const groupedItems = lineItems.reduce((acc, item) => {
                    const key = item.mainCategory;
                    if (!acc[key]) {
                      acc[key] = [];
                    }
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, typeof lineItems>);

                  // Render grouped items
                  return Object.entries(groupedItems).map(([category, items], groupIndex) => {
                    const categoryTotal = items.reduce((sum, item) => sum + item.targetExpenseWithVat, 0);
                    return (
                      <>
                        {/* Category Header Row */}
                        <TableRow key={`header-${category}`} className="bg-muted/30">
                          <TableCell colSpan={5} className="font-semibold text-foreground">
                            {category}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatCurrency(categoryTotal)}
                          </TableCell>
                          <TableCell colSpan={2}></TableCell>
                        </TableRow>
                        {/* Category Items */}
                        {items.map((item, itemIndex) => (
                          <TableRow key={item.id} className="hover:bg-muted/10">
                            <TableCell className="text-muted-foreground">{groupIndex + 1}-{itemIndex + 1}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="max-w-[200px]">{item.subCategory}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.targetUnitPrice)}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.targetExpenseWithVat)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{item.paymentTiming || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-muted-foreground text-sm">{item.note}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  });
                })()}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell colSpan={5} className="text-right">총 합계</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalTargetExpense)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Actual Expense Section */}
      {activeTab === 'actual_expense' && (
        <div className="space-y-4">
          {/* Expense Type Tabs */}
          <Tabs value={expenseTab} onValueChange={(val) => setExpenseTab(val as typeof expenseTab)}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="tax_invoice" className="gap-2">
                  <FileText className="w-4 h-4" />
                  세금계산서
                </TabsTrigger>
                <TabsTrigger value="withholding" className="gap-2">
                  <User className="w-4 h-4" />
                  원천징수
                </TabsTrigger>
                <TabsTrigger value="corporate_card" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  법인카드
                </TabsTrigger>
                <TabsTrigger value="corporate_cash" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  법인현금
                </TabsTrigger>
                <TabsTrigger value="personal" className="gap-2">
                  <Wallet className="w-4 h-4" />
                  개인지출
                </TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  내보내기
                </Button>
                <Button size="sm" className="gap-2" onClick={() => {
                  setExpenseType(expenseTab);
                  setShowAddExpenseModal(true);
                }}>
                  <Plus className="w-4 h-4" />
                  지출 추가
                </Button>
              </div>
            </div>

            {/* Tax Invoice */}
            <TabsContent value="tax_invoice" className="mt-4">
              <Card className="shadow-card">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>입금약일</TableHead>
                        <TableHead>내용</TableHead>
                        <TableHead className="text-right">공급가</TableHead>
                        <TableHead className="text-right">세액</TableHead>
                        <TableHead className="text-right">총액</TableHead>
                        <TableHead>회사명/대표자</TableHead>
                        <TableHead>사업자번호</TableHead>
                        <TableHead>진행단계</TableHead>
                        <TableHead>입금일자</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            등록된 세금계산서가 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        taxInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell>{invoice.orderNo}</TableCell>
                            <TableCell>{invoice.paymentDueDate}</TableCell>
                            <TableCell className="max-w-[200px] truncate font-medium">{invoice.description}</TableCell>
                            <TableCell className="text-right">{formatCurrency(invoice.supplyAmount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(invoice.taxAmount)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(invoice.totalAmount)}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{invoice.companyName}</TableCell>
                            <TableCell>{invoice.businessNumber}</TableCell>
                            <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                            <TableCell>{formatDate(invoice.paymentDate)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {taxInvoices.length > 0 && (
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={3} className="text-right">합계</TableCell>
                          <TableCell className="text-right">{formatCurrency(taxInvoices.reduce((sum, i) => sum + i.supplyAmount, 0))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(taxInvoices.reduce((sum, i) => sum + i.taxAmount, 0))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(taxInvoices.reduce((sum, i) => sum + i.totalAmount, 0))}</TableCell>
                          <TableCell colSpan={4}></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </TabsContent>

            {/* Withholding */}
            <TabsContent value="withholding" className="mt-4">
              <Card className="p-8 text-center text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>등록된 용역비(원천징수) 내역이 없습니다</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => {
                  setExpenseType('withholding');
                  setShowAddExpenseModal(true);
                }}>
                  <Plus className="w-4 h-4" />
                  용역비 추가
                </Button>
              </Card>
            </TabsContent>

            {/* Corporate Card */}
            <TabsContent value="corporate_card" className="mt-4">
              <Card className="shadow-card">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>카드</TableHead>
                        <TableHead className="text-center">영수증</TableHead>
                        <TableHead>사용날짜</TableHead>
                        <TableHead>사용내용</TableHead>
                        <TableHead>사용자</TableHead>
                        <TableHead className="text-right">사용액(VAT포함)</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                        <TableHead>거래처명</TableHead>
                        <TableHead>비고</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {corporateCardExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            등록된 법인카드 내역이 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        corporateCardExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{expense.orderNo}</TableCell>
                            <TableCell>{expense.cardHolder}</TableCell>
                            <TableCell className="text-center">
                              {expense.receiptSubmitted && <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />}
                            </TableCell>
                            <TableCell>{formatDate(expense.usageDate)}</TableCell>
                            <TableCell className="max-w-[150px] truncate font-medium">{expense.description}</TableCell>
                            <TableCell>{expense.usedBy}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(expense.amountWithVat)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {expense.amountUsd ? `$${expense.amountUsd.toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate">{expense.vendor}</TableCell>
                            <TableCell className="max-w-[100px] truncate text-muted-foreground text-sm">{expense.note}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {corporateCardExpenses.length > 0 && (
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={6} className="text-right">합계 (VAT 포함)</TableCell>
                          <TableCell className="text-right">{formatCurrency(corporateCardExpenses.reduce((sum, e) => sum + e.amountWithVat, 0))}</TableCell>
                          <TableCell colSpan={3}></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </TabsContent>

            {/* Corporate Cash */}
            <TabsContent value="corporate_cash" className="mt-4">
              <Card className="p-8 text-center text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>등록된 법인현금 사용 내역이 없습니다</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => {
                  setExpenseType('corporate_cash');
                  setShowAddExpenseModal(true);
                }}>
                  <Plus className="w-4 h-4" />
                  법인현금 내역 추가
                </Button>
              </Card>
            </TabsContent>

            {/* Personal Expense */}
            <TabsContent value="personal" className="mt-4">
              <Card className="p-8 text-center text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>등록된 개인지출 내역이 없습니다</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => {
                  setExpenseType('personal');
                  setShowAddExpenseModal(true);
                }}>
                  <Plus className="w-4 h-4" />
                  개인지출 추가
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Payment Schedule Summary */}
      <Card className="p-6 shadow-card">
        <h3 className="font-semibold text-foreground mb-4">입금 현황</h3>
        <div className="space-y-3">
          {paymentSchedules.map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div className="flex items-center gap-3">
                <Badge variant={schedule.actualAmount > 0 ? 'default' : 'outline'}>
                  {schedule.installment}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  예정일: {schedule.expectedDate || '미정'}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">예정금액</p>
                  <p className="font-medium">{formatCurrency(schedule.expectedAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">실입금액</p>
                  <p className={`font-medium ${schedule.actualAmount > 0 ? 'text-emerald-600' : ''}`}>
                    {formatCurrency(schedule.actualAmount)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 font-semibold">
            <span>미수금</span>
            <span className={summary.totalWithVat - paymentSchedules.reduce((sum, p) => sum + p.actualAmount, 0) > 0 ? 'text-orange-600' : 'text-emerald-600'}>
              {formatCurrency(summary.totalWithVat - paymentSchedules.reduce((sum, p) => sum + p.actualAmount, 0))}
            </span>
          </div>
        </div>
      </Card>

      {/* Add Expense Modal */}
      <Dialog open={showAddExpenseModal} onOpenChange={setShowAddExpenseModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>지출 내역 추가</DialogTitle>
            <DialogDescription>
              지출 유형을 선택하고 상세 내역을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>지출 유형</Label>
              <Select value={expenseType} onValueChange={(val) => setExpenseType(val as typeof expenseType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax_invoice">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" /> 세금계산서 (외주비)
                    </span>
                  </SelectItem>
                  <SelectItem value="withholding">
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4" /> 원천징수 (용역비)
                    </span>
                  </SelectItem>
                  <SelectItem value="corporate_card">
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> 법인카드
                    </span>
                  </SelectItem>
                  <SelectItem value="corporate_cash">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> 법인현금
                    </span>
                  </SelectItem>
                  <SelectItem value="personal">
                    <span className="flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> 개인지출
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tax Invoice Fields */}
            {expenseType === 'tax_invoice' && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">세금계산서 정보</h4>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    회사명 입력 시 자동완성
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>입금약일 <span className="text-destructive">*</span></Label>
                    <Input placeholder="예: 9월 말" />
                  </div>
                  <div className="space-y-2">
                    <Label>내용 <span className="text-destructive">*</span></Label>
                    <Input placeholder="지출 내용" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>공급가 (세전) <span className="text-destructive">*</span></Label>
                    <Input type="text" placeholder="₩0" />
                  </div>
                  <div className="space-y-2">
                    <Label>세액 (10%)</Label>
                    <Input type="text" placeholder="₩0" disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>총액 (VAT 포함)</Label>
                    <Input type="text" placeholder="₩0" disabled className="bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>회사명 <span className="text-destructive">*</span></Label>
                    <VendorAutocomplete
                      value={formData.companyName}
                      onChange={(val) => setFormData(prev => ({ ...prev, companyName: val }))}
                      onSelect={handleVendorSelect}
                      placeholder="회사명 검색 또는 입력..."
                      vendorType="company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>대표자 <span className="text-destructive">*</span></Label>
                    <Input 
                      placeholder="대표자 성함" 
                      value={formData.representative}
                      onChange={(e) => setFormData(prev => ({ ...prev, representative: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사업자번호 <span className="text-destructive">*</span></Label>
                    <Input 
                      placeholder="000-00-00000" 
                      value={formData.businessNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, businessNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>은행</Label>
                    <Input 
                      placeholder="은행명" 
                      value={formData.bank}
                      onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>계좌번호</Label>
                  <Input 
                    placeholder="계좌번호 입력" 
                    value={formData.accountNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>진행단계</Label>
                    <Select defaultValue="PENDING">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">대기중</SelectItem>
                        <SelectItem value="INVOICE_ISSUED">계산서발행</SelectItem>
                        <SelectItem value="PAYMENT_COMPLETE">입금완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>발행일자</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>입금일자</Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>비고</Label>
                  <Input placeholder="추가 메모" />
                </div>
              </div>
            )}

            {/* Withholding (원천징수) Fields */}
            {expenseType === 'withholding' && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">원천징수 (용역비) 정보</h4>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    이름 입력 시 자동완성
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>입금약일 <span className="text-destructive">*</span></Label>
                    <Input placeholder="예: 00.00.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>이름 <span className="text-destructive">*</span></Label>
                    <VendorAutocomplete
                      value={formData.personName}
                      onChange={(val) => setFormData(prev => ({ ...prev, personName: val }))}
                      onSelect={handleVendorSelect}
                      placeholder="용역자 성함 검색..."
                      vendorType="all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>역할 <span className="text-destructive">*</span></Label>
                  <Input 
                    placeholder="예: 2D 모션그래픽, 3D 모델러" 
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>사용액 <span className="text-destructive">*</span></Label>
                    <Input type="text" placeholder="₩0" />
                  </div>
                  <div className="space-y-2">
                    <Label>세액 (3.3%)</Label>
                    <Input type="text" placeholder="₩0" disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>사용총액</Label>
                    <Input type="text" placeholder="₩0" disabled className="bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>회사명 / 대표자</Label>
                    <Input 
                      placeholder="주식회사 OOO / 홍길동" 
                      value={formData.companyName ? `${formData.companyName}${formData.representative ? ' / ' + formData.representative : ''}` : ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>사업자번호</Label>
                    <Input 
                      placeholder="000-00-00000" 
                      value={formData.businessNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, businessNumber: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>진행단계</Label>
                    <Select defaultValue="PENDING">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">대기중</SelectItem>
                        <SelectItem value="INVOICE_ISSUED">원천징수 발행</SelectItem>
                        <SelectItem value="PAYMENT_COMPLETE">입금완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>발행일자</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>입금일자</Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>비고</Label>
                  <Input placeholder="추가 메모" />
                </div>
              </div>
            )}

            {/* Corporate Card Fields */}
            {expenseType === 'corporate_card' && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">법인카드 사용 내역</h4>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    거래처 입력 시 자동완성
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사용 법인카드 <span className="text-destructive">*</span></Label>
                    <Input placeholder="카드 소유자 또는 카드번호 끝 4자리" />
                  </div>
                  <div className="space-y-2">
                    <Label>사용날짜 <span className="text-destructive">*</span></Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>사용내용 <span className="text-destructive">*</span></Label>
                  <Input placeholder="지출 내용을 입력하세요" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사용자 <span className="text-destructive">*</span></Label>
                    <Input placeholder="실사용자 이름" />
                  </div>
                  <div className="space-y-2">
                    <Label>거래처명 <span className="text-destructive">*</span></Label>
                    <VendorAutocomplete
                      value={formData.vendorName}
                      onChange={(val) => setFormData(prev => ({ ...prev, vendorName: val }))}
                      onSelect={handleVendorSelect}
                      placeholder="거래처 검색..."
                      vendorType="all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사용액 (VAT 포함) <span className="text-destructive">*</span></Label>
                    <Input type="text" placeholder="₩0" />
                  </div>
                  <div className="space-y-2">
                    <Label>USD (해외결제 시)</Label>
                    <Input type="text" placeholder="$0.00" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="receipt-submitted" />
                  <Label htmlFor="receipt-submitted" className="text-sm font-normal">영수증 제출 완료</Label>
                </div>
                <div className="space-y-2">
                  <Label>비고</Label>
                  <Input placeholder="추가 메모" />
                </div>
              </div>
            )}

            {/* Corporate Cash Fields */}
            {expenseType === 'corporate_cash' && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">법인현금 사용 내역</h4>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    거래처 입력 시 자동완성
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사용날짜 <span className="text-destructive">*</span></Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>사용자 <span className="text-destructive">*</span></Label>
                    <Input placeholder="실사용자 이름" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>사용내용 <span className="text-destructive">*</span></Label>
                  <Input placeholder="지출 내용을 입력하세요" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사용액 (VAT 포함) <span className="text-destructive">*</span></Label>
                    <Input type="text" placeholder="₩0" />
                  </div>
                  <div className="space-y-2">
                    <Label>거래처명 <span className="text-destructive">*</span></Label>
                    <VendorAutocomplete
                      value={formData.vendorName}
                      onChange={(val) => setFormData(prev => ({ ...prev, vendorName: val }))}
                      onSelect={handleVendorSelect}
                      placeholder="거래처 검색..."
                      vendorType="all"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="cash-receipt-submitted" />
                  <Label htmlFor="cash-receipt-submitted" className="text-sm font-normal">영수증 제출 완료</Label>
                </div>
                <div className="space-y-2">
                  <Label>비고</Label>
                  <Input placeholder="추가 메모" />
                </div>
              </div>
            )}

            {/* Personal Expense Fields */}
            {expenseType === 'personal' && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">개인지출 내역</h4>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    거래처 입력 시 자동완성
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>지출방식 <span className="text-destructive">*</span></Label>
                    <Select defaultValue="personal_card">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal_card">개인카드</SelectItem>
                        <SelectItem value="personal_cash">개인현금</SelectItem>
                        <SelectItem value="transfer">계좌이체</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>사용날짜 <span className="text-destructive">*</span></Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사용자 (지출자) <span className="text-destructive">*</span></Label>
                    <Input placeholder="지출자 이름" />
                  </div>
                  <div className="space-y-2">
                    <Label>지출자 지급 단계</Label>
                    <Select defaultValue="PENDING">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">지급대기</SelectItem>
                        <SelectItem value="INVOICE_ISSUED">정산요청</SelectItem>
                        <SelectItem value="PAYMENT_COMPLETE">지급완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>사용내용 <span className="text-destructive">*</span></Label>
                  <Input placeholder="지출 내용을 입력하세요" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사용액 (VAT 포함) <span className="text-destructive">*</span></Label>
                    <Input type="text" placeholder="₩0" />
                  </div>
                  <div className="space-y-2">
                    <Label>거래처명 <span className="text-destructive">*</span></Label>
                    <VendorAutocomplete
                      value={formData.vendorName}
                      onChange={(val) => setFormData(prev => ({ ...prev, vendorName: val }))}
                      onSelect={handleVendorSelect}
                      placeholder="거래처 검색..."
                      vendorType="all"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="personal-receipt-submitted" />
                  <Label htmlFor="personal-receipt-submitted" className="text-sm font-normal">영수증 제출 완료</Label>
                </div>
                <div className="space-y-2">
                  <Label>비고</Label>
                  <Input placeholder="추가 메모 (예: 연장근로식비)" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenseModal(false)}>
              취소
            </Button>
            <Button onClick={() => setShowAddExpenseModal(false)}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Item Modal */}
      <Dialog open={showAddLineItemModal} onOpenChange={setShowAddLineItemModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>예산 항목 추가</DialogTitle>
            <DialogDescription>
              새로운 예산 계획 항목을 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>구분 <span className="text-destructive">*</span></Label>
              <Select 
                value={lineItemForm.category} 
                onValueChange={(val) => setLineItemForm(prev => ({ ...prev, category: val as ExpenseCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>대분류 <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="예: 촬영, 조명, 미술"
                  value={lineItemForm.mainCategory}
                  onChange={(e) => setLineItemForm(prev => ({ ...prev, mainCategory: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>소분류 <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="예: 촬영감독, 촬영팀 인건비"
                  value={lineItemForm.subCategory}
                  onChange={(e) => setLineItemForm(prev => ({ ...prev, subCategory: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>목표단가 <span className="text-destructive">*</span></Label>
                <Input 
                  type="text"
                  placeholder="₩0"
                  value={lineItemForm.targetUnitPrice > 0 ? lineItemForm.targetUnitPrice.toLocaleString('ko-KR') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setLineItemForm(prev => ({ ...prev, targetUnitPrice: Number(value) || 0 }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>수량 (회/식/수) <span className="text-destructive">*</span></Label>
                <Input 
                  type="number"
                  min="1"
                  value={lineItemForm.quantity}
                  onChange={(e) => setLineItemForm(prev => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">목표지출액</span>
                <span className="font-semibold">{formatCurrency(lineItemForm.targetUnitPrice * lineItemForm.quantity)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>지급방식</Label>
                <Select 
                  value={lineItemForm.paymentMethod} 
                  onValueChange={(val) => setLineItemForm(prev => ({ ...prev, paymentMethod: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>지급시기</Label>
                <Input 
                  placeholder="예: 2월말, 11월초"
                  value={lineItemForm.paymentTiming}
                  onChange={(e) => setLineItemForm(prev => ({ ...prev, paymentTiming: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>비고</Label>
              <Input 
                placeholder="추가 메모"
                value={lineItemForm.note}
                onChange={(e) => setLineItemForm(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLineItemModal(false)}>
              취소
            </Button>
            <Button 
              onClick={handleAddLineItem}
              disabled={!lineItemForm.mainCategory || !lineItemForm.subCategory || lineItemForm.targetUnitPrice <= 0}
            >
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
