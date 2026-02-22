import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import { toast } from 'sonner';
import { loadBudget } from '@/services/budgetService';
import {
  getBudgetLink,
  linkSpreadsheet,
  syncBudget as syncBudgetService,
  unlinkSpreadsheet,
  parseSpreadsheetUrl,
} from '@/services/googleSheetsService';
import type { BudgetLink } from '@/services/googleSheetsService';
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
    { id: 'ps-3', projectId: 'p1', installment: '3차(잔액)', expectedAmount: 112059000, expectedDate: '2025-12-31', actualAmount: 0, balance: 312059000 },
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

type BudgetSection = 'contract' | 'target' | 'actual' | 'profit';

// Empty budget template for new projects
const emptyBudgetData: ProjectBudget = {
  summary: {
    id: '',
    projectId: '',
    companyName: '',
    contractName: '',
    department: '',
    author: '',
    shootingDate: '',
    phase: '',
    totalContractAmount: 0,
    vatAmount: 0,
    totalWithVat: 0,
    targetExpenseWithVat: 0,
    targetProfitWithVat: 0,
    actualExpenseWithVat: 0,
    actualProfitWithVat: 0,
    actualExpenseWithoutVat: 0,
    actualProfitWithoutVat: 0,
  },
  paymentSchedules: [],
  lineItems: [],
  taxInvoices: [],
  withholdingPayments: [],
  corporateCardExpenses: [],
  corporateCashExpenses: [],
  personalExpenses: [],
};

export function BudgetTab({ projectId }: BudgetTabProps) {
  const { t, language } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);

  // Pre-existing 2025 projects (p1–p33) keep their mock budget data; new projects start empty
  const isLegacyProject = /^p\d+$/.test(projectId);
  const [budget, setBudget] = useState<ProjectBudget>(
    isLegacyProject
      ? { ...mockBudgetData, summary: { ...mockBudgetData.summary, projectId } }
      : { ...emptyBudgetData, summary: { ...emptyBudgetData.summary, projectId } }
  );
  const [activeSection, setActiveSection] = useState<BudgetSection>('contract');
  const [expenseTab, setExpenseTab] = useState<'tax_invoice' | 'withholding' | 'corporate_card' | 'corporate_cash' | 'personal'>('tax_invoice');

  // Google Sheets sync states
  const [budgetLink, setBudgetLink] = useState<BudgetLink | null>(null);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLinking, setIsLinking] = useState(false);

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

  // ========== DB Loading & Sheet Link ==========
  const refreshBudgetFromDb = useCallback(async () => {
    setIsLoadingBudget(true);
    try {
      const dbBudget = await loadBudget(projectId);
      if (dbBudget) {
        setBudget(dbBudget);
      }
    } catch (err) {
      console.error('[BudgetTab] Failed to load budget:', err);
    } finally {
      setIsLoadingBudget(false);
    }
  }, [projectId]);

  useEffect(() => {
    // Load budget link status
    getBudgetLink(projectId).then((link) => {
      setBudgetLink(link);
      // If linked, load budget from DB
      if (link) {
        refreshBudgetFromDb();
      }
    });
  }, [projectId, refreshBudgetFromDb]);

  const handleLinkSheet = useCallback(async () => {
    if (!currentUser || !sheetUrl) return;
    const spreadsheetId = parseSpreadsheetUrl(sheetUrl);
    if (!spreadsheetId) {
      toast.error(t('budgetSyncError'));
      return;
    }

    setIsLinking(true);
    try {
      const result = await linkSpreadsheet(currentUser.id, projectId, sheetUrl);
      if (result.success) {
        toast.success(t('sheetConnected'));
        setShowLinkDialog(false);
        setSheetUrl('');
        // Refresh link & data
        const link = await getBudgetLink(projectId);
        setBudgetLink(link);
        await refreshBudgetFromDb();
      } else if (result.needsReauth) {
        toast.error(t('sheetsReauthRequired'));
      } else {
        toast.error(result.error || t('budgetSyncError'));
      }
    } catch {
      toast.error(t('budgetSyncError'));
    } finally {
      setIsLinking(false);
    }
  }, [currentUser, sheetUrl, projectId, t, refreshBudgetFromDb]);

  const handleSyncBudget = useCallback(async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const result = await syncBudgetService(currentUser.id, projectId, 'pull');
      if (result.success) {
        toast.success(t('budgetSyncSuccess'));
        await refreshBudgetFromDb();
        // Refresh link status too
        const link = await getBudgetLink(projectId);
        setBudgetLink(link);
      } else if (result.needsReauth) {
        toast.error(t('sheetsReauthRequired'));
      } else {
        toast.error(result.error || t('budgetSyncError'));
      }
    } catch {
      toast.error(t('budgetSyncError'));
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, projectId, t, refreshBudgetFromDb]);

  const handleUnlinkSheet = useCallback(async () => {
    try {
      const result = await unlinkSpreadsheet(projectId);
      if (result.success) {
        toast.success(t('sheetDisconnected'));
        setBudgetLink(null);
        setShowUnlinkDialog(false);
      } else {
        toast.error(result.error || t('budgetSyncError'));
      }
    } catch {
      toast.error(t('budgetSyncError'));
    }
  }, [projectId, t]);

  const { summary, paymentSchedules, lineItems, taxInvoices, corporateCardExpenses,
    withholdingPayments, corporateCashExpenses, personalExpenses } = budget;

  // Calculate totals
  // 목표지출비용: use summary value first (시트 개요 탭의 값), fallback to line items sum
  const lineItemsTargetWithVat = lineItems.reduce((sum, item) => sum + item.targetExpenseWithVat, 0);
  const lineItemsTarget = lineItems.reduce((sum, item) => sum + item.targetExpense, 0);
  // H열(target_expense, 세전) 합계를 기본으로 사용.
  // summary 값은 개요시트에서 정확한 176,150,000을 가져오므로 1순위.
  const totalTargetExpense = summary.targetExpenseWithVat > 0
    ? summary.targetExpenseWithVat
    : lineItemsTarget;
  const totalActualLineItems = lineItems.reduce((sum, item) => sum + item.actualExpenseWithVat, 0);
  const totalVariance = lineItems.reduce((sum, item) => sum + item.variance, 0);

  // Actual expense = sum of ALL 5 expense tables (세금계산서 + 원천징수 + 법인카드 + 법인현금 + 개인지출)
  const computedActualExpense =
    taxInvoices.reduce((s, i) => s + i.totalAmount, 0) +
    withholdingPayments.reduce((s, w) => s + (w.grossAmount || w.amount || 0), 0) +
    corporateCardExpenses.reduce((s, c) => s + c.amountWithVat, 0) +
    corporateCashExpenses.reduce((s, c) => s + c.amountWithVat, 0) +
    personalExpenses.reduce((s, p) => s + p.amountWithVat, 0);

  // Total contract = 공급가(총견적) — use totalContractAmount (VAT 미포함)
  // Priority: totalContractAmount > totalWithVat > payment schedules sum
  const displayTotalContract = summary.totalContractAmount > 0
    ? summary.totalContractAmount
    : summary.totalWithVat > 0
      ? summary.totalWithVat
      : paymentSchedules.reduce((s, ps) => s + ps.expectedAmount, 0);

  // Actual expense = 실제지출비용 — use summary value from sheet (시트 개요에서 가져온 값)
  // Summary value (189M) is the authoritative source from the sheet's overview tab.
  // computedActualExpense (sum of 5 tables) may differ because the sheet's overview
  // uses category-grouped amounts rather than individual line items.
  const displayActualExpense = summary.actualExpenseWithVat > 0
    ? summary.actualExpenseWithVat
    : computedActualExpense > 0
      ? computedActualExpense
      : 0;

  // Actual profit (수익/마진) = 공급가 - 실제지출
  const displayActualProfit = displayTotalContract - displayActualExpense;

  const achievementRate = totalTargetExpense > 0 ? ((displayActualExpense / totalTargetExpense) * 100).toFixed(1) : '0';
  const profitRate = displayTotalContract > 0 ? ((displayActualProfit / displayTotalContract) * 100).toFixed(2) : '0';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === t('undetermined')) return dateString || '-';
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
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" />{t('paymentComplete')}</Badge>;
      case 'INVOICE_ISSUED':
        return <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" />{t('invoiceIssued')}</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3 mr-1" />{t('pendingStatusLabel')}</Badge>;
      default:
        return null;
    }
  };

  // ========== Line Item CRUD ==========
  const handleSaveLineItem = (item: BudgetLineItem) => {
    const targetExpense = item.targetUnitPrice * item.quantity;
    const targetExpenseWithVat = item.vatRate > 0
      ? Math.round(targetExpense * (1 + item.vatRate))
      : targetExpense;
    const updatedItem = { ...item, targetExpense, targetExpenseWithVat, variance: targetExpense - item.actualExpenseWithVat };

    setBudget(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(li => li.id === item.id ? updatedItem : li),
    }));
    setEditingLineItemId(null);
    toast.success(t('itemUpdated'));
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
      targetExpenseWithVat: (tempLineItem.vatRate || 0) > 0
        ? Math.round(targetExpense * (1 + (tempLineItem.vatRate || 0.1)))
        : targetExpense,
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
    toast.success(t('itemAdded'));
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
    toast.success(t('withholdingUpdated'));
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
    toast.success(t('withholdingAdded'));
  };

  const handleDeleteWithholding = (id: string) => {
    setBudget(prev => ({
      ...prev,
      withholdingPayments: prev.withholdingPayments.filter(w => w.id !== id),
    }));
    toast.success(t('withholdingDeleted'));
  };

  const handleDeleteLineItem = (id: string) => {
    setBudget(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(li => li.id !== id),
    }));
    toast.success(t('itemDeleted'));
  };

  // ========== Payment Schedule CRUD ==========
  const handleSavePayment = (payment: PaymentSchedule) => {
    setBudget(prev => ({
      ...prev,
      paymentSchedules: prev.paymentSchedules.map(p => p.id === payment.id ? payment : p),
    }));
    setEditingPaymentId(null);
    toast.success(t('depositInfoUpdated'));
  };

  const handleAddPayment = () => {
    const newPayment: PaymentSchedule = {
      id: `ps-${Date.now()}`,
      projectId,
      installment: tempPayment.installment || `${paymentSchedules.length + 1}${t('installmentSuffix')}`,
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
    toast.success(t('depositItemAdded'));
  };

  const handleDeletePayment = (id: string) => {
    setBudget(prev => ({
      ...prev,
      paymentSchedules: prev.paymentSchedules.filter(p => p.id !== id),
    }));
    toast.success(t('depositItemDeleted'));
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
    toast.success(t('taxInvoiceUpdated'));
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
    toast.success(t('taxInvoiceAdded'));
  };

  const handleDeleteTaxInvoice = (id: string) => {
    setBudget(prev => ({
      ...prev,
      taxInvoices: prev.taxInvoices.filter(ti => ti.id !== id),
    }));
    toast.success(t('taxInvoiceDeleted'));
  };

  // ========== Corporate Card CRUD ==========
  const handleSaveCardExpense = (expense: CorporateCardExpense) => {
    setBudget(prev => ({
      ...prev,
      corporateCardExpenses: prev.corporateCardExpenses.map(ce => ce.id === expense.id ? expense : ce),
    }));
    setEditingCardExpenseId(null);
    toast.success(t('corporateCardUpdated'));
  };

  const handleAddCardExpense = () => {
    const newExpense: CorporateCardExpense = {
      id: `cc-${Date.now()}`,
      projectId,
      orderNo: corporateCardExpenses.length + 1,
      cardHolder: tempCardExpense.cardHolder || t('corporateCard'),
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
    toast.success(t('corporateCardAdded'));
  };

  const handleDeleteCardExpense = (id: string) => {
    setBudget(prev => ({
      ...prev,
      corporateCardExpenses: prev.corporateCardExpenses.filter(ce => ce.id !== id),
    }));
    toast.success(t('corporateCardDeleted'));
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
      {/* Google Sheets Connection Banner */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between gap-4">
          {budgetLink ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">Google Sheets</span>
                    <Badge variant="outline" className={
                      budgetLink.syncStatus === 'CONNECTED' ? 'text-emerald-600 border-emerald-300' :
                      budgetLink.syncStatus === 'SYNCING' ? 'text-blue-600 border-blue-300' :
                      budgetLink.syncStatus === 'ERROR' ? 'text-red-600 border-red-300' :
                      'text-muted-foreground'
                    }>
                      {budgetLink.syncStatus === 'CONNECTED' ? t('sheetLinked') :
                       budgetLink.syncStatus === 'SYNCING' ? t('sheetSyncing') :
                       budgetLink.syncStatus === 'ERROR' ? t('sheetError') : ''}
                    </Badge>
                  </div>
                  {budgetLink.lastSyncAt && (
                    <p className="text-xs text-muted-foreground">
                      {t('lastSynced')}: {new Date(budgetLink.lastSyncAt).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSyncBudget}
                  disabled={isSyncing}
                >
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {isSyncing ? t('syncingBudget') : t('syncBudget')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.open(budgetLink.spreadsheetUrl, '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('openInGoogleSheets')}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setShowUnlinkDialog(true)}
                >
                  <Unlink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('noBudgetData')}</p>
                  <p className="text-xs text-muted-foreground">{t('noBudgetDataDescription')}</p>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 flex-shrink-0"
                onClick={() => setShowLinkDialog(true)}
              >
                <Link2 className="w-3.5 h-3.5" />
                {t('linkGoogleSheet')}
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Link Sheet Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('linkGoogleSheet')}</DialogTitle>
            <DialogDescription>{t('connectSheetDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder={t('sheetUrlPlaceholder')}
              className="font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowLinkDialog(false); setSheetUrl(''); }}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleLinkSheet}
                disabled={isLinking || !sheetUrl || !parseSpreadsheetUrl(sheetUrl)}
              >
                {isLinking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('connect')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirmUnlink')}</DialogTitle>
            <DialogDescription>{t('confirmUnlinkDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowUnlinkDialog(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleUnlinkSheet}>
              {t('unlinkGoogleSheet')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading indicator */}
      {isLoadingBudget && (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('loadingBudget')}</span>
        </div>
      )}

      {/* Summary Cards — Clickable Navigation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Contract Amount → 입금 현황 */}
        <Card
          className={`p-5 shadow-card cursor-pointer hover:shadow-md transition-all ${
            activeSection === 'contract'
              ? 'ring-2 ring-primary border-primary/50 shadow-lg'
              : 'hover:border-primary/30'
          }`}
          onClick={() => setActiveSection('contract')}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              activeSection === 'contract' ? 'bg-primary text-white' : 'bg-primary/10'
            }`}>
              <Banknote className={`w-5 h-5 ${activeSection === 'contract' ? '' : 'text-primary'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{t('totalContractAmountLabel')}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(displayTotalContract)}
              </p>
              <p className="text-xs text-primary">{t('vatIncludedClickBudget')}</p>
            </div>
          </div>
        </Card>

        {/* Target Expense → 예산 계획표 */}
        <Card
          className={`p-5 shadow-card cursor-pointer hover:shadow-md transition-all ${
            activeSection === 'target'
              ? 'ring-2 ring-blue-500 border-blue-500/50 shadow-lg'
              : 'hover:border-blue-500/30'
          }`}
          onClick={() => setActiveSection('target')}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              activeSection === 'target' ? 'bg-blue-500 text-white' : 'bg-blue-500/10'
            }`}>
              <TrendingDown className={`w-5 h-5 ${activeSection === 'target' ? '' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('targetExpense')}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(totalTargetExpense)}
              </p>
              <p className="text-xs text-blue-600">
                {displayTotalContract > 0 ? ((totalTargetExpense / displayTotalContract) * 100).toFixed(1) : '0'}% {t('ofTotal')}
              </p>
            </div>
          </div>
        </Card>

        {/* Actual Expense → 세금계산서/원청징수/법인카드/법인현금/개인지출 */}
        <Card
          className={`p-5 shadow-card cursor-pointer hover:shadow-md transition-all ${
            activeSection === 'actual'
              ? 'ring-2 ring-orange-500 border-orange-500/50 shadow-lg'
              : 'hover:border-orange-500/30'
          }`}
          onClick={() => setActiveSection('actual')}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              activeSection === 'actual' ? 'bg-orange-500 text-white' : 'bg-orange-500/10'
            }`}>
              <Receipt className={`w-5 h-5 ${activeSection === 'actual' ? '' : 'text-orange-600'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('actualExpense')}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(displayActualExpense)}
              </p>
              <p className="text-xs text-orange-600">
                {displayTotalContract > 0 ? ((displayActualExpense / displayTotalContract) * 100).toFixed(1) : '0'}% {t('ofTotal')}
              </p>
            </div>
          </div>
        </Card>

        {/* Actual Profit — summary only */}
        <Card
          className={`p-5 shadow-card cursor-pointer hover:shadow-md transition-all ${
            activeSection === 'profit'
              ? 'ring-2 ring-emerald-500 border-emerald-500/50 shadow-lg'
              : 'hover:border-emerald-500/30'
          }`}
          onClick={() => setActiveSection('profit')}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              activeSection === 'profit' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10'
            }`}>
              <TrendingUp className={`w-5 h-5 ${activeSection === 'profit' ? '' : 'text-emerald-600'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('actualProfit')}</p>
              <p className={`text-xl font-semibold ${displayActualProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(displayActualProfit)}
              </p>
              <p className={`text-xs font-medium ${displayActualProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {profitRate}% {t('profitRateLabel')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Budget Progress — Always visible */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">{t('budgetAchievementRate')}</h3>
            <p className="text-sm text-muted-foreground">{t('targetVsActualExpense')}</p>
          </div>
          <div className="text-right">
            <Badge variant={Number(achievementRate) > 100 ? 'destructive' : Number(achievementRate) > 80 ? 'secondary' : 'default'}>
              {achievementRate}% {t('usedPercent')}
            </Badge>
            <p className="text-sm text-emerald-600 mt-1">
              {formatCurrency(totalVariance)} {t('savedAmount')}
            </p>
          </div>
        </div>
        <Progress value={Number(achievementRate)} className="h-3" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>{t('actualExpenseShort')}: {formatCurrency(displayActualExpense)}</span>
          <span>{t('targetLabel')}: {formatCurrency(totalTargetExpense)}</span>
        </div>
      </Card>

      {/* ====== SECTION: 입금 현황 (Payment Schedules) — shown when 총 계약금액 is clicked ====== */}
      {activeSection === 'contract' && (
        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">{t('depositStatusTitle')}</h3>
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
                    placeholder={t('installment')}
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
                      placeholder={t('expectedAmount')}
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
                      {t('expectedDate')}: {schedule.expectedDate || t('undetermined')}
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
                  placeholder={`${paymentSchedules.length + 1}${t('installmentSuffix')}`}
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
                    placeholder={t('expectedAmount')}
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
                {t('addPaymentItem')}
              </button>
            )}

            <div className="flex items-center justify-between pt-2 font-semibold border-t">
              <span>{t('totalExpectedAmount')}</span>
              <span>{formatCurrency(paymentSchedules.reduce((sum, p) => sum + p.expectedAmount, 0))}</span>
            </div>
          </div>
        </Card>
      )}

      {/* ====== SECTION: 예산 계획표 (Budget Plan Table) — shown when 목표지출비용 is clicked ====== */}
      {activeSection === 'target' && (
      <Card className="shadow-card" id="budget-plan-table">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{t('budgetPlan')}</h3>
            <p className="text-sm text-muted-foreground">{t('budgetPlanGuide')}</p>
          </div>
          {budgetLink && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncBudget} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isSyncing ? t('syncingBudget') : t('syncBudget')}
            </Button>
          )}
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">No.</TableHead>
                <TableHead className="w-[120px]">{t('mainCategory')}</TableHead>
                <TableHead>{t('subCategory')}</TableHead>
                <TableHead className="text-right w-[130px]">{t('targetUnitPrice')}</TableHead>
                <TableHead className="text-center w-[80px]">{t('quantity')}</TableHead>
                <TableHead className="text-right w-[120px]">{t('targetExpenseTotal')}</TableHead>
                <TableHead className="text-right w-[120px]">{t('actualExpenseLabel')}</TableHead>
                <TableHead className="text-right w-[100px]">{t('varianceLabel')}</TableHead>
                <TableHead className="w-[100px]">{t('paymentTiming')}</TableHead>
                <TableHead className="w-[100px]">{t('note')}</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedLineItems).map(([category, items], groupIndex) => {
                const categoryTotal = items.reduce((sum, item) => sum + item.targetExpense, 0);
                const categoryActual = items.reduce((sum, item) => sum + item.actualExpenseWithVat, 0);
                const categoryVariance = categoryTotal - categoryActual;
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
                      <TableCell className="text-right font-semibold text-foreground py-2">
                        {formatCurrency(categoryActual)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold py-2 ${categoryVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(categoryVariance)}
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
                          <TableCell className="text-right text-muted-foreground">
                            {item.actualExpenseWithVat ? formatCurrency(item.actualExpenseWithVat) : '-'}
                          </TableCell>
                          <TableCell className={`text-right text-muted-foreground ${item.variance >= 0 ? '' : 'text-red-600'}`}>
                            {item.actualExpenseWithVat ? formatCurrency(item.variance) : '-'}
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
                              placeholder={t('paymentTimingPlaceholder')}
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
                          <TableCell className="text-right">{formatCurrency(item.targetExpense)}</TableCell>
                          <TableCell className="text-right">{item.actualExpenseWithVat ? formatCurrency(item.actualExpenseWithVat) : '-'}</TableCell>
                          <TableCell className={`text-right ${item.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {item.actualExpenseWithVat ? formatCurrency(item.variance) : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.paymentTiming || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm truncate max-w-[100px]">{item.note}</TableCell>
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
                  <TableCell className="text-muted-foreground">{t('newItem')}</TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.mainCategory || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, mainCategory: e.target.value }))}
                      className="h-8"
                      placeholder={t('mainCategory')}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.subCategory || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, subCategory: e.target.value }))}
                      className="h-8"
                      placeholder={t('subCategory')}
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
                  <TableCell className="text-muted-foreground text-center">-</TableCell>
                  <TableCell className="text-muted-foreground text-center">-</TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.paymentTiming || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, paymentTiming: e.target.value }))}
                      className="h-8"
                      placeholder={t('paymentTiming')}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={tempLineItem.note || ''}
                      onChange={(e) => setTempLineItem(prev => ({ ...prev, note: e.target.value }))}
                      className="h-8"
                      placeholder={t('note')}
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
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-3">
                    <Plus className="w-4 h-4 inline mr-2" />
                    {t('addNewItem')}
                  </TableCell>
                </TableRow>
              )}

              {/* Total Row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell colSpan={5} className="text-right">{t('totalSum')}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalTargetExpense)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalActualLineItems)}</TableCell>
                <TableCell className={`text-right ${totalVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(totalVariance)}
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
      )}

      {/* ====== SECTION: 실제지출 (Expense Tabs) — shown when 실제지출 is clicked ====== */}
      {activeSection === 'actual' && (
      <div className="space-y-4">
        <Tabs value={expenseTab} onValueChange={(val) => setExpenseTab(val as typeof expenseTab)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="tax_invoice" className="gap-2">
                <FileText className="w-4 h-4" />
                {t('taxInvoice')}
              </TabsTrigger>
              <TabsTrigger value="withholding" className="gap-2">
                <User className="w-4 h-4" />
                {t('withholdingTax')}
              </TabsTrigger>
              <TabsTrigger value="corporate_card" className="gap-2">
                <CreditCard className="w-4 h-4" />
                {t('corporateCard')}
              </TabsTrigger>
              <TabsTrigger value="corporate_cash" className="gap-2">
                <Building2 className="w-4 h-4" />
                {t('corporateCash')}
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2">
                <Wallet className="w-4 h-4" />
                {t('personalExpense')}
              </TabsTrigger>
            </TabsList>
            {budgetLink && (
              <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncBudget} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isSyncing ? t('syncingBudget') : t('syncBudget')}
              </Button>
            )}
          </div>

          {/* Tax Invoice Tab */}
          <TabsContent value="tax_invoice" className="mt-4">
            <Card className="shadow-card">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">No.</TableHead>
                      <TableHead className="w-[100px]">{t('paymentDueDate')}</TableHead>
                      <TableHead>{t('contentLabel')}</TableHead>
                      <TableHead className="text-right w-[120px]">{t('supplyAmount')}</TableHead>
                      <TableHead className="text-right w-[100px]">{t('taxAmountLabel')}</TableHead>
                      <TableHead className="text-right w-[120px]">{t('totalAmountLabel')}</TableHead>
                      <TableHead className="w-[150px]">{t('companyNameRep')}</TableHead>
                      <TableHead className="w-[120px]">{t('businessNumber')}</TableHead>
                      <TableHead className="w-[100px]">{t('progressStatus')}</TableHead>
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
                                <SelectItem value="PENDING">{t('pendingStatusLabel')}</SelectItem>
                                <SelectItem value="INVOICE_ISSUED">{t('invoiceIssued')}</SelectItem>
                                <SelectItem value="PAYMENT_COMPLETE">{t('paymentComplete')}</SelectItem>
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
                        <TableCell>{t('newItem')}</TableCell>
                        <TableCell>
                          <Input
                            value={tempTaxInvoice.paymentDueDate || ''}
                            onChange={(e) => setTempTaxInvoice(prev => ({ ...prev, paymentDueDate: e.target.value }))}
                            className="h-8"
                            placeholder={t('datePlaceholder')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempTaxInvoice.description || ''}
                            onChange={(e) => setTempTaxInvoice(prev => ({ ...prev, description: e.target.value }))}
                            className="h-8"
                            placeholder={t('contentLabel')}
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
                            placeholder={t('companyNameLabel')}
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
                          <Badge className="bg-yellow-100 text-yellow-700">{t('pendingStatusLabel')}</Badge>
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
                          {t('addNewTaxInvoice')}
                        </TableCell>
                      </TableRow>
                    )}

                    {taxInvoices.length > 0 && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3} className="text-right">{t('subtotal')}</TableCell>
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
                      <TableHead className="w-[100px]">{t('paymentDueDate')}</TableHead>
                      <TableHead className="w-[80px]">{t('personName')}</TableHead>
                      <TableHead className="min-w-[160px]">{t('role')}</TableHead>
                      <TableHead className="text-right w-[120px]">{t('amountLabel')}</TableHead>
                      <TableHead className="text-right w-[100px]">{t('withholdingTaxRate')}</TableHead>
                      <TableHead className="text-right w-[120px]">{t('netPayment')}</TableHead>
                      <TableHead className="w-[100px]">{t('progressStatus')}</TableHead>
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
                              placeholder={t('datePlaceholderAlt')}
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
                                <SelectItem value="PENDING">{t('pendingStatusLabel')}</SelectItem>
                                <SelectItem value="INVOICE_ISSUED">{t('invoiceIssued')}</SelectItem>
                                <SelectItem value="PAYMENT_COMPLETE">{t('paymentComplete')}</SelectItem>
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
                        <TableCell>{t('newItem')}</TableCell>
                        <TableCell>
                          <Input
                            value={tempWithholding.paymentDueDate || ''}
                            onChange={(e) => setTempWithholding(prev => ({ ...prev, paymentDueDate: e.target.value }))}
                            className="h-8"
                            placeholder={t('datePlaceholderAlt')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempWithholding.personName || ''}
                            onChange={(e) => setTempWithholding(prev => ({ ...prev, personName: e.target.value }))}
                            className="h-8"
                            placeholder={t('namePlaceholder')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempWithholding.role || ''}
                            onChange={(e) => setTempWithholding(prev => ({ ...prev, role: e.target.value }))}
                            className="h-8"
                            placeholder={t('rolePlaceholder')}
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
                          <Badge className="bg-yellow-100 text-yellow-700">{t('pendingStatusLabel')}</Badge>
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
                          {t('addNewWithholdingPayment')}
                        </TableCell>
                      </TableRow>
                    )}

                    {(budget.withholdingPayments?.length || 0) > 0 && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4} className="text-right">{t('subtotal')}</TableCell>
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
                      <TableHead className="w-[100px]">{t('usageDate')}</TableHead>
                      <TableHead>{t('usageContent')}</TableHead>
                      <TableHead className="w-[100px]">{t('usedByLabel')}</TableHead>
                      <TableHead className="text-right w-[130px]">{t('amountWithVat')}</TableHead>
                      <TableHead className="w-[120px]">{t('vendorName')}</TableHead>
                      <TableHead className="w-[120px]">{t('note')}</TableHead>
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
                        <TableCell>{t('newItem')}</TableCell>
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
                            placeholder={t('usageContentPlaceholder')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempCardExpense.usedBy || ''}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, usedBy: e.target.value }))}
                            className="h-8"
                            placeholder={t('usedByPlaceholder')}
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
                            placeholder={t('vendorPlaceholder')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tempCardExpense.note || ''}
                            onChange={(e) => setTempCardExpense(prev => ({ ...prev, note: e.target.value }))}
                            className="h-8"
                            placeholder={t('note')}
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
                          {t('addNewCorporateCardExpense')}
                        </TableCell>
                      </TableRow>
                    )}

                    {corporateCardExpenses.length > 0 && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4} className="text-right">{t('totalVatIncluded')}</TableCell>
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
              <p>{t('noCorporateCashExpenses')}</p>
              <p className="text-sm mt-2">{t('canAddDirectlyToTable')}</p>
            </Card>
          </TabsContent>

          {/* Personal Expense Tab */}
          <TabsContent value="personal" className="mt-4">
            <Card className="p-8 text-center text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('noPersonalExpenses')}</p>
              <p className="text-sm mt-2">{t('canAddDirectlyToTable')}</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      )}

      {/* ====== SECTION: 실제수익 (Profit Summary) — shown when 실제수익 is clicked ====== */}
      {activeSection === 'profit' && (
        <Card className="p-6 shadow-card">
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">{t('actualProfit')} {t('summary')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">{t('totalContractAmountLabel')}</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.totalWithVat)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">{t('actualExpense')}</p>
                <p className="text-lg font-semibold">{formatCurrency(summary.actualExpenseWithVat)}</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-sm text-muted-foreground mb-1">{t('actualProfit')} (VAT {t('vatIncludedClickBudget')})</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.actualProfitWithVat)}</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-sm text-muted-foreground mb-1">{t('profitRateLabel')}</p>
                <p className="text-2xl font-bold text-emerald-600">{profitRate}%</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
