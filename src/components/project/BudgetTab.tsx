import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import type {
  ProjectBudget,
  BudgetLineItem,
  TaxInvoice,
  CorporateCardExpense,
  PaymentStatus,
  ExpenseCategory,
  PaymentSchedule,
  WithholdingPayment,
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
    { id: 'ps-1', projectId: 'p1', installment: '1차(선금)', expectedAmount: 100000000, expectedDate: '2025-09-30', actualAmount: 0, balance: 312059000 },
    { id: 'ps-2', projectId: 'p1', installment: '2차(중도)', expectedAmount: 100000000, expectedDate: '2025-11-30', actualAmount: 0, balance: 312059000 },
    { id: 'ps-3', projectId: 'p1', installment: '3차(잔액)', expectedAmount: 112059000, expectedDate: '2026-02-28', actualAmount: 0, balance: 312059000 },
  ],
  lineItems: [
    // 스텝 인건비 / 장비 - 촬영
    { id: 'li-1', projectId: 'p1', orderNo: 1, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '촬영감독 (DOP)', targetUnitPrice: 1500000, quantity: 2, targetExpense: 3000000, vatRate: 0.1, targetExpenseWithVat: 3000000, actualExpenseWithVat: 4500000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: -1500000 },
    { id: 'li-2', projectId: 'p1', orderNo: 2, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '헌팅차지', targetUnitPrice: 750000, quantity: 1, targetExpense: 750000, vatRate: 0.1, targetExpenseWithVat: 750000, actualExpenseWithVat: 0, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 750000 },
    { id: 'li-3', projectId: 'p1', orderNo: 3, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '촬영', subCategory: '촬영팀 인건비', targetUnitPrice: 1600000, quantity: 2, targetExpense: 3200000, vatRate: 0.1, targetExpenseWithVat: 3200000, actualExpenseWithVat: 4996400, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: -1796400 },
    { id: 'li-4', projectId: 'p1', orderNo: 4, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '조명', subCategory: '조명팀 인건비', targetUnitPrice: 1600000, quantity: 2, targetExpense: 3200000, vatRate: 0.1, targetExpenseWithVat: 3200000, actualExpenseWithVat: 3250000, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: -50000 },
    { id: 'li-5', projectId: 'p1', orderNo: 5, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '조명', subCategory: '조명장비', targetUnitPrice: 1200000, quantity: 2, targetExpense: 2400000, vatRate: 0.1, targetExpenseWithVat: 2400000, actualExpenseWithVat: 0, paymentMethod: 'withholding', paymentTiming: '2월말', note: '', variance: 2400000 },
    { id: 'li-6', projectId: 'p1', orderNo: 6, completed: false, category: 'STAFF_EQUIPMENT', mainCategory: '미술', subCategory: '미술 인건비', targetUnitPrice: 4700000, quantity: 1, targetExpense: 4700000, vatRate: 0.1, targetExpenseWithVat: 4700000, actualExpenseWithVat: 8200000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: -3500000 },
    { id: 'li-7', projectId: 'p1', orderNo: 7, completed: false, category: 'PRODUCTION', mainCategory: '로케이션', subCategory: '유치원 섭외비', targetUnitPrice: 2000000, quantity: 1, targetExpense: 2000000, vatRate: 0.1, targetExpenseWithVat: 2000000, actualExpenseWithVat: 2000000, paymentMethod: 'tax_invoice', paymentTiming: '11월 10일', note: '', variance: 0 },
    { id: 'li-8', projectId: 'p1', orderNo: 8, completed: false, category: 'PRODUCTION', mainCategory: '식사', subCategory: '3끼 * 2회차 * 35명', targetUnitPrice: 30000, quantity: 70, targetExpense: 2100000, vatRate: 0.1, targetExpenseWithVat: 2100000, actualExpenseWithVat: 3197470, paymentMethod: 'corporate_card', paymentTiming: '11월초', note: '', variance: -1097470 },
    { id: 'li-9', projectId: 'p1', orderNo: 9, completed: false, category: 'TALENT', mainCategory: '출연료', subCategory: '주연 (운전기사 / 어린이)', targetUnitPrice: 2000000, quantity: 2, targetExpense: 4000000, vatRate: 0.1, targetExpenseWithVat: 4000000, actualExpenseWithVat: 4000000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 0 },
    { id: 'li-10', projectId: 'p1', orderNo: 10, completed: false, category: 'POST_PRODUCTION', mainCategory: '2D', subCategory: '자막 / 2D컷 제작', targetUnitPrice: 5000000, quantity: 1, targetExpense: 5000000, vatRate: 0.1, targetExpenseWithVat: 5000000, actualExpenseWithVat: 4500000, paymentMethod: 'tax_invoice', paymentTiming: '2월말', note: '', variance: 500000 },
  ],
  taxInvoices: [
    { id: 'ti-1', projectId: 'p1', orderNo: 1, paymentDueDate: '25. 7. 28.', description: '키링제작 선금', supplyAmount: 20650000, taxAmount: 2065000, totalAmount: 22715000, companyName: '(주)블루베리 / 박정규', businessNumber: '819-86-00960', bank: '기업', accountNumber: '124-108385-01-027', status: 'PAYMENT_COMPLETE', issueDate: '2025-07-25', paymentDate: '2025-07-28' },
    { id: 'ti-2', projectId: 'p1', orderNo: 2, paymentDueDate: '25. 12. 31.', description: '키링제작 잔금', supplyAmount: 8850000, taxAmount: 885000, totalAmount: 9735000, companyName: '(주)블루베리 / 박정규', businessNumber: '819-86-00960', bank: '기업', accountNumber: '124-108385-01-027', status: 'PAYMENT_COMPLETE', issueDate: '2025-12-05', paymentDate: '2025-12-31' },
  ],
  withholdingPayments: [
    { id: 'wh-1', projectId: 'p1', orderNo: 1, paymentDueDate: '25.12.31', personName: '장요한', role: '연출', amount: 3000000, withholdingTax: 99000, totalAmount: 2901000, status: 'PAYMENT_COMPLETE' },
    { id: 'wh-2', projectId: 'p1', orderNo: 2, paymentDueDate: '25.12.31', personName: '임혁', role: 'AD', amount: 1500000, withholdingTax: 49500, totalAmount: 1450500, status: 'PAYMENT_COMPLETE' },
    { id: 'wh-3', projectId: 'p1', orderNo: 3, paymentDueDate: '26.01.15', personName: '김현진', role: 'AD', amount: 800000, withholdingTax: 26400, totalAmount: 773600, status: 'PENDING' },
    { id: 'wh-4', projectId: 'p1', orderNo: 4, paymentDueDate: '26.01.15', personName: '이지우', role: 'AD', amount: 800000, withholdingTax: 26400, totalAmount: 773600, status: 'PENDING' },
  ],
  corporateCardExpenses: [
    { id: 'cc-1', projectId: 'p1', orderNo: 1, cardHolder: '법인카드', receiptSubmitted: true, usageDate: '2025-09-25', description: 'UWB 모듈 해외직구', usedBy: '담당자', amountWithVat: 6541365, vendor: '알리익스프레스', note: '120개' },
    { id: 'cc-2', projectId: 'p1', orderNo: 2, cardHolder: '법인카드', receiptSubmitted: true, usageDate: '2025-11-05', description: '의상 재료비', usedBy: '의상팀', amountWithVat: 1509780, vendor: '쿠팡', note: '' },
  ],
  corporateCashExpenses: [],
  personalExpenses: [],
};

export function BudgetTab({ projectId }: BudgetTabProps) {
  const { t, language } = useTranslation();
  const [budget, setBudget] = useState<ProjectBudget>(mockBudgetData);
  const [expenseTab, setExpenseTab] = useState<'tax_invoice' | 'withholding' | 'corporate_card' | 'corporate_cash' | 'personal'>('tax_invoice');

  // Editable contract amount states
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [editContractAmount, setEditContractAmount] = useState(budget.summary.totalContractAmount);

  // Inline editing states
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingTaxInvoiceId, setEditingTaxInvoiceId] = useState<string | null>(null);
  const [editingCardExpenseId, setEditingCardExpenseId] = useState<string | null>(null);

  // New row states
  const [isAddingLineItem, setIsAddingLineItem] = useState(false);
  const [addingForCategory, setAddingForCategory] = useState<string | null>(null);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isAddingTaxInvoice, setIsAddingTaxInvoice] = useState(false);
  const [isAddingCardExpense, setIsAddingCardExpense] = useState(false);
  const [isAddingWithholding, setIsAddingWithholding] = useState(false);
  const [editingWithholdingId, setEditingWithholdingId] = useState<string | null>(null);

  // Temp data for new/editing rows
  const [tempLineItem, setTempLineItem] = useState<Partial<BudgetLineItem>>({});
  const [tempPayment, setTempPayment] = useState<Partial<PaymentSchedule>>({});
  const [tempTaxInvoice, setTempTaxInvoice] = useState<Partial<TaxInvoice>>({});
  const [tempCardExpense, setTempCardExpense] = useState<Partial<CorporateCardExpense>>({});
  const [tempWithholding, setTempWithholding] = useState<Partial<WithholdingPayment>>({});

  const { summary, paymentSchedules, lineItems, taxInvoices, corporateCardExpenses } = budget;

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

  const parseCurrency = (value: string): number => {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
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

  // ========== Line Item CRUD ==========
  const handleSaveLineItem = (item: BudgetLineItem) => {
    const targetExpense = item.targetUnitPrice * item.quantity;
    const updatedItem = { ...item, targetExpense, targetExpenseWithVat: targetExpense, variance: targetExpense - item.actualExpenseWithVat };

    setBudget(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(li => li.id === item.id ? updatedItem : li),
    }));
    setEditingLineItemId(null);
    toast.success('항목이 수정되었습니다.');
  };

  const handleAddLineItem = (forCategory?: string) => {
    const targetExpense = (tempLineItem.targetUnitPrice || 0) * (tempLineItem.quantity || 1);
    const newItem: BudgetLineItem = {
      id: `li-${Date.now()}`,
      projectId,
      orderNo: lineItems.length + 1,
      completed: false,
      category: (tempLineItem.category as ExpenseCategory) || 'STAFF_EQUIPMENT',
      mainCategory: forCategory || tempLineItem.mainCategory || '',
      subCategory: tempLineItem.subCategory || '',
      targetUnitPrice: tempLineItem.targetUnitPrice || 0,
      quantity: tempLineItem.quantity || 1,
      targetExpense,
      vatRate: 0.1,
      targetExpenseWithVat: targetExpense,
      actualExpenseWithVat: 0,
      paymentMethod: 'tax_invoice',
      paymentTiming: tempLineItem.paymentTiming || '',
      note: tempLineItem.note || '',
      variance: targetExpense,
    };

    setBudget(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem],
    }));
    setIsAddingLineItem(false);
    setAddingForCategory(null);
    setTempLineItem({});
    toast.success('항목이 추가되었습니다.');
  };

  // ========== Withholding CRUD ==========
  const handleSaveWithholding = (wh: WithholdingPayment) => {
    const withholdingTax = wh.amount * 0.033;
    const updatedWh = { ...wh, withholdingTax, totalAmount: wh.amount - withholdingTax };

    setBudget(prev => ({
      ...prev,
      withholdingPayments: prev.withholdingPayments.map(w => w.id === wh.id ? updatedWh : w),
    }));
    setEditingWithholdingId(null);
    toast.success('용역비가 수정되었습니다.');
  };

  const handleAddWithholding = () => {
    const amount = tempWithholding.amount || 0;
    const withholdingTax = amount * 0.033;

    const newWh: WithholdingPayment = {
      id: `wh-${Date.now()}`,
      projectId,
      orderNo: (budget.withholdingPayments?.length || 0) + 1,
      paymentDueDate: tempWithholding.paymentDueDate || '',
      personName: tempWithholding.personName || '',
      role: tempWithholding.role || '',
      amount,
      withholdingTax,
      totalAmount: amount - withholdingTax,
      status: 'PENDING',
    };

    setBudget(prev => ({
      ...prev,
      withholdingPayments: [...(prev.withholdingPayments || []), newWh],
    }));
    setIsAddingWithholding(false);
    setTempWithholding({});
    toast.success('용역비가 추가되었습니다.');
  };

  const handleDeleteWithholding = (id: string) => {
    setBudget(prev => ({
      ...prev,
      withholdingPayments: prev.withholdingPayments.filter(w => w.id !== id),
    }));
    toast.success('용역비가 삭제되었습니다.');
  };

  const handleDeleteLineItem = (id: string) => {
    setBudget(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(li => li.id !== id),
    }));
    toast.success('항목이 삭제되었습니다.');
  };

  // ========== Payment Schedule CRUD ==========
  const handleSavePayment = (payment: PaymentSchedule) => {
    setBudget(prev => ({
      ...prev,
      paymentSchedules: prev.paymentSchedules.map(p => p.id === payment.id ? payment : p),
    }));
    setEditingPaymentId(null);
    toast.success('입금 정보가 수정되었습니다.');
  };

  const handleAddPayment = () => {
    const newPayment: PaymentSchedule = {
      id: `ps-${Date.now()}`,
      projectId,
      installment: tempPayment.installment || `${paymentSchedules.length + 1}차`,
      expectedAmount: tempPayment.expectedAmount || 0,
      expectedDate: tempPayment.expectedDate || '',
      actualAmount: 0,
      balance: summary.totalWithVat,
    };

    setBudget(prev => ({
      ...prev,
      paymentSchedules: [...prev.paymentSchedules, newPayment],
    }));
    setIsAddingPayment(false);
    setTempPayment({});
    toast.success('입금 항목이 추가되었습니다.');
  };

  const handleDeletePayment = (id: string) => {
    setBudget(prev => ({
      ...prev,
      paymentSchedules: prev.paymentSchedules.filter(p => p.id !== id),
    }));
    toast.success('입금 항목이 삭제되었습니다.');
  };

  // ========== Tax Invoice CRUD ==========
  const handleSaveTaxInvoice = (invoice: TaxInvoice) => {
    const taxAmount = invoice.supplyAmount * 0.1;
    const updatedInvoice = { ...invoice, taxAmount, totalAmount: invoice.supplyAmount + taxAmount };

    setBudget(prev => ({
      ...prev,
      taxInvoices: prev.taxInvoices.map(ti => ti.id === invoice.id ? updatedInvoice : ti),
    }));
    setEditingTaxInvoiceId(null);
    toast.success('세금계산서가 수정되었습니다.');
  };

  const handleAddTaxInvoice = () => {
    const supplyAmount = tempTaxInvoice.supplyAmount || 0;
    const taxAmount = supplyAmount * 0.1;

    const newInvoice: TaxInvoice = {
      id: `ti-${Date.now()}`,
      projectId,
      orderNo: taxInvoices.length + 1,
      paymentDueDate: tempTaxInvoice.paymentDueDate || '',
      description: tempTaxInvoice.description || '',
      supplyAmount,
      taxAmount,
      totalAmount: supplyAmount + taxAmount,
      companyName: tempTaxInvoice.companyName || '',
      businessNumber: tempTaxInvoice.businessNumber || '',
      bank: tempTaxInvoice.bank || '',
      accountNumber: tempTaxInvoice.accountNumber || '',
      status: 'PENDING',
    };

    setBudget(prev => ({
      ...prev,
      taxInvoices: [...prev.taxInvoices, newInvoice],
    }));
    setIsAddingTaxInvoice(false);
    setTempTaxInvoice({});
    toast.success('세금계산서가 추가되었습니다.');
  };

  const handleDeleteTaxInvoice = (id: string) => {
    setBudget(prev => ({
      ...prev,
      taxInvoices: prev.taxInvoices.filter(ti => ti.id !== id),
    }));
    toast.success('세금계산서가 삭제되었습니다.');
  };

  // ========== Corporate Card CRUD ==========
  const handleSaveCardExpense = (expense: CorporateCardExpense) => {
    setBudget(prev => ({
      ...prev,
      corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? expense : ce),
    }));
    setEditingCardExpenseId(null);
    toast.success('법인카드 내역이 수정되었습니다.');
  };

  const handleAddCardExpense = () => {
    const newExpense: CorporateCardExpense = {
      id: `cc-${Date.now()}`,
      projectId,
      orderNo: corporateCardExpenses.length + 1,
      cardHolder: tempCardExpense.cardHolder || '법인카드',
      receiptSubmitted: false,
      usageDate: tempCardExpense.usageDate || new Date().toISOString().split('T')[0],
      description: tempCardExpense.description || '',
      usedBy: tempCardExpense.usedBy || '',
      amountWithVat: tempCardExpense.amountWithVat || 0,
      vendor: tempCardExpense.vendor || '',
      note: tempCardExpense.note || '',
    };

    setBudget(prev => ({
      ...prev,
      corporateCardExpenses: [...prev.corporateCardExpenses, newExpense],
    }));
    setIsAddingCardExpense(false);
    setTempCardExpense({});
    toast.success('법인카드 내역이 추가되었습니다.');
  };

  const handleDeleteCardExpense = (id: string) => {
    setBudget(prev => ({
      ...prev,
      corporateCardExpenses: prev.corporateCardExpenses.filter(ce => ce.id !== id),
    }));
    toast.success('법인카드 내역이 삭제되었습니다.');
  };

  // Group line items by mainCategory
  const groupedLineItems = lineItems.reduce((acc, item) => {
    const key = item.mainCategory;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, BudgetLineItem[]>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Contract Amount - Scroll to budget table */}
        <Card
          className="p-5 shadow-card cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
          onClick={() => {
            const budgetTable = document.getElementById('budget-plan-table');
            if (budgetTable) {
              budgetTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">총 계약금액</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(summary.totalWithVat)}
              </p>
              <p className="text-xs text-primary">VAT 포함 • 클릭하여 예산표 보기</p>
            </div>
          </div>
        </Card>

        {/* Target Expense */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">목표지출비용</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(totalTargetExpense)}
              </p>
              <p className="text-xs text-blue-600">
                {((totalTargetExpense / summary.totalWithVat) * 100).toFixed(1)}% of total
              </p>
            </div>
          </div>
        </Card>

        {/* Actual Expense */}
        <Card className="p-5 shadow-card">
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
                {((summary.actualExpenseWithVat / summary.totalWithVat) * 100).toFixed(2)}% of total
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

      {/* Budget Plan Section - Removed duplicate tabs */}
      <Card className="shadow-card" id="budget-plan-table">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">예산 계획표</h3>
            <p className="text-sm text-muted-foreground">각 행을 클릭하여 수정하거나, 마지막 행에서 새 항목을 추가하세요</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            내보내기
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">No.</TableHead>
                <TableHead className="w-[120px]">대분류</TableHead>
                <TableHead>소분류</TableHead>
                <TableHead className="text-right w-[130px]">목표단가</TableHead>
                <TableHead className="text-center w-[80px]">수량</TableHead>
                <TableHead className="text-right w-[130px]">목표지출합계</TableHead>
                <TableHead className="w-[100px]">지급 시기</TableHead>
                <TableHead className="w-[120px]">비고</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedLineItems).map(([category, items], groupIndex) => {
                const categoryTotal = items.reduce((sum, item) => sum + item.targetExpenseWithVat, 0);
                return (
                  <>
                    {/* Category Header Row */}
                    <TableRow key={`header-${category}`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5} className="font-semibold text-foreground py-2">
                        {category}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground py-2">
                        {formatCurrency(categoryTotal)}
                      </TableCell>
                      <TableCell colSpan={3} className="py-2"></TableCell>
                    </TableRow>
                    {/* Category Items */}
                    {items.map((item, itemIndex) => (
                      editingLineItemId === item.id ? (
                        <TableRow key={item.id} className="bg-blue-50/50">
                          <TableCell className="text-muted-foreground">{groupIndex + 1}-{itemIndex + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={item.mainCategory}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li => li.id === item.id ? { ...li, mainCategory: e.target.value } : li),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.subCategory}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li => li.id === item.id ? { ...li, subCategory: e.target.value } : li),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.targetUnitPrice.toLocaleString('ko-KR')}
                              onChange={(e) => {
                                const value = parseCurrency(e.target.value);
                                setBudget(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li => li.id === item.id ? { ...li, targetUnitPrice: value } : li),
                                }));
                              }}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li => li.id === item.id ? { ...li, quantity: Number(e.target.value) || 1 } : li),
                                }));
                              }}
                              className="h-8 text-center"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.targetUnitPrice * item.quantity)}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.paymentTiming || ''}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li => li.id === item.id ? { ...li, paymentTiming: e.target.value } : li),
                                }));
                              }}
                              className="h-8"
                              placeholder="예: 2월말"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.note || ''}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li => li.id === item.id ? { ...li, note: e.target.value } : li),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSaveLineItem(item)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingLineItemId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow
                          key={item.id}
                          className="hover:bg-muted/10 cursor-pointer"
                          onClick={() => setEditingLineItemId(item.id)}
                        >
                          <TableCell className="text-muted-foreground">{groupIndex + 1}-{itemIndex + 1}</TableCell>
                          <TableCell></TableCell>
                          <TableCell>{item.subCategory}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.targetUnitPrice)}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.targetExpenseWithVat)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.paymentTiming || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm truncate max-w-[120px]">{item.note}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); handleDeleteLineItem(item.id); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    ))}
                  </>
                );
              })}

              {/* Add New Row */}
              {isAddingLineItem ? (
                <TableRow className="bg-emerald-50/50">
                  <TableCell className="text-muted-foreground">새 항목</TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.mainCategory || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, mainCategory: e.target.value }))}
                      className="h-8"
                      placeholder="대분류"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.subCategory || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, subCategory: e.target.value }))}
                      className="h-8"
                      placeholder="소분류"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={(tempLineItem.targetUnitPrice || 0).toLocaleString('ko-KR')}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, targetUnitPrice: parseCurrency(e.target.value) }))}
                      className="h-8 text-right"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={tempLineItem.quantity || 1}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                      className="h-8 text-center"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency((tempLineItem.targetUnitPrice || 0) * (tempLineItem.quantity || 1))}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.paymentTiming || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, paymentTiming: e.target.value }))}
                      className="h-8"
                      placeholder="지급 시기"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.note || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, note: e.target.value }))}
                      className="h-8"
                      placeholder="비고"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleAddLineItem()}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAddingLineItem(false); setTempLineItem({}); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow
                  className="hover:bg-emerald-50/50 cursor-pointer border-dashed"
                  onClick={() => setIsAddingLineItem(true)}
                >
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-3">
                    <Plus className="w-4 h-4 inline mr-2" />
                    새 항목 추가
                  </TableCell>
                </TableRow>
              )}

              {/* Total Row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell colSpan={5} className="text-right">총 합계</TableCell>
                <TableCell className="text-right">{formatCurrency(totalTargetExpense)}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Actual Expense Section */}
      <div className="space-y-4">
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
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              내보내기
            </Button>
          </div>

          {/* Tax Invoice Tab */}
          <TabsContent value="tax_invoice" className="mt-4">
            <Card className="shadow-card">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">No.</TableHead>
                      <TableHead className="w-[100px]">입금약일</TableHead>
                      <TableHead>내용</TableHead>
                      <TableHead className="text-right w-[120px]">공급가</TableHead>
                      <TableHead className="text-right w-[100px]">세액</TableHead>
                      <TableHead className="text-right w-[120px]">총액</TableHead>
                      <TableHead className="w-[150px]">회사명/대표자</TableHead>
                      <TableHead className="w-[120px]">사업자번호</TableHead>
                      <TableHead className="w-[100px]">진행단계</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxInvoices.map((invoice, index) => (
                      editingTaxInvoiceId === invoice.id ? (
                        <TableRow key={invoice.id} className="bg-blue-50/50">
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={invoice.paymentDueDate}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  taxInvoices: prev.taxInvoices.map(ti => ti.id === invoice.id ? { ...ti, paymentDueDate: e.target.value } : ti),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={invoice.description}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  taxInvoices: prev.taxInvoices.map(ti => ti.id === invoice.id ? { ...ti, description: e.target.value } : ti),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={invoice.supplyAmount.toLocaleString('ko-KR')}
                              onChange={(e) => {
                                const value = parseCurrency(e.target.value);
                                setBudget(prev => ({
                                  ...prev,
                                  taxInvoices: prev.taxInvoices.map(ti => ti.id === invoice.id ? { ...ti, supplyAmount: value } : ti),
                                }));
                              }}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(invoice.supplyAmount * 0.1)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.supplyAmount * 1.1)}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={invoice.companyName}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  taxInvoices: prev.taxInvoices.map(ti => ti.id === invoice.id ? { ...ti, companyName: e.target.value } : ti),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={invoice.businessNumber}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  taxInvoices: prev.taxInvoices.map(ti => ti.id === invoice.id ? { ...ti, businessNumber: e.target.value } : ti),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={invoice.status}
                              onValueChange={(val) => {
                                setBudget(prev => ({
                                  ...prev,
                                  taxInvoices: prev.taxInvoices.map(ti => ti.id === invoice.id ? { ...ti, status: val as PaymentStatus } : ti),
                                }));
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">대기중</SelectItem>
                                <SelectItem value="INVOICE_ISSUED">계산서발행</SelectItem>
                                <SelectItem value="PAYMENT_COMPLETE">입금완료</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSaveTaxInvoice(invoice)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingTaxInvoiceId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow
                          key={invoice.id}
                          className="hover:bg-muted/10 cursor-pointer"
                          onClick={() => setEditingTaxInvoiceId(invoice.id)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{invoice.paymentDueDate}</TableCell>
                          <TableCell className="font-medium">{invoice.description}</TableCell>
                          <TableCell className="text-right">{formatCurrency(invoice.supplyAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(invoice.taxAmount)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(invoice.totalAmount)}</TableCell>
                          <TableCell className="truncate max-w-[150px]">{invoice.companyName}</TableCell>
                          <TableCell>{invoice.businessNumber}</TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteTaxInvoice(invoice.id); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    ))}

                    {/* Add New Row */}
                    {isAddingTaxInvoice ? (
                      <TableRow className="bg-emerald-50/50">
                        <TableCell>새 항목</TableCell>
                        <TableCell>
                          <Input
                            value={tempTaxInvoice.paymentDueDate || ''}
                            onChange={(e) => setTempTaxInvoice(prev => ({ ...prev, paymentDueDate: e.target.value }))}
                            className="h-8"
                            placeholder="예: 25.12.31"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempTaxInvoice.description || ''}
                            onChange={(e) => setTempTaxInvoice(prev => ({ ...prev, description: e.target.value }))}
                            className="h-8"
                            placeholder="내용"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={(tempTaxInvoice.supplyAmount || 0).toLocaleString('ko-KR')}
                            onChange={(e) => setTempTaxInvoice(prev => ({ ...prev, supplyAmount: parseCurrency(e.target.value) }))}
                            className="h-8 text-right"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency((tempTaxInvoice.supplyAmount || 0) * 0.1)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency((tempTaxInvoice.supplyAmount || 0) * 1.1)}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempTaxInvoice.companyName || ''}
                            onChange={(e) => setTempTaxInvoice(prev => ({ ...prev, companyName: e.target.value }))}
                            className="h-8"
                            placeholder="회사명"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempTaxInvoice.businessNumber || ''}
                            onChange={(e) => setTempTaxInvoice(prev => ({ ...prev, businessNumber: e.target.value }))}
                            className="h-8"
                            placeholder="000-00-00000"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-100 text-yellow-700">대기중</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleAddTaxInvoice}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAddingTaxInvoice(false); setTempTaxInvoice({}); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow
                        className="hover:bg-emerald-50/50 cursor-pointer border-dashed"
                        onClick={() => setIsAddingTaxInvoice(true)}
                      >
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-3">
                          <Plus className="w-4 h-4 inline mr-2" />
                          새 세금계산서 추가
                        </TableCell>
                      </TableRow>
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
              </div>
            </Card>
          </TabsContent>

          {/* Withholding Tab */}
          <TabsContent value="withholding" className="mt-4">
            <Card className="shadow-card">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">No.</TableHead>
                      <TableHead className="w-[100px]">입금약일</TableHead>
                      <TableHead>성명</TableHead>
                      <TableHead className="w-[100px]">역할</TableHead>
                      <TableHead className="text-right w-[120px]">금액</TableHead>
                      <TableHead className="text-right w-[100px]">세액(3.3%)</TableHead>
                      <TableHead className="text-right w-[120px]">실지급액</TableHead>
                      <TableHead className="w-[100px]">진행단계</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(budget.withholdingPayments || []).map((wh, index) => (
                      editingWithholdingId === wh.id ? (
                        <TableRow key={wh.id} className="bg-blue-50/50">
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={wh.paymentDueDate || ''}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  withholdingPayments: prev.withholdingPayments.map(w => w.id === wh.id ? { ...w, paymentDueDate: e.target.value } : w),
                                }));
                              }}
                              className="h-8"
                              placeholder="예: 26.01.15"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={wh.personName}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  withholdingPayments: prev.withholdingPayments.map(w => w.id === wh.id ? { ...w, personName: e.target.value } : w),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={wh.role}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  withholdingPayments: prev.withholdingPayments.map(w => w.id === wh.id ? { ...w, role: e.target.value } : w),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={wh.amount.toLocaleString('ko-KR')}
                              onChange={(e) => {
                                const value = parseCurrency(e.target.value);
                                setBudget(prev => ({
                                  ...prev,
                                  withholdingPayments: prev.withholdingPayments.map(w => w.id === wh.id ? { ...w, amount: value } : w),
                                }));
                              }}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(wh.amount * 0.033)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(wh.amount - wh.amount * 0.033)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={wh.status}
                              onValueChange={(val) => {
                                setBudget(prev => ({
                                  ...prev,
                                  withholdingPayments: prev.withholdingPayments.map(w => w.id === wh.id ? { ...w, status: val as PaymentStatus } : w),
                                }));
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">대기중</SelectItem>
                                <SelectItem value="INVOICE_ISSUED">계산서발행</SelectItem>
                                <SelectItem value="PAYMENT_COMPLETE">입금완료</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSaveWithholding(wh)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingWithholdingId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow
                          key={wh.id}
                          className="hover:bg-muted/10 cursor-pointer"
                          onClick={() => setEditingWithholdingId(wh.id)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{wh.paymentDueDate}</TableCell>
                          <TableCell className="font-medium">{wh.personName}</TableCell>
                          <TableCell>{wh.role}</TableCell>
                          <TableCell className="text-right">{formatCurrency(wh.amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(wh.withholdingTax)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(wh.totalAmount)}</TableCell>
                          <TableCell>{getStatusBadge(wh.status)}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteWithholding(wh.id); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    ))}

                    {/* Add New Row */}
                    {isAddingWithholding ? (
                      <TableRow className="bg-emerald-50/50">
                        <TableCell>새 항목</TableCell>
                        <TableCell>
                          <Input
                            value={tempWithholding.paymentDueDate || ''}
                            onChange={(e) => setTempWithholding(prev => ({ ...prev, paymentDueDate: e.target.value }))}
                            className="h-8"
                            placeholder="예: 26.01.15"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempWithholding.personName || ''}
                            onChange={(e) => setTempWithholding(prev => ({ ...prev, personName: e.target.value }))}
                            className="h-8"
                            placeholder="이름"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempWithholding.role || ''}
                            onChange={(e) => setTempWithholding(prev => ({ ...prev, role: e.target.value }))}
                            className="h-8"
                            placeholder="역할"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={(tempWithholding.amount || 0).toLocaleString('ko-KR')}
                            onChange={(e) => setTempWithholding(prev => ({ ...prev, amount: parseCurrency(e.target.value) }))}
                            className="h-8 text-right"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency((tempWithholding.amount || 0) * 0.033)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency((tempWithholding.amount || 0) * 0.967)}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-100 text-yellow-700">대기중</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleAddWithholding}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAddingWithholding(false); setTempWithholding({}); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow
                        className="hover:bg-emerald-50/50 cursor-pointer border-dashed"
                        onClick={() => setIsAddingWithholding(true)}
                      >
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-3">
                          <Plus className="w-4 h-4 inline mr-2" />
                          새 용역비 추가
                        </TableCell>
                      </TableRow>
                    )}

                    {(budget.withholdingPayments?.length || 0) > 0 && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4} className="text-right">합계</TableCell>
                        <TableCell className="text-right">{formatCurrency((budget.withholdingPayments || []).reduce((sum, w) => sum + w.amount, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency((budget.withholdingPayments || []).reduce((sum, w) => sum + w.withholdingTax, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency((budget.withholdingPayments || []).reduce((sum, w) => sum + w.totalAmount, 0))}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Corporate Card Tab */}
          <TabsContent value="corporate_card" className="mt-4">
            <Card className="shadow-card">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">No.</TableHead>
                      <TableHead className="w-[100px]">사용날짜</TableHead>
                      <TableHead>사용내용</TableHead>
                      <TableHead className="w-[100px]">사용자</TableHead>
                      <TableHead className="text-right w-[130px]">사용액(VAT포함)</TableHead>
                      <TableHead className="w-[120px]">거래처명</TableHead>
                      <TableHead className="w-[120px]">비고</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corporateCardExpenses.map((expense, index) => (
                      editingCardExpenseId === expense.id ? (
                        <TableRow key={expense.id} className="bg-blue-50/50">
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={expense.usageDate}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? { ...ce, usageDate: e.target.value } : ce),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={expense.description}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? { ...ce, description: e.target.value } : ce),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={expense.usedBy}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? { ...ce, usedBy: e.target.value } : ce),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={expense.amountWithVat.toLocaleString('ko-KR')}
                              onChange={(e) => {
                                const value = parseCurrency(e.target.value);
                                setBudget(prev => ({
                                  ...prev,
                                  corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? { ...ce, amountWithVat: value } : ce),
                                }));
                              }}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={expense.vendor}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? { ...ce, vendor: e.target.value } : ce),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={expense.note || ''}
                              onChange={(e) => {
                                setBudget(prev => ({
                                  ...prev,
                                  corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? { ...ce, note: e.target.value } : ce),
                                }));
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSaveCardExpense(expense)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingCardExpenseId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow
                          key={expense.id}
                          className="hover:bg-muted/10 cursor-pointer"
                          onClick={() => setEditingCardExpenseId(expense.id)}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{formatDate(expense.usageDate)}</TableCell>
                          <TableCell className="font-medium">{expense.description}</TableCell>
                          <TableCell>{expense.usedBy}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(expense.amountWithVat)}</TableCell>
                          <TableCell className="truncate max-w-[120px]">{expense.vendor}</TableCell>
                          <TableCell className="text-muted-foreground text-sm truncate max-w-[120px]">{expense.note}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCardExpense(expense.id); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    ))}

                    {/* Add New Row */}
                    {isAddingCardExpense ? (
                      <TableRow className="bg-emerald-50/50">
                        <TableCell>새 항목</TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={tempCardExpense.usageDate || ''}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, usageDate: e.target.value }))}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempCardExpense.description || ''}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, description: e.target.value }))}
                            className="h-8"
                            placeholder="사용내용"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempCardExpense.usedBy || ''}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, usedBy: e.target.value }))}
                            className="h-8"
                            placeholder="사용자"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={(tempCardExpense.amountWithVat || 0).toLocaleString('ko-KR')}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, amountWithVat: parseCurrency(e.target.value) }))}
                            className="h-8 text-right"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempCardExpense.vendor || ''}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, vendor: e.target.value }))}
                            className="h-8"
                            placeholder="거래처"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempCardExpense.note || ''}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, note: e.target.value }))}
                            className="h-8"
                            placeholder="비고"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleAddCardExpense}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAddingCardExpense(false); setTempCardExpense({}); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow
                        className="hover:bg-emerald-50/50 cursor-pointer border-dashed"
                        onClick={() => setIsAddingCardExpense(true)}
                      >
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-3">
                          <Plus className="w-4 h-4 inline mr-2" />
                          새 법인카드 내역 추가
                        </TableCell>
                      </TableRow>
                    )}

                    {corporateCardExpenses.length > 0 && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4} className="text-right">합계 (VAT 포함)</TableCell>
                        <TableCell className="text-right">{formatCurrency(corporateCardExpenses.reduce((sum, e) => sum + e.amountWithVat, 0))}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Corporate Cash Tab */}
          <TabsContent value="corporate_cash" className="mt-4">
            <Card className="p-8 text-center text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>등록된 법인현금 사용 내역이 없습니다</p>
              <p className="text-sm mt-2">테이블에서 직접 추가할 수 있습니다</p>
            </Card>
          </TabsContent>

          {/* Personal Expense Tab */}
          <TabsContent value="personal" className="mt-4">
            <Card className="p-8 text-center text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>등록된 개인지출 내역이 없습니다</p>
              <p className="text-sm mt-2">테이블에서 직접 추가할 수 있습니다</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Schedule Summary */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">입금 현황</h3>
        </div>
        <div className="space-y-3">
          {paymentSchedules.map((schedule) => (
            editingPaymentId === schedule.id ? (
              <div key={schedule.id} className="flex items-center gap-3 py-2 px-3 bg-blue-50 rounded-lg">
                <Input
                  value={schedule.installment}
                  onChange={(e) => {
                    setBudget(prev => ({
                      ...prev,
                      paymentSchedules: prev.paymentSchedules.map(p => p.id === schedule.id ? { ...p, installment: e.target.value } : p),
                    }));
                  }}
                  className="h-8 w-[120px]"
                  placeholder="차수"
                />
                <Input
                  type="date"
                  value={schedule.expectedDate}
                  onChange={(e) => {
                    setBudget(prev => ({
                      ...prev,
                      paymentSchedules: prev.paymentSchedules.map(p => p.id === schedule.id ? { ...p, expectedDate: e.target.value } : p),
                    }));
                  }}
                  className="h-8 w-[150px]"
                />
                <div className="flex-1">
                  <Input
                    value={schedule.expectedAmount.toLocaleString('ko-KR')}
                    onChange={(e) => {
                      const value = parseCurrency(e.target.value);
                      setBudget(prev => ({
                        ...prev,
                        paymentSchedules: prev.paymentSchedules.map(p => p.id === schedule.id ? { ...p, expectedAmount: value } : p),
                      }));
                    }}
                    className="h-8 text-right"
                    placeholder="예정금액"
                  />
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSavePayment(schedule)}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingPaymentId(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={schedule.id}
                className="flex items-center justify-between py-2 border-b last:border-b-0 hover:bg-muted/30 px-2 -mx-2 rounded cursor-pointer group"
                onClick={() => setEditingPaymentId(schedule.id)}
              >
                <div className="flex items-center gap-3">
                  <Badge variant={schedule.expectedAmount > 0 ? 'default' : 'outline'}>
                    {schedule.installment}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    예정일: {schedule.expectedDate || '미정'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(schedule.expectedAmount)}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); handleDeletePayment(schedule.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          ))}

          {/* Add New Payment Row */}
          {isAddingPayment ? (
            <div className="flex items-center gap-3 py-2 px-3 bg-emerald-50 rounded-lg">
              <Input
                value={tempPayment.installment || ''}
                onChange={(e) => setTempPayment(prev => ({ ...prev, installment: e.target.value }))}
                className="h-8 w-[120px]"
                placeholder={`${paymentSchedules.length + 1}차`}
              />
              <Input
                type="date"
                value={tempPayment.expectedDate || ''}
                onChange={(e) => setTempPayment(prev => ({ ...prev, expectedDate: e.target.value }))}
                className="h-8 w-[150px]"
              />
              <div className="flex-1">
                <Input
                  value={(tempPayment.expectedAmount || 0).toLocaleString('ko-KR')}
                  onChange={(e) => setTempPayment(prev => ({ ...prev, expectedAmount: parseCurrency(e.target.value) }))}
                  className="h-8 text-right"
                  placeholder="예정금액"
                />
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleAddPayment}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAddingPayment(false); setTempPayment({}); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="w-full py-2 text-center text-muted-foreground hover:bg-emerald-50 rounded border border-dashed"
              onClick={() => setIsAddingPayment(true)}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              입금 항목 추가
            </button>
          )}

          <div className="flex items-center justify-between pt-2 font-semibold border-t">
            <span>총 예정금액</span>
            <span>{formatCurrency(paymentSchedules.reduce((sum, p) => sum + p.expectedAmount, 0))}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
