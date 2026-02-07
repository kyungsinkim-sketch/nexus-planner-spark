import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Search, 
  ArrowUpDown,
  FileText,
  CreditCard,
  Wallet,
  User
} from 'lucide-react';
import { formatKRW } from '@/lib/format';
import { mockProjects, projectFinancials } from '@/mock/data';

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
}

// Generate expense data from real projects
const generateExpenseItems = () => {
  const taxInvoices: ExpenseItem[] = [];
  const withholding: ExpenseItem[] = [];
  const corporateCard: ExpenseItem[] = [];
  const personalExpense: ExpenseItem[] = [];

  projectFinancials.forEach((fin, idx) => {
    const project = mockProjects.find(p => p.id === fin.projectId);
    if (!project || fin.actualExpense === 0) return;

    const projectName = project.title.length > 25 ? project.title.substring(0, 25) + '...' : project.title;
    const baseDate = project.startDate.substring(0, 7); // YYYY-MM

    // Distribute expenses across categories (approximate breakdown)
    const taxAmount = Math.round(fin.actualExpense * 0.55);
    const withholdingAmount = Math.round(fin.actualExpense * 0.25);
    const cardAmount = Math.round(fin.actualExpense * 0.12);
    const personalAmount = fin.actualExpense - taxAmount - withholdingAmount - cardAmount;

    if (taxAmount > 0) {
      taxInvoices.push({
        id: `t${idx}`,
        projectId: fin.projectId,
        projectName,
        paymentDate: `${baseDate}-25`,
        description: '촬영/제작 외주비',
        amount: taxAmount,
        vendor: '프로덕션 파트너',
        status: 'PAYMENT_COMPLETE',
      });
    }

    if (withholdingAmount > 0) {
      withholding.push({
        id: `w${idx}`,
        projectId: fin.projectId,
        projectName,
        paymentDate: `${baseDate}-28`,
        description: '감독/스태프 용역비',
        amount: withholdingAmount,
        vendor: '프리랜서 스태프',
        status: 'PAYMENT_COMPLETE',
      });
    }

    if (cardAmount > 0) {
      corporateCard.push({
        id: `c${idx}`,
        projectId: fin.projectId,
        projectName,
        paymentDate: `${baseDate}-15`,
        description: '촬영 소품/장비/식대',
        amount: cardAmount,
        vendor: '각종 업체',
        status: 'PAYMENT_COMPLETE',
      });
    }

    if (personalAmount > 0) {
      personalExpense.push({
        id: `pe${idx}`,
        projectId: fin.projectId,
        projectName,
        paymentDate: `${baseDate}-30`,
        description: '교통비/식비 정산',
        amount: personalAmount,
        status: 'PAYMENT_COMPLETE',
        note: '팀원 정산',
      });
    }
  });

  return { taxInvoices, withholding, corporateCard, personalExpense };
};

const { taxInvoices: mockTaxInvoices, withholding: mockWithholding, corporateCard: mockCorporateCard, personalExpense: mockPersonalExpense } = generateExpenseItems();

type SortBy = 'date' | 'project' | 'amount';

export function ExpenseDetailSection() {
  const [activeTab, setActiveTab] = useState('tax');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filterProject, setFilterProject] = useState<string>('all');

  const projects = mockProjects
    .filter(p => projectFinancials.find(f => f.projectId === p.id && f.actualExpense > 0))
    .map(p => ({ id: p.id, name: p.title.length > 20 ? p.title.substring(0, 20) + '...' : p.title }));

  const filterAndSort = (items: ExpenseItem[]) => {
    let filtered = items.filter(item => 
      (filterProject === 'all' || item.projectId === filterProject) &&
      (item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
       item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       item.vendor?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return (a.paymentDate || '').localeCompare(b.paymentDate || '');
        case 'project':
          return a.projectName.localeCompare(b.projectName);
        case 'amount':
          return b.amount - a.amount;
        default:
          return 0;
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_COMPLETE':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">지급완료</Badge>;
      case 'INVOICE_ISSUED':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">계산서발행</Badge>;
      default:
        return <Badge variant="outline">대기</Badge>;
    }
  };

  const calculateTotal = (items: ExpenseItem[]) => 
    items.reduce((sum, item) => sum + item.amount, 0);

  const renderTable = (items: ExpenseItem[], showVendor = true) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>지급일</TableHead>
          <TableHead>프로젝트</TableHead>
          <TableHead>내용</TableHead>
          {showVendor && <TableHead>거래처/대상</TableHead>}
          <TableHead className="text-right">금액</TableHead>
          <TableHead className="text-center">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filterAndSort(items).map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-mono text-sm">{item.paymentDate || '-'}</TableCell>
            <TableCell>
              <Badge variant="outline" className="font-normal">
                {item.projectName}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">{item.description}</TableCell>
            {showVendor && <TableCell className="text-muted-foreground">{item.vendor || '-'}</TableCell>}
            <TableCell className="text-right font-mono font-semibold">{formatKRW(item.amount)}</TableCell>
            <TableCell className="text-center">{getStatusBadge(item.status)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell colSpan={showVendor ? 4 : 3} className="text-right">합계</TableCell>
          <TableCell className="text-right font-mono">{formatKRW(calculateTotal(filterAndSort(items)))}</TableCell>
          <TableCell></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  // Summary stats
  const totalTaxInvoice = calculateTotal(mockTaxInvoices);
  const totalWithholding = calculateTotal(mockWithholding);
  const totalCard = calculateTotal(mockCorporateCard);
  const totalPersonal = calculateTotal(mockPersonalExpense);
  const grandTotal = totalTaxInvoice + totalWithholding + totalCard + totalPersonal;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <p className="text-sm text-muted-foreground">세금계산서</p>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{formatKRW(totalTaxInvoice)}</p>
          <p className="text-xs text-muted-foreground">{mockTaxInvoices.length}건</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-500" />
            <p className="text-sm text-muted-foreground">원천징수</p>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{formatKRW(totalWithholding)}</p>
          <p className="text-xs text-muted-foreground">{mockWithholding.length}건</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            <p className="text-sm text-muted-foreground">법인카드</p>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{formatKRW(totalCard)}</p>
          <p className="text-xs text-muted-foreground">{mockCorporateCard.length}건</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" />
            <p className="text-sm text-muted-foreground">개인비용</p>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{formatKRW(totalPersonal)}</p>
          <p className="text-xs text-muted-foreground">{mockPersonalExpense.length}건</p>
        </Card>
        <Card className="p-4 shadow-card bg-primary/5">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <p className="text-sm text-muted-foreground">전체 합계</p>
          </div>
          <p className="text-xl font-bold text-primary mt-1">{formatKRW(grandTotal)}</p>
          <p className="text-xs text-muted-foreground">{mockTaxInvoices.length + mockWithholding.length + mockCorporateCard.length + mockPersonalExpense.length}건</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="내용, 프로젝트, 거래처 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="프로젝트 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 프로젝트</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">지급일순</SelectItem>
              <SelectItem value="project">프로젝트순</SelectItem>
              <SelectItem value="amount">금액순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Expense Tabs */}
      <Card className="shadow-card">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="tax" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <FileText className="w-4 h-4" />
                세금계산서
                <Badge variant="secondary" className="ml-1">{mockTaxInvoices.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="withholding" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <FileText className="w-4 h-4" />
                원천징수
                <Badge variant="secondary" className="ml-1">{mockWithholding.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <CreditCard className="w-4 h-4" />
                법인카드
                <Badge variant="secondary" className="ml-1">{mockCorporateCard.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <User className="w-4 h-4" />
                개인비용
                <Badge variant="secondary" className="ml-1">{mockPersonalExpense.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="tax" className="m-0">
            {renderTable(mockTaxInvoices)}
          </TabsContent>
          <TabsContent value="withholding" className="m-0">
            {renderTable(mockWithholding)}
          </TabsContent>
          <TabsContent value="card" className="m-0">
            {renderTable(mockCorporateCard)}
          </TabsContent>
          <TabsContent value="personal" className="m-0">
            {renderTable(mockPersonalExpense)}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
