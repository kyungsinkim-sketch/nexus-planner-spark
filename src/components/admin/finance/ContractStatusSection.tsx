import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoFitText } from '@/components/ui/auto-fit-text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Calendar,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Building2
} from 'lucide-react';
import { formatKRW } from '@/lib/format';
import { mockProjects, projectFinancials } from '@/mock/data';
import { useTranslation } from '@/hooks/useTranslation';

interface ContractRecord {
  id: string;
  projectName: string;
  client: string;
  totalAmount: number;
  actualExpense: number;
  profitRate: number;
  date: string;
  deposits: {
    installment: string;
    expectedAmount: number;
    expectedDate: string;
    actualAmount: number;
    actualDate?: string;
    status: 'PENDING' | 'RECEIVED' | 'OVERDUE';
  }[];
}

// Generate contract data from real project data
const generateContractData = (): ContractRecord[] => {
  return mockProjects.map((project, idx) => {
    const financial = projectFinancials.find(f => f.projectId === project.id);
    const amount = financial?.contractAmount || project.budget || 0;
    
    // Create deposit schedule based on project size
    const deposits = [];
    if (amount < 100000000) {
      // Small projects: 2 installments
      deposits.push(
        { installment: '1차 (선금)', expectedAmount: Math.round(amount * 0.5), expectedDate: project.startDate.substring(0, 10), actualAmount: Math.round(amount * 0.5), actualDate: project.startDate.substring(0, 10), status: 'RECEIVED' as const },
        { installment: '2차 (잔금)', expectedAmount: Math.round(amount * 0.5), expectedDate: project.endDate.substring(0, 10), actualAmount: Math.round(amount * 0.5), actualDate: project.endDate.substring(0, 10), status: 'RECEIVED' as const },
      );
    } else {
      // Larger projects: 3 installments
      const mid = new Date((new Date(project.startDate).getTime() + new Date(project.endDate).getTime()) / 2);
      deposits.push(
        { installment: '1차 (선금)', expectedAmount: Math.round(amount * 0.3), expectedDate: project.startDate.substring(0, 10), actualAmount: Math.round(amount * 0.3), actualDate: project.startDate.substring(0, 10), status: 'RECEIVED' as const },
        { installment: '2차 (중도)', expectedAmount: Math.round(amount * 0.4), expectedDate: mid.toISOString().substring(0, 10), actualAmount: Math.round(amount * 0.4), actualDate: mid.toISOString().substring(0, 10), status: 'RECEIVED' as const },
        { installment: '3차 (잔금)', expectedAmount: Math.round(amount * 0.3), expectedDate: project.endDate.substring(0, 10), actualAmount: Math.round(amount * 0.3), actualDate: project.endDate.substring(0, 10), status: 'RECEIVED' as const },
      );
    }

    return {
      id: project.id,
      projectName: project.title,
      client: project.client,
      totalAmount: amount,
      actualExpense: financial?.actualExpense || 0,
      profitRate: financial?.profitRate || 0,
      date: project.startDate,
      deposits,
    };
  });
};

const contractData = generateContractData();

interface ContractStatusSectionProps {
  year: number;
}

export function ContractStatusSection({ year }: ContractStatusSectionProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<string[]>([contractData[0]?.id]);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const toggleExpand = (id: string) => {
    setExpandedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const filteredData = contractData
    .filter(
      c =>
        c.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.client.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'amount') return b.totalAmount - a.totalAmount;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  // Calculate summary stats
  const totalContract = contractData.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalReceived = contractData.reduce((sum, c) => 
    sum + c.deposits.reduce((s, d) => s + d.actualAmount, 0), 0
  );
  const totalExpenses = contractData.reduce((sum, c) => sum + c.actualExpense, 0);
  const netProfit = totalContract - totalExpenses;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t('statusReceived')}</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t('statusOverdue')}</Badge>;
      default:
        return <Badge variant="outline">{t('statusWaiting')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('totalContractAmountCS')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-foreground">{formatKRW(totalContract)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{contractData.length}{t('itemCountSuffix')}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground">{t('depositCompleted')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-emerald-600">{formatKRW(totalReceived)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground">{t('totalActualExpense')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-amber-600">{formatKRW(totalExpenses)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground">{t('netProfit')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-primary">{formatKRW(netProfit)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-emerald-600">{((netProfit / totalContract) * 100).toFixed(1)}% {t('profitRatePercent')}</p>
        </Card>
      </div>

      {/* Top Projects by Revenue */}
      <Card className="p-4 sm:p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm sm:text-base">{t('topProjectsByAmount')}</h3>
        </div>
        <div className="space-y-2 sm:space-y-3">
          {contractData
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 5)
            .map((contract, idx) => (
            <div key={idx} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-xs sm:text-sm truncate">{contract.projectName}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{contract.client}</p>
              </div>
              <div className="text-right shrink-0 min-w-0 max-w-[140px] sm:max-w-[200px]">
                <AutoFitText className="font-semibold text-foreground text-xs sm:text-sm font-mono tabular-nums">{formatKRW(contract.totalAmount)}</AutoFitText>
                <p className="text-[10px] sm:text-xs text-emerald-600">{t('profitRatePercent')} {contract.profitRate}%</p>
              </div>
              <div className="shrink-0 hidden sm:block">
                {getStatusBadge('RECEIVED')}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Contract Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('searchProjectOrClient')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setSortBy(sortBy === 'date' ? 'amount' : 'date')}>
            <ArrowUpDown className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">{sortBy === 'date' ? t('sortByDateLabel') : t('sortByAmountLabel')}</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="min-w-[120px]">{t('projectColumnCS')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('clientColumn')}</TableHead>
                <TableHead className="text-right min-w-[100px]">{t('contractAmountColumn')}</TableHead>
                <TableHead className="text-right min-w-[100px] hidden md:table-cell">{t('actualExpenseColumn')}</TableHead>
                <TableHead className="text-right min-w-[100px] hidden md:table-cell">{t('netProfitColumn')}</TableHead>
                <TableHead className="text-center w-20">{t('profitRateColumn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((contract) => {
                const profit = contract.totalAmount - contract.actualExpense;
                const isExpanded = expandedProjects.includes(contract.id);

                return (
                  <>
                    <TableRow 
                      key={contract.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(contract.id)}
                    >
                      <TableCell className="px-2">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        <span className="line-clamp-1">{contract.projectName}</span>
                        <span className="sm:hidden text-[10px] text-muted-foreground block">{contract.client}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{contract.client}</TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums">{formatKRW(contract.totalAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm text-amber-600 tabular-nums hidden md:table-cell">
                        {contract.actualExpense > 0 ? formatKRW(contract.actualExpense) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm text-emerald-600 tabular-nums hidden md:table-cell">
                        {formatKRW(profit)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className={`text-[10px] sm:text-xs ${
                            contract.profitRate >= 70 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                            contract.profitRate >= 40 ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                            'bg-amber-100 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {contract.profitRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${contract.id}-details`} className="bg-muted/30">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-2 sm:p-4 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="text-xs">{t('installmentColumn')}</TableHead>
                                  <TableHead className="text-xs hidden sm:table-cell">{t('expectedDateColumn')}</TableHead>
                                  <TableHead className="text-right text-xs">{t('expectedAmountColumn')}</TableHead>
                                  <TableHead className="text-xs hidden sm:table-cell">{t('depositDateColumn')}</TableHead>
                                  <TableHead className="text-right text-xs">{t('depositAmountColumn')}</TableHead>
                                  <TableHead className="text-center text-xs">{t('statusColumnCS')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {contract.deposits.map((deposit, idx) => (
                                  <TableRow key={idx} className="hover:bg-transparent">
                                    <TableCell className="font-medium text-xs sm:text-sm">{deposit.installment}</TableCell>
                                    <TableCell className="text-xs hidden sm:table-cell">{deposit.expectedDate}</TableCell>
                                    <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums">{formatKRW(deposit.expectedAmount)}</TableCell>
                                    <TableCell className="text-xs hidden sm:table-cell">{deposit.actualDate || '-'}</TableCell>
                                    <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums">
                                      {deposit.actualAmount > 0 ? formatKRW(deposit.actualAmount) : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">{getStatusBadge(deposit.status)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
