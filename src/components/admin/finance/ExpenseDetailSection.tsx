import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutoFitText } from '@/components/ui/auto-fit-text';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  ArrowUpDown,
  FileText,
  CreditCard,
  Wallet,
  User,
  Banknote,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { formatKRW } from '@/lib/format';
import { mockProjects, projectFinancials } from '@/mock/data';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

type ExpenseType = 'TAX_INVOICE' | 'WITHHOLDING' | 'CORPORATE_CARD' | 'CORPORATE_CASH' | 'PERSONAL';
type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface ExpenseItem {
  id: string;
  projectId: string;
  projectName: string;
  paymentDate?: string;
  description: string;
  amount: number;
  vendor?: string;
  status: 'PENDING' | 'INVOICE_ISSUED' | 'PAYMENT_COMPLETE';
  note?: string;
  expenseType?: ExpenseType;
}

interface ApprovalStep {
  approverId: string;
  approverName: string;
  approverRole: string;
  status: ApprovalStatus;
  comment?: string;
  timestamp?: string;
}

interface ApprovalRequest {
  id: string;
  expenseId: string;
  requesterId: string;
  requesterName: string;
  projectName: string;
  expenseType: ExpenseType;
  description: string;
  amount: number;
  steps: ApprovalStep[];
  currentStep: number;
  status: ApprovalStatus;
  createdAt: string;
}

// Generate expense data from real projects
const generateExpenseItems = (filterYear?: number) => {
  const taxInvoices: ExpenseItem[] = [];
  const withholding: ExpenseItem[] = [];
  const corporateCard: ExpenseItem[] = [];
  const corporateCash: ExpenseItem[] = [];
  const personalExpense: ExpenseItem[] = [];

  projectFinancials.forEach((fin, idx) => {
    const project = mockProjects.find(p => p.id === fin.projectId);
    if (!project || fin.actualExpense === 0) return;
    if (filterYear) {
      const startYear = new Date(project.startDate).getFullYear();
      const endYear = new Date(project.endDate).getFullYear();
      if (startYear > filterYear || endYear < filterYear) return;
    }

    const projectName = project.title.length > 25 ? project.title.substring(0, 25) + '...' : project.title;
    const baseDate = project.startDate.substring(0, 7);

    const taxAmount = Math.round(fin.actualExpense * 0.45);
    const withholdingAmount = Math.round(fin.actualExpense * 0.25);
    const cardAmount = Math.round(fin.actualExpense * 0.12);
    const cashAmount = Math.round(fin.actualExpense * 0.1);
    const personalAmount = fin.actualExpense - taxAmount - withholdingAmount - cardAmount - cashAmount;

    if (taxAmount > 0) {
      taxInvoices.push({
        id: `t${idx}`, projectId: fin.projectId, projectName,
        paymentDate: `${baseDate}-25`, description: '촬영/제작 외주비',
        amount: taxAmount, vendor: '프로덕션 파트너', status: 'PAYMENT_COMPLETE',
        expenseType: 'TAX_INVOICE',
      });
    }
    if (withholdingAmount > 0) {
      withholding.push({
        id: `w${idx}`, projectId: fin.projectId, projectName,
        paymentDate: `${baseDate}-28`, description: '감독/스태프 용역비',
        amount: withholdingAmount, vendor: '프리랜서 스태프', status: 'PAYMENT_COMPLETE',
        expenseType: 'WITHHOLDING',
      });
    }
    if (cardAmount > 0) {
      corporateCard.push({
        id: `c${idx}`, projectId: fin.projectId, projectName,
        paymentDate: `${baseDate}-15`, description: '촬영 소품/장비/식대',
        amount: cardAmount, vendor: '각종 업체', status: 'PAYMENT_COMPLETE',
        expenseType: 'CORPORATE_CARD',
      });
    }
    if (cashAmount > 0) {
      corporateCash.push({
        id: `cc${idx}`, projectId: fin.projectId, projectName,
        paymentDate: `${baseDate}-20`, description: '현장 경비/렌탈비',
        amount: cashAmount, vendor: '현금 지출', status: 'PAYMENT_COMPLETE',
        expenseType: 'CORPORATE_CASH',
      });
    }
    if (personalAmount > 0) {
      personalExpense.push({
        id: `pe${idx}`, projectId: fin.projectId, projectName,
        paymentDate: `${baseDate}-30`, description: '교통비/식비 정산',
        amount: personalAmount, status: 'PAYMENT_COMPLETE', note: '팀원 정산',
        expenseType: 'PERSONAL',
      });
    }
  });

  return { taxInvoices, withholding, corporateCard, corporateCash, personalExpense };
};

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  TAX_INVOICE: '세금계산서',
  WITHHOLDING: '원천징수',
  CORPORATE_CARD: '법인카드',
  CORPORATE_CASH: '법인현금',
  PERSONAL: '개인지출',
};

// Default approval chain
const DEFAULT_APPROVAL_CHAIN = [
  { role: '팀장', name: '' },
  { role: '본부장', name: '' },
  { role: '대표이사', name: '김경신' },
];

type SortBy = 'date' | 'project' | 'amount';

interface ExpenseDetailSectionProps {
  year: number;
}

export function ExpenseDetailSection({ year }: ExpenseDetailSectionProps) {
  const { t } = useTranslation();
  const { currentUser, users } = useAppStore();
  const [activeTab, setActiveTab] = useState('tax');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filterProject, setFilterProject] = useState<string>('all');

  // New expense dialog
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [newExpenseData, setNewExpenseData] = useState({
    projectId: '', description: '', amount: 0, vendor: '',
    expenseType: 'TAX_INVOICE' as ExpenseType, paymentDate: '',
  });

  // Approval submission dialog
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalExpense, setApprovalExpense] = useState<ExpenseItem | null>(null);
  const [approvalChain, setApprovalChain] = useState(DEFAULT_APPROVAL_CHAIN.map(s => ({ ...s })));

  // Approval requests state
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [approvalReviewOpen, setApprovalReviewOpen] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<ApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // User-added expenses
  const [addedExpenses, setAddedExpenses] = useState<ExpenseItem[]>([]);

  const { taxInvoices: mockTaxInvoices, withholding: mockWithholding, corporateCard: mockCorporateCard, corporateCash: mockCorporateCash, personalExpense: mockPersonalExpense } = generateExpenseItems(year);

  // Merge mock + user-added
  const allTaxInvoices = [...mockTaxInvoices, ...addedExpenses.filter(e => e.expenseType === 'TAX_INVOICE')];
  const allWithholding = [...mockWithholding, ...addedExpenses.filter(e => e.expenseType === 'WITHHOLDING')];
  const allCorporateCard = [...mockCorporateCard, ...addedExpenses.filter(e => e.expenseType === 'CORPORATE_CARD')];
  const allCorporateCash = [...mockCorporateCash, ...addedExpenses.filter(e => e.expenseType === 'CORPORATE_CASH')];
  const allPersonalExpense = [...mockPersonalExpense, ...addedExpenses.filter(e => e.expenseType === 'PERSONAL')];

  const projects = mockProjects
    .filter(p => {
      const startYear = new Date(p.startDate).getFullYear();
      const endYear = new Date(p.endDate).getFullYear();
      return startYear <= year && endYear >= year && projectFinancials.find(f => f.projectId === p.id && f.actualExpense > 0);
    })
    .map(p => ({ id: p.id, name: p.title.length > 20 ? p.title.substring(0, 20) + '...' : p.title }));

  const filterAndSort = (items: ExpenseItem[]) => {
    const filtered = items.filter(item =>
      (filterProject === 'all' || item.projectId === filterProject) &&
      (item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
       item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       item.vendor?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date': return (a.paymentDate || '').localeCompare(b.paymentDate || '');
        case 'project': return a.projectName.localeCompare(b.projectName);
        case 'amount': return b.amount - a.amount;
        default: return 0;
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_COMPLETE':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t('statusPaymentComplete')}</Badge>;
      case 'INVOICE_ISSUED':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{t('statusInvoiceIssued')}</Badge>;
      default:
        return <Badge variant="outline">{t('statusPending')}</Badge>;
    }
  };

  const calculateTotal = (items: ExpenseItem[]) =>
    items.reduce((sum, item) => sum + item.amount, 0);

  const handleAddExpense = () => {
    if (!newExpenseData.projectId || !newExpenseData.description || !newExpenseData.amount) {
      toast.error('프로젝트, 내용, 금액은 필수입니다');
      return;
    }
    const project = mockProjects.find(p => p.id === newExpenseData.projectId);
    const newItem: ExpenseItem = {
      id: `new-${Date.now()}`,
      projectId: newExpenseData.projectId,
      projectName: project?.title?.substring(0, 25) || '',
      paymentDate: newExpenseData.paymentDate || new Date().toISOString().substring(0, 10),
      description: newExpenseData.description,
      amount: newExpenseData.amount,
      vendor: newExpenseData.vendor,
      status: 'PENDING',
      expenseType: newExpenseData.expenseType,
    };
    setAddedExpenses(prev => [...prev, newItem]);
    setNewExpenseOpen(false);
    setNewExpenseData({ projectId: '', description: '', amount: 0, vendor: '', expenseType: 'TAX_INVOICE', paymentDate: '' });
    toast.success('실제지출이 등록되었습니다');
  };

  const handleOpenApproval = (item: ExpenseItem) => {
    setApprovalExpense(item);
    setApprovalChain(DEFAULT_APPROVAL_CHAIN.map(s => ({ ...s })));
    setApprovalDialogOpen(true);
  };

  const handleSubmitApproval = () => {
    if (!approvalExpense || !currentUser) return;
    const request: ApprovalRequest = {
      id: `apr-${Date.now()}`,
      expenseId: approvalExpense.id,
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      projectName: approvalExpense.projectName,
      expenseType: approvalExpense.expenseType || 'TAX_INVOICE',
      description: approvalExpense.description,
      amount: approvalExpense.amount,
      steps: approvalChain.map(s => ({
        approverId: users.find(u => u.name === s.name)?.id || '',
        approverName: s.name,
        approverRole: s.role,
        status: 'PENDING' as ApprovalStatus,
      })),
      currentStep: 0,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    setApprovalRequests(prev => [...prev, request]);
    setApprovalDialogOpen(false);
    toast.success(`기안이 상신되었습니다. ${approvalChain[0].role} (${approvalChain[0].name || '미지정'})에게 결재 요청됩니다.`);
  };

  const handleApprove = (requestId: string) => {
    setApprovalRequests(prev => prev.map(req => {
      if (req.id !== requestId) return req;
      const updated = { ...req, steps: [...req.steps] };
      updated.steps[updated.currentStep] = {
        ...updated.steps[updated.currentStep],
        status: 'APPROVED',
        timestamp: new Date().toISOString(),
      };
      if (updated.currentStep < updated.steps.length - 1) {
        updated.currentStep += 1;
        toast.success(`결재 완료. ${updated.steps[updated.currentStep].approverRole}에게 상신됩니다.`);
      } else {
        updated.status = 'APPROVED';
        toast.success('최종 결재 완료되었습니다.');
      }
      return updated;
    }));
    setApprovalReviewOpen(false);
  };

  const handleReject = (requestId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('반송 사유를 입력해주세요');
      return;
    }
    setApprovalRequests(prev => prev.map(req => {
      if (req.id !== requestId) return req;
      const updated = { ...req, steps: [...req.steps] };
      updated.steps[updated.currentStep] = {
        ...updated.steps[updated.currentStep],
        status: 'REJECTED',
        comment: rejectionReason,
        timestamp: new Date().toISOString(),
      };
      updated.status = 'REJECTED';
      return updated;
    }));
    setApprovalReviewOpen(false);
    setRejectionReason('');
    toast.info('기안이 반송되었습니다.');
  };

  const renderTable = (items: ExpenseItem[], showVendor = true) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('paymentDate')}</TableHead>
          <TableHead>{t('projectColumn')}</TableHead>
          <TableHead>{t('contentColumnDetail')}</TableHead>
          {showVendor && <TableHead>{t('vendorTarget')}</TableHead>}
          <TableHead className="text-right">{t('amountColumn')}</TableHead>
          <TableHead className="text-center">{t('statusColumn')}</TableHead>
          <TableHead className="text-center w-[100px]">기안</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filterAndSort(items).map((item) => {
          const hasApproval = approvalRequests.find(r => r.expenseId === item.id);
          return (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">{item.paymentDate || '-'}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">{item.projectName}</Badge>
              </TableCell>
              <TableCell className="font-medium">{item.description}</TableCell>
              {showVendor && <TableCell className="text-muted-foreground">{item.vendor || '-'}</TableCell>}
              <TableCell className="text-right font-mono font-semibold">{formatKRW(item.amount)}</TableCell>
              <TableCell className="text-center">{getStatusBadge(item.status)}</TableCell>
              <TableCell className="text-center">
                {hasApproval ? (
                  <Button
                    variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                    onClick={() => { setReviewingRequest(hasApproval); setApprovalReviewOpen(true); }}
                  >
                    {hasApproval.status === 'APPROVED' ? (
                      <><CheckCircle className="w-3 h-3 text-green-600" /> 결재완료</>
                    ) : hasApproval.status === 'REJECTED' ? (
                      <><XCircle className="w-3 h-3 text-red-600" /> 반송</>
                    ) : (
                      <><Clock className="w-3 h-3 text-amber-600" /> 결재중</>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline" size="sm" className="h-7 gap-1 text-xs"
                    onClick={() => handleOpenApproval(item)}
                  >
                    <Send className="w-3 h-3" /> 기안상신
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell colSpan={showVendor ? 5 : 4} className="text-right">{t('totalSumDetail')}</TableCell>
          <TableCell className="text-right font-mono">{formatKRW(calculateTotal(filterAndSort(items)))}</TableCell>
          <TableCell></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  const totalTaxInvoice = calculateTotal(allTaxInvoices);
  const totalWithholding = calculateTotal(allWithholding);
  const totalCard = calculateTotal(allCorporateCard);
  const totalCash = calculateTotal(allCorporateCash);
  const totalPersonal = calculateTotal(allPersonalExpense);
  const grandTotal = totalTaxInvoice + totalWithholding + totalCard + totalCash + totalPersonal;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-xs text-muted-foreground">{t('typeTaxInvoice')}</p>
          </div>
          <AutoFitText className="text-lg font-bold text-foreground mt-1">{formatKRW(totalTaxInvoice)}</AutoFitText>
          <p className="text-[10px] text-muted-foreground">{allTaxInvoices.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-violet-500 shrink-0" />
            <p className="text-xs text-muted-foreground">{t('typeWithholding')}</p>
          </div>
          <AutoFitText className="text-lg font-bold text-foreground mt-1">{formatKRW(totalWithholding)}</AutoFitText>
          <p className="text-[10px] text-muted-foreground">{allWithholding.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-orange-500 shrink-0" />
            <p className="text-xs text-muted-foreground">{t('typeCorporateCard')}</p>
          </div>
          <AutoFitText className="text-lg font-bold text-foreground mt-1">{formatKRW(totalCard)}</AutoFitText>
          <p className="text-[10px] text-muted-foreground">{allCorporateCard.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-teal-500 shrink-0" />
            <p className="text-xs text-muted-foreground">법인현금</p>
          </div>
          <AutoFitText className="text-lg font-bold text-foreground mt-1">{formatKRW(totalCash)}</AutoFitText>
          <p className="text-[10px] text-muted-foreground">{allCorporateCash.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-gray-500 shrink-0" />
            <p className="text-xs text-muted-foreground">{t('typePersonalExpense')}</p>
          </div>
          <AutoFitText className="text-lg font-bold text-foreground mt-1">{formatKRW(totalPersonal)}</AutoFitText>
          <p className="text-[10px] text-muted-foreground">{allPersonalExpense.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card bg-primary/5 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">{t('totalExpenseAll')}</p>
          </div>
          <AutoFitText className="text-lg font-bold text-primary mt-1">{formatKRW(grandTotal)}</AutoFitText>
        </Card>
      </div>

      {/* Filters + Add button */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('searchContentProjectVendor')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder={t('selectProject')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allProjectsFilter')}</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">{t('sortByDate')}</SelectItem>
              <SelectItem value="project">{t('sortByProject')}</SelectItem>
              <SelectItem value="amount">{t('sortByAmount')}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-2" onClick={() => setNewExpenseOpen(true)}>
            <Plus className="w-4 h-4" /> 실제지출 등록
          </Button>
        </div>
      </Card>

      {/* Pending Approvals (for current user) */}
      {approvalRequests.filter(r => r.status === 'PENDING').length > 0 && (
        <Card className="p-4 shadow-card border-amber-200 dark:border-amber-800">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            결재 대기 ({approvalRequests.filter(r => r.status === 'PENDING').length}건)
          </h3>
          <div className="space-y-2">
            {approvalRequests.filter(r => r.status === 'PENDING').map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{req.projectName} — {req.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>기안자: {req.requesterName}</span>
                    <span>{EXPENSE_TYPE_LABELS[req.expenseType]}</span>
                    <span className="font-mono">{formatKRW(req.amount)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {req.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <Badge
                          variant={step.status === 'APPROVED' ? 'default' : step.status === 'REJECTED' ? 'destructive' : 'outline'}
                          className={`text-[10px] ${step.status === 'APPROVED' ? 'bg-green-100 text-green-700' : idx === req.currentStep ? 'bg-amber-100 text-amber-700' : ''}`}
                        >
                          {step.approverRole}{step.approverName ? ` (${step.approverName})` : ''}
                        </Badge>
                        {idx < req.steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm" variant="outline" className="ml-3 gap-1"
                  onClick={() => { setReviewingRequest(req); setApprovalReviewOpen(true); }}
                >
                  결재하기
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Expense Tabs */}
      <Card className="shadow-card">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4 overflow-x-auto">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="tax" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <FileText className="w-4 h-4" />
                세금계산서
                <Badge variant="secondary" className="ml-1">{allTaxInvoices.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="withholding" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <FileText className="w-4 h-4" />
                원천징수
                <Badge variant="secondary" className="ml-1">{allWithholding.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <CreditCard className="w-4 h-4" />
                법인카드
                <Badge variant="secondary" className="ml-1">{allCorporateCard.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="cash" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <Banknote className="w-4 h-4" />
                법인현금
                <Badge variant="secondary" className="ml-1">{allCorporateCash.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <User className="w-4 h-4" />
                개인지출
                <Badge variant="secondary" className="ml-1">{allPersonalExpense.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="tax" className="m-0">{renderTable(allTaxInvoices)}</TabsContent>
          <TabsContent value="withholding" className="m-0">{renderTable(allWithholding)}</TabsContent>
          <TabsContent value="card" className="m-0">{renderTable(allCorporateCard)}</TabsContent>
          <TabsContent value="cash" className="m-0">{renderTable(allCorporateCash)}</TabsContent>
          <TabsContent value="personal" className="m-0">{renderTable(allPersonalExpense)}</TabsContent>
        </Tabs>
      </Card>

      {/* New Expense Dialog */}
      <Dialog open={newExpenseOpen} onOpenChange={setNewExpenseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> 실제지출 등록
            </DialogTitle>
            <DialogDescription>프로젝트 실제지출을 등록합니다</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 grid-cols-2">
            <div className="space-y-1.5 col-span-2">
              <Label>프로젝트</Label>
              <Select value={newExpenseData.projectId} onValueChange={(v) => setNewExpenseData(prev => ({ ...prev, projectId: v }))}>
                <SelectTrigger><SelectValue placeholder="프로젝트 선택" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>지출 유형</Label>
              <Select value={newExpenseData.expenseType} onValueChange={(v) => setNewExpenseData(prev => ({ ...prev, expenseType: v as ExpenseType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAX_INVOICE">세금계산서</SelectItem>
                  <SelectItem value="WITHHOLDING">원천징수</SelectItem>
                  <SelectItem value="CORPORATE_CARD">법인카드</SelectItem>
                  <SelectItem value="CORPORATE_CASH">법인현금</SelectItem>
                  <SelectItem value="PERSONAL">개인지출</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>지출일</Label>
              <Input type="date" value={newExpenseData.paymentDate} onChange={(e) => setNewExpenseData(prev => ({ ...prev, paymentDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>내용</Label>
              <Input placeholder="촬영/제작 외주비 등" value={newExpenseData.description} onChange={(e) => setNewExpenseData(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>금액 (원)</Label>
              <Input type="number" placeholder="0" value={newExpenseData.amount || ''} onChange={(e) => setNewExpenseData(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>거래처</Label>
              <Input placeholder="프로덕션 파트너" value={newExpenseData.vendor} onChange={(e) => setNewExpenseData(prev => ({ ...prev, vendor: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewExpenseOpen(false)}>취소</Button>
            <Button onClick={handleAddExpense}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Submission Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" /> 기안상신
            </DialogTitle>
            <DialogDescription>
              {approvalExpense?.projectName} — {approvalExpense?.description}
              <span className="block font-mono text-foreground mt-1">{approvalExpense ? formatKRW(approvalExpense.amount) : ''}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">기안자</Label>
              <p className="text-sm text-muted-foreground mt-1">{currentUser?.name} ({currentUser?.role})</p>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">결재선 (수정 가능)</Label>
              <div className="space-y-2">
                {approvalChain.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-16 justify-center text-xs">{step.role}</Badge>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <Select
                      value={step.name}
                      onValueChange={(v) => {
                        setApprovalChain(prev => prev.map((s, i) => i === idx ? { ...s, name: v } : s));
                      }}
                    >
                      <SelectTrigger className="flex-1 h-8">
                        <SelectValue placeholder="결재자 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => <SelectItem key={u.id} value={u.name}>{u.name} ({u.role})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {approvalChain.length > 1 && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setApprovalChain(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>취소</Button>
            <Button onClick={handleSubmitApproval} className="gap-2">
              <Send className="w-4 h-4" /> 상신
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Review Dialog */}
      <Dialog open={approvalReviewOpen} onOpenChange={setApprovalReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>기안 결재</DialogTitle>
            <DialogDescription>
              {reviewingRequest?.projectName} — {reviewingRequest?.description}
            </DialogDescription>
          </DialogHeader>
          {reviewingRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">기안자:</span> {reviewingRequest.requesterName}</div>
                <div><span className="text-muted-foreground">유형:</span> {EXPENSE_TYPE_LABELS[reviewingRequest.expenseType]}</div>
                <div><span className="text-muted-foreground">금액:</span> <span className="font-mono">{formatKRW(reviewingRequest.amount)}</span></div>
                <div><span className="text-muted-foreground">일시:</span> {new Date(reviewingRequest.createdAt).toLocaleDateString('ko-KR')}</div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">결재 현황</Label>
                <div className="space-y-2">
                  {reviewingRequest.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded border">
                      {step.status === 'APPROVED' ? (
                        <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                      ) : step.status === 'REJECTED' ? (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : idx === reviewingRequest.currentStep ? (
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                      <span className="text-sm flex-1">
                        {step.approverRole} — {step.approverName || '미지정'}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {step.status === 'APPROVED' ? '결재완료' : step.status === 'REJECTED' ? '반송' : idx === reviewingRequest.currentStep ? '결재대기' : '대기'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              {reviewingRequest.status === 'PENDING' && (
                <div className="space-y-2">
                  <Label>반송 사유 (반송 시)</Label>
                  <Textarea
                    placeholder="반송 사유를 입력해주세요"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {reviewingRequest?.status === 'PENDING' ? (
              <>
                <Button variant="outline" onClick={() => handleReject(reviewingRequest.id)} className="gap-1 text-red-600">
                  <XCircle className="w-4 h-4" /> 반송
                </Button>
                <Button onClick={() => handleApprove(reviewingRequest.id)} className="gap-1">
                  <CheckCircle className="w-4 h-4" /> 결재
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setApprovalReviewOpen(false)}>닫기</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
