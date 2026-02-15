import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Search,
  ArrowUpDown,
  FileText,
  CreditCard,
  Wallet,
  User
} from 'lucide-react';
import { formatKRW } from '@/lib/format';
import { mockProjects, projectFinancials } from '@/mock/data';
import { useTranslation } from '@/hooks/useTranslation';

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

interface ExpenseDetailSectionProps {
  year: number;
}

export function ExpenseDetailSection({ year }: ExpenseDetailSectionProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('tax');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filterProject, setFilterProject] = useState<string>('all');

  const projects = mockProjects
    .filter(p => projectFinancials.find(f => f.projectId === p.id && f.actualExpense > 0))
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
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t('statusPaymentComplete')}</Badge>;
      case 'INVOICE_ISSUED':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{t('statusInvoiceIssued')}</Badge>;
      default:
        return <Badge variant="outline">{t('statusPending')}</Badge>;
    }
  };

  const calculateTotal = (items: ExpenseItem[]) => 
    items.reduce((sum, item) => sum + item.amount, 0);

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
          <TableCell colSpan={showVendor ? 4 : 3} className="text-right">{t('totalSumDetail')}</TableCell>
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
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground">{t('typeTaxInvoice')}</p>
          </div>
          <AutoFitText className="text-lg sm:text-xl font-bold text-foreground mt-1">{formatKRW(totalTaxInvoice)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{mockTaxInvoices.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500 shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground">{t('typeWithholding')}</p>
          </div>
          <AutoFitText className="text-lg sm:text-xl font-bold text-foreground mt-1">{formatKRW(totalWithholding)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{mockWithholding.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground">{t('typeCorporateCard')}</p>
          </div>
          <AutoFitText className="text-lg sm:text-xl font-bold text-foreground mt-1">{formatKRW(totalCard)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{mockCorporateCard.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground">{t('typePersonalExpense')}</p>
          </div>
          <AutoFitText className="text-lg sm:text-xl font-bold text-foreground mt-1">{formatKRW(totalPersonal)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{mockPersonalExpense.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card bg-primary/5 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground">{t('totalExpenseAll')}</p>
          </div>
          <AutoFitText className="text-lg sm:text-xl font-bold text-primary mt-1">{formatKRW(grandTotal)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{mockTaxInvoices.length + mockWithholding.length + mockCorporateCard.length + mockPersonalExpense.length}{t('itemCountSuffix')}</p>
        </Card>
      </div>

      {/* Filters */}
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
              <SelectItem value="date">{t('sortByDate')}</SelectItem>
              <SelectItem value="project">{t('sortByProject')}</SelectItem>
              <SelectItem value="amount">{t('sortByAmount')}</SelectItem>
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
                {t('typeTaxInvoice')}
                <Badge variant="secondary" className="ml-1">{mockTaxInvoices.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="withholding" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <FileText className="w-4 h-4" />
                {t('typeWithholding')}
                <Badge variant="secondary" className="ml-1">{mockWithholding.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <CreditCard className="w-4 h-4" />
                {t('typeCorporateCard')}
                <Badge variant="secondary" className="ml-1">{mockCorporateCard.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <User className="w-4 h-4" />
                {t('typePersonalExpense')}
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
