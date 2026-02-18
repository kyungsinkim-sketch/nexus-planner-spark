import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoFitText } from '@/components/ui/auto-fit-text';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Building2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { formatKRW } from '@/lib/format';
import { useAppStore } from '@/stores/appStore';
import { projectFinancials } from '@/mock/data';
import { useTranslation } from '@/hooks/useTranslation';

interface DepositEntry {
  installment: string;
  expectedAmount: number;
  expectedDate: string;
  actualAmount: number;
  actualDate?: string;
  status: 'PENDING' | 'RECEIVED' | 'OVERDUE';
}

interface ContractRecord {
  id: string;
  projectName: string;
  client: string;
  totalAmount: number;
  actualExpense: number;
  profitRate: number;
  date: string;
  deposits: DepositEntry[];
}

interface ContractStatusSectionProps {
  year: number;
}

export function ContractStatusSection({ year }: ContractStatusSectionProps) {
  const { t } = useTranslation();
  const { projects } = useAppStore();

  // Generate contract data from actual projects in store
  const contractData = useMemo((): ContractRecord[] => {
    const allProjects = projects.length > 0 ? projects : [];
    const filtered = year
      ? allProjects.filter(project => {
          const startYear = new Date(project.startDate).getFullYear();
          const endYear = new Date(project.endDate).getFullYear();
          return startYear <= year && endYear >= year;
        })
      : allProjects;

    return filtered.map((project) => {
      const financial = projectFinancials.find(f => f.projectId === project.id);
      const amount = financial?.contractAmount || project.budget || 0;
      const now = new Date();

      const deposits: DepositEntry[] = [];
      if (amount < 100000000) {
        const startDate = project.startDate.substring(0, 10);
        const endDate = project.endDate.substring(0, 10);
        deposits.push(
          {
            installment: '1차 (선금)',
            expectedAmount: Math.round(amount * 0.5),
            expectedDate: startDate,
            actualAmount: new Date(startDate) <= now ? Math.round(amount * 0.5) : 0,
            actualDate: new Date(startDate) <= now ? startDate : undefined,
            status: new Date(startDate) <= now ? 'RECEIVED' : 'PENDING',
          },
          {
            installment: '2차 (잔금)',
            expectedAmount: Math.round(amount * 0.5),
            expectedDate: endDate,
            actualAmount: project.status === 'COMPLETED' ? Math.round(amount * 0.5) : 0,
            actualDate: project.status === 'COMPLETED' ? endDate : undefined,
            status: project.status === 'COMPLETED' ? 'RECEIVED' : (new Date(endDate) < now ? 'OVERDUE' : 'PENDING'),
          },
        );
      } else {
        const mid = new Date((new Date(project.startDate).getTime() + new Date(project.endDate).getTime()) / 2);
        const startDate = project.startDate.substring(0, 10);
        const midDate = mid.toISOString().substring(0, 10);
        const endDate = project.endDate.substring(0, 10);

        deposits.push(
          {
            installment: '1차 (선금)',
            expectedAmount: Math.round(amount * 0.3),
            expectedDate: startDate,
            actualAmount: new Date(startDate) <= now ? Math.round(amount * 0.3) : 0,
            actualDate: new Date(startDate) <= now ? startDate : undefined,
            status: new Date(startDate) <= now ? 'RECEIVED' : 'PENDING',
          },
          {
            installment: '2차 (중도)',
            expectedAmount: Math.round(amount * 0.4),
            expectedDate: midDate,
            actualAmount: new Date(midDate) <= now ? Math.round(amount * 0.4) : 0,
            actualDate: new Date(midDate) <= now ? midDate : undefined,
            status: new Date(midDate) <= now ? 'RECEIVED' : 'PENDING',
          },
          {
            installment: '3차 (잔금)',
            expectedAmount: Math.round(amount * 0.3),
            expectedDate: endDate,
            actualAmount: project.status === 'COMPLETED' ? Math.round(amount * 0.3) : 0,
            actualDate: project.status === 'COMPLETED' ? endDate : undefined,
            status: project.status === 'COMPLETED' ? 'RECEIVED' : (new Date(endDate) < now ? 'OVERDUE' : 'PENDING'),
          },
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
  }, [projects, year]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<string[]>([contractData[0]?.id]);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [editingDeposits, setEditingDeposits] = useState<string | null>(null);
  const [editedDeposits, setEditedDeposits] = useState<Record<string, DepositEntry[]>>({});

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

  const totalContract = contractData.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalReceived = contractData.reduce((sum, c) =>
    sum + c.deposits.filter(d => d.status === 'RECEIVED').reduce((s, d) => s + d.actualAmount, 0), 0
  );
  const totalExpected = contractData.reduce((sum, c) =>
    sum + c.deposits.reduce((s, d) => s + d.expectedAmount, 0), 0
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

  const handleDepositStatusChange = (contractId: string, depositIdx: number, newStatus: 'PENDING' | 'RECEIVED' | 'OVERDUE') => {
    setEditedDeposits(prev => {
      const current = prev[contractId] || contractData.find(c => c.id === contractId)?.deposits || [];
      const updated = [...current];
      updated[depositIdx] = {
        ...updated[depositIdx],
        status: newStatus,
        actualAmount: newStatus === 'RECEIVED' ? updated[depositIdx].expectedAmount : 0,
        actualDate: newStatus === 'RECEIVED' ? new Date().toISOString().substring(0, 10) : undefined,
      };
      return { ...prev, [contractId]: updated };
    });
  };

  const handleDepositAmountChange = (contractId: string, depositIdx: number, amount: number) => {
    setEditedDeposits(prev => {
      const current = prev[contractId] || contractData.find(c => c.id === contractId)?.deposits || [];
      const updated = [...current];
      updated[depositIdx] = { ...updated[depositIdx], actualAmount: amount };
      return { ...prev, [contractId]: updated };
    });
  };

  const getDeposits = (contract: ContractRecord): DepositEntry[] => {
    return editedDeposits[contract.id] || contract.deposits;
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
          <p className="text-[10px] sm:text-xs text-muted-foreground">총 예정금액: {formatKRW(totalExpected)}</p>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground">{t('totalActualExpense')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-amber-600">{formatKRW(totalExpenses)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground">{t('netProfit')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-primary">{formatKRW(netProfit)}</AutoFitText>
          <p className="text-[10px] sm:text-xs text-emerald-600">{totalContract > 0 ? ((netProfit / totalContract) * 100).toFixed(1) : '0'}% {t('profitRatePercent')}</p>
        </Card>
      </div>

      {/* Top Projects by Revenue */}
      <Card className="p-4 sm:p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm sm:text-base">{t('topProjectsByAmount')}</h3>
        </div>
        <div className="space-y-2 sm:space-y-3">
          {[...contractData]
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
                {getStatusBadge(
                  contract.deposits.every(d => d.status === 'RECEIVED') ? 'RECEIVED' :
                  contract.deposits.some(d => d.status === 'OVERDUE') ? 'OVERDUE' : 'PENDING'
                )}
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
                const deposits = getDeposits(contract);
                const isEditing = editingDeposits === contract.id;

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
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-muted-foreground">입금 현황</span>
                              {!isEditing ? (
                                <Button
                                  variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                                  onClick={(e) => { e.stopPropagation(); setEditingDeposits(contract.id); }}
                                >
                                  <Edit2 className="w-3 h-3" /> 수정
                                </Button>
                              ) : (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost" size="sm" className="h-7 gap-1 text-xs text-green-600"
                                    onClick={(e) => { e.stopPropagation(); setEditingDeposits(null); }}
                                  >
                                    <Check className="w-3 h-3" /> 저장
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm" className="h-7 gap-1 text-xs text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingDeposits(null);
                                      setEditedDeposits(prev => { const copy = { ...prev }; delete copy[contract.id]; return copy; });
                                    }}
                                  >
                                    <X className="w-3 h-3" /> 취소
                                  </Button>
                                </div>
                              )}
                            </div>
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
                                {deposits.map((deposit, idx) => (
                                  <TableRow key={idx} className="hover:bg-transparent">
                                    <TableCell className="font-medium text-xs sm:text-sm">{deposit.installment}</TableCell>
                                    <TableCell className="text-xs hidden sm:table-cell">{deposit.expectedDate}</TableCell>
                                    <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums">{formatKRW(deposit.expectedAmount)}</TableCell>
                                    <TableCell className="text-xs hidden sm:table-cell">{deposit.actualDate || '-'}</TableCell>
                                    <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums">
                                      {isEditing ? (
                                        <Input
                                          type="number"
                                          value={deposit.actualAmount}
                                          onChange={(e) => handleDepositAmountChange(contract.id, idx, Number(e.target.value) || 0)}
                                          className="h-7 w-[120px] text-right text-xs"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        deposit.actualAmount > 0 ? formatKRW(deposit.actualAmount) : '-'
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {isEditing ? (
                                        <Select
                                          value={deposit.status}
                                          onValueChange={(val) => handleDepositStatusChange(contract.id, idx, val as DepositEntry['status'])}
                                        >
                                          <SelectTrigger className="h-7 w-[100px]" onClick={(e) => e.stopPropagation()}>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="PENDING">대기</SelectItem>
                                            <SelectItem value="RECEIVED">입금완료</SelectItem>
                                            <SelectItem value="OVERDUE">연체</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        getStatusBadge(deposit.status)
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {/* Auto-calculated total row */}
                                <TableRow className="font-semibold bg-muted/50">
                                  <TableCell className="text-xs">총 예정금액</TableCell>
                                  <TableCell className="hidden sm:table-cell"></TableCell>
                                  <TableCell className="text-right font-mono text-xs tabular-nums">
                                    {formatKRW(deposits.reduce((s, d) => s + d.expectedAmount, 0))}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell"></TableCell>
                                  <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600">
                                    {formatKRW(deposits.reduce((s, d) => s + d.actualAmount, 0))}
                                  </TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
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
