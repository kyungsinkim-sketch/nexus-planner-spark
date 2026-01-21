import { useState } from 'react';
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
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type {
  ProjectBudget,
  BudgetLineItem,
  TaxInvoice,
  WithholdingPayment,
  CorporateCardExpense,
  CorporateCashExpense,
  PersonalExpense,
  PaymentStatus,
} from '@/types/budget';

interface BudgetTabProps {
  projectId: string;
}

// Mock budget data based on actual Excel structure
const mockBudgetData: ProjectBudget = {
  summary: {
    id: 'budget-1',
    projectId: 'p1',
    companyName: 'KPR',
    contractName: 'HMG 배터리 데이 영상 제작',
    department: 'NEXT',
    author: '홍원준',
    shootingDate: '',
    phase: '후반편집',
    totalContractAmount: 200000000,
    vatAmount: 20000000,
    totalWithVat: 220000000,
    targetExpenseWithVat: 22110000,
    targetProfitWithVat: 197890000,
    actualExpenseWithVat: 15134000,
    actualProfitWithVat: 204866000,
    actualExpenseWithoutVat: 6242562,
    actualProfitWithoutVat: 193757438,
  },
  paymentSchedules: [
    { id: 'ps-1', projectId: 'p1', installment: '1차(선금)', expectedAmount: 110000000, expectedDate: '2025-03-10', actualAmount: 110000000, balance: 110000000 },
    { id: 'ps-2', projectId: 'p1', installment: '2차(중도)', expectedAmount: 0, actualAmount: 0, balance: 110000000 },
    { id: 'ps-3', projectId: 'p1', installment: '3차(잔액)', expectedAmount: 110000000, expectedDate: '미정', actualAmount: 0, balance: 110000000 },
  ],
  lineItems: [
    { id: 'li-1', projectId: 'p1', orderNo: 1, completed: false, category: '3D_INFRASTRUCTURE', mainCategory: '3D', subCategory: '3D 랜더링 컴퓨터 구입 OR 랜더팜', targetUnitPrice: 10000000, quantity: 1, targetExpense: 10000000, vatRate: 0.1, targetExpenseWithVat: 11000000, actualExpenseWithVat: 10000000, note: '대표님 카드로 구매', variance: 1000000 },
    { id: 'li-2', projectId: 'p1', orderNo: 2, completed: false, category: '3D_INFRASTRUCTURE', mainCategory: '3D', subCategory: '3D 에셋 구매 및 예비비', targetUnitPrice: 3000000, quantity: 1, targetExpense: 3000000, vatRate: 0.1, targetExpenseWithVat: 3300000, actualExpenseWithVat: 550000, note: '법인카드 탭 비고란 링크 참고', variance: 2750000 },
    { id: 'li-3', projectId: 'p1', orderNo: 3, completed: false, category: '2D_MOTION', mainCategory: '2d', subCategory: '2d 모션그래픽_김희진님', targetUnitPrice: 3000000, quantity: 1, targetExpense: 3000000, vatRate: 0.1, targetExpenseWithVat: 3300000, actualExpenseWithVat: 3300000, note: '프리랜서', variance: 0 },
    { id: 'li-4', projectId: 'p1', orderNo: 4, completed: false, category: 'RECORDING', mainCategory: '녹음', subCategory: '녹음료', targetUnitPrice: 2000000, quantity: 1, targetExpense: 2000000, vatRate: 0.1, targetExpenseWithVat: 2200000, actualExpenseWithVat: 0, note: '2026년 영상 업데이트 진행 시 사용 예정', variance: 2200000 },
    { id: 'li-5', projectId: 'p1', orderNo: 5, completed: false, category: 'VOICE_ACTOR', mainCategory: '성우', subCategory: '성우료 (국문/영문)', targetUnitPrice: 500000, quantity: 2, targetExpense: 1000000, vatRate: 0.1, targetExpenseWithVat: 1100000, actualExpenseWithVat: 0, variance: 1100000 },
    { id: 'li-6', projectId: 'p1', orderNo: 6, completed: false, category: 'EQUIPMENT', mainCategory: '비품', subCategory: '외장하드 20TB', targetUnitPrice: 550000, quantity: 2, targetExpense: 1100000, vatRate: 0.1, targetExpenseWithVat: 1210000, actualExpenseWithVat: 1198000, variance: 12000 },
  ],
  taxInvoices: [
    { id: 'ti-1', projectId: 'p1', orderNo: 1, paymentDueDate: '9월 말', description: '김희진 2D 모션 디자이너 선금', supplyAmount: 300000, taxAmount: 30000, totalAmount: 330000, companyName: '젠디자인랩(Jen Design Lab)/김희진', businessNumber: '876-13-02410', bank: '하나', accountNumber: '571-910550-14407', status: 'PAYMENT_COMPLETE', issueDate: '2025-09-18', paymentDate: '2025-09-30' },
    { id: 'ti-2', projectId: 'p1', orderNo: 2, paymentDueDate: '11월 말', description: '김희진 2D 모션 디자이너 잔금', supplyAmount: 2700000, taxAmount: 270000, totalAmount: 2970000, companyName: '젠디자인랩(Jen Design Lab)/김희진', businessNumber: '876-13-02410', bank: '하나', accountNumber: '571-910550-14407', status: 'PAYMENT_COMPLETE', issueDate: '2025-11-25', paymentDate: '2025-12-31' },
  ],
  withholdingPayments: [],
  corporateCardExpenses: [
    { id: 'cc-1', projectId: 'p1', orderNo: 1, cardHolder: '홍원준', receiptSubmitted: true, usageDate: '2025-04-08', description: '외장하드', usedBy: '홍원준', amountWithVat: 1198000, vendor: '다나와', note: '20TB X 2개' },
    { id: 'cc-2', projectId: 'p1', orderNo: 2, cardHolder: '7974', receiptSubmitted: true, usageDate: '2025-03-25', description: '3D 이미지 구매', usedBy: '티아고', amountWithVat: 91389, amountUsd: 61.60, vendor: 'FS *3dsky' },
    { id: 'cc-3', projectId: 'p1', orderNo: 3, cardHolder: '7974', receiptSubmitted: true, usageDate: '2025-03-25', description: '3D 이미지 구매', usedBy: '티아고', amountWithVat: 141008, amountUsd: 95.00, vendor: 'Hum 3D' },
    { id: 'cc-4', projectId: 'p1', orderNo: 4, cardHolder: '7974', receiptSubmitted: true, usageDate: '2025-03-25', description: '3D 이미지 구매', usedBy: '티아고', amountWithVat: 513117, amountUsd: 345.79, vendor: 'CGTrader' },
  ],
  corporateCashExpenses: [],
  personalExpenses: [],
};

export function BudgetTab({ projectId }: BudgetTabProps) {
  const { t, language } = useTranslation();
  const [budget] = useState<ProjectBudget>(mockBudgetData);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseType, setExpenseType] = useState<'tax_invoice' | 'withholding' | 'corporate_card' | 'corporate_cash' | 'personal'>('corporate_card');

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
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">총 계약금액</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(summary.totalWithVat)}
              </p>
              <p className="text-xs text-muted-foreground">VAT 포함</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">목표지출비용</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(summary.targetExpenseWithVat)}
              </p>
              <p className="text-xs text-muted-foreground">
                {((summary.targetExpenseWithVat / summary.totalWithVat) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>

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
              <p className="text-xs text-muted-foreground">
                {((summary.actualExpenseWithVat / summary.totalWithVat) * 100).toFixed(2)}%
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

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">예산계획</TabsTrigger>
            <TabsTrigger value="tax_invoice">세금계산서</TabsTrigger>
            <TabsTrigger value="withholding">원천징수</TabsTrigger>
            <TabsTrigger value="corporate_card">법인카드</TabsTrigger>
            <TabsTrigger value="corporate_cash">법인현금</TabsTrigger>
            <TabsTrigger value="personal">개인지출</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              내보내기
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setShowAddExpenseModal(true)}>
              <Plus className="w-4 h-4" />
              지출 추가
            </Button>
          </div>
        </div>

        {/* Overview - Budget Plan */}
        <TabsContent value="overview" className="mt-4">
          <Card className="shadow-card">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">완료</TableHead>
                    <TableHead>No.</TableHead>
                    <TableHead>대분류</TableHead>
                    <TableHead>소분류</TableHead>
                    <TableHead className="text-right">목표단가</TableHead>
                    <TableHead className="text-center">수량</TableHead>
                    <TableHead className="text-right">목표지출합계</TableHead>
                    <TableHead className="text-right">실지출액</TableHead>
                    <TableHead className="text-right">차액</TableHead>
                    <TableHead>비고</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox checked={item.completed} />
                      </TableCell>
                      <TableCell>{item.orderNo}</TableCell>
                      <TableCell className="font-medium">{item.mainCategory}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.subCategory}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.targetUnitPrice)}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.targetExpenseWithVat)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.actualExpenseWithVat)}</TableCell>
                      <TableCell className={`text-right ${item.variance > 0 ? 'text-emerald-600' : item.variance < 0 ? 'text-red-600' : ''}`}>
                        {item.variance > 0 ? '+' : ''}{formatCurrency(item.variance)}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground text-sm">{item.note}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={6} className="text-right">합계</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalTargetExpense)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalActualExpense)}</TableCell>
                    <TableCell className={`text-right ${totalVariance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

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
                <h4 className="font-medium text-sm text-muted-foreground">세금계산서 정보</h4>
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
                    <Input placeholder="회사명 입력" />
                  </div>
                  <div className="space-y-2">
                    <Label>대표자 <span className="text-destructive">*</span></Label>
                    <Input placeholder="대표자 성함" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사업자번호 <span className="text-destructive">*</span></Label>
                    <Input placeholder="000-00-00000" />
                  </div>
                  <div className="space-y-2">
                    <Label>은행</Label>
                    <Input placeholder="은행명" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>계좌번호</Label>
                  <Input placeholder="계좌번호 입력" />
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
                <h4 className="font-medium text-sm text-muted-foreground">원천징수 (용역비) 정보</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>입금약일 <span className="text-destructive">*</span></Label>
                    <Input placeholder="예: 00.00.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>이름 <span className="text-destructive">*</span></Label>
                    <Input placeholder="용역자 성함" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>역할 <span className="text-destructive">*</span></Label>
                  <Input placeholder="예: 2D 모션그래픽, 3D 모델러" />
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
                    <Input placeholder="주식회사 OOO / 홍길동" />
                  </div>
                  <div className="space-y-2">
                    <Label>사업자번호</Label>
                    <Input placeholder="000-00-00000" />
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
                <h4 className="font-medium text-sm text-muted-foreground">법인카드 사용 내역</h4>
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
                    <Input placeholder="거래처/업체명" />
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
                <h4 className="font-medium text-sm text-muted-foreground">법인현금 사용 내역</h4>
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
                    <Input placeholder="거래처/업체명" />
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
                <h4 className="font-medium text-sm text-muted-foreground">개인지출 내역</h4>
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
                    <Input placeholder="거래처/업체명" />
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
    </div>
  );
}
