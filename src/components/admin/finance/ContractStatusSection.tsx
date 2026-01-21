import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Search, 
  Calendar,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Building2
} from 'lucide-react';
import { formatKRW } from '@/lib/format';

interface ContractRecord {
  id: string;
  projectName: string;
  client: string;
  totalAmount: number;
  deposits: {
    installment: string;
    expectedAmount: number;
    expectedDate: string;
    actualAmount: number;
    actualDate?: string;
    status: 'PENDING' | 'RECEIVED' | 'OVERDUE';
  }[];
}

// Mock data based on projects
const mockContractData: ContractRecord[] = [
  {
    id: 'c1',
    projectName: 'Samsung Galaxy Campaign',
    client: 'Samsung Electronics',
    totalAmount: 500000000,
    deposits: [
      { installment: '1차 (선금)', expectedAmount: 150000000, expectedDate: '2025-01-10', actualAmount: 150000000, actualDate: '2025-01-08', status: 'RECEIVED' },
      { installment: '2차 (중도)', expectedAmount: 200000000, expectedDate: '2025-01-25', actualAmount: 0, status: 'PENDING' },
      { installment: '3차 (잔금)', expectedAmount: 150000000, expectedDate: '2025-02-15', actualAmount: 0, status: 'PENDING' },
    ],
  },
  {
    id: 'c2',
    projectName: 'Hyundai EV Brand Film',
    client: 'Hyundai Motor',
    totalAmount: 800000000,
    deposits: [
      { installment: '1차 (선금)', expectedAmount: 240000000, expectedDate: '2025-01-15', actualAmount: 240000000, actualDate: '2025-01-15', status: 'RECEIVED' },
      { installment: '2차 (중도)', expectedAmount: 320000000, expectedDate: '2025-02-10', actualAmount: 0, status: 'PENDING' },
      { installment: '3차 (잔금)', expectedAmount: 240000000, expectedDate: '2025-03-01', actualAmount: 0, status: 'PENDING' },
    ],
  },
  {
    id: 'c3',
    projectName: 'LG Smart Home Integration',
    client: 'LG Electronics',
    totalAmount: 200000000,
    deposits: [
      { installment: '1차 (선금)', expectedAmount: 100000000, expectedDate: '2025-01-20', actualAmount: 0, status: 'OVERDUE' },
      { installment: '2차 (잔금)', expectedAmount: 100000000, expectedDate: '2025-02-20', actualAmount: 0, status: 'PENDING' },
    ],
  },
  {
    id: 'c4',
    projectName: 'Kakao Pay Rebrand',
    client: 'Kakao',
    totalAmount: 350000000,
    deposits: [
      { installment: '1차 (선금)', expectedAmount: 105000000, expectedDate: '2025-01-05', actualAmount: 105000000, actualDate: '2025-01-05', status: 'RECEIVED' },
      { installment: '2차 (중도)', expectedAmount: 140000000, expectedDate: '2025-01-30', actualAmount: 0, status: 'PENDING' },
      { installment: '3차 (잔금)', expectedAmount: 105000000, expectedDate: '2025-02-28', actualAmount: 0, status: 'PENDING' },
    ],
  },
];

export function ContractStatusSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<string[]>(['c1', 'c2']);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const toggleExpand = (id: string) => {
    setExpandedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const filteredData = mockContractData.filter(
    c =>
      c.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary stats
  const totalExpected = mockContractData.reduce((sum, c) => 
    sum + c.deposits.reduce((s, d) => s + d.expectedAmount, 0), 0
  );
  const totalReceived = mockContractData.reduce((sum, c) => 
    sum + c.deposits.reduce((s, d) => s + d.actualAmount, 0), 0
  );
  const overdueCount = mockContractData.reduce((sum, c) => 
    sum + c.deposits.filter(d => d.status === 'OVERDUE').length, 0
  );
  const pendingCount = mockContractData.reduce((sum, c) => 
    sum + c.deposits.filter(d => d.status === 'PENDING').length, 0
  );

  // Get upcoming deposits (sorted by date)
  const upcomingDeposits = mockContractData.flatMap(c =>
    c.deposits
      .filter(d => d.status !== 'RECEIVED')
      .map(d => ({ ...d, projectName: c.projectName, client: c.client }))
  ).sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">입금완료</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">연체</Badge>;
      default:
        return <Badge variant="outline">대기</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground">총 계약금액</p>
          <p className="text-2xl font-bold text-foreground">{formatKRW(totalExpected)}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground">입금완료</p>
          <p className="text-2xl font-bold text-emerald-600">{formatKRW(totalReceived)}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground">미수금</p>
          <p className="text-2xl font-bold text-amber-600">{formatKRW(totalExpected - totalReceived)}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground">상태</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{pendingCount} 대기</Badge>
            {overdueCount > 0 && (
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{overdueCount} 연체</Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Upcoming Deposits Timeline */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">입금 예정 일정</h3>
        </div>
        <div className="space-y-3">
          {upcomingDeposits.slice(0, 5).map((deposit, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{deposit.projectName}</p>
                  <p className="text-xs text-muted-foreground">{deposit.client} · {deposit.installment}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{formatKRW(deposit.expectedAmount)}</p>
                <p className="text-xs text-muted-foreground">{deposit.expectedDate}</p>
              </div>
              {getStatusBadge(deposit.status)}
            </div>
          ))}
        </div>
      </Card>

      {/* Contract Table */}
      <Card className="shadow-card">
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="프로젝트 또는 클라이언트 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setSortBy(sortBy === 'date' ? 'amount' : 'date')}>
            <ArrowUpDown className="w-4 h-4 mr-1" />
            {sortBy === 'date' ? '날짜순' : '금액순'}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>프로젝트</TableHead>
              <TableHead>클라이언트</TableHead>
              <TableHead className="text-right">총 계약금액</TableHead>
              <TableHead className="text-right">입금완료</TableHead>
              <TableHead className="text-right">미수금</TableHead>
              <TableHead className="text-center">진행률</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((contract) => {
              const receivedTotal = contract.deposits.reduce((s, d) => s + d.actualAmount, 0);
              const progress = Math.round((receivedTotal / contract.totalAmount) * 100);
              const isExpanded = expandedProjects.includes(contract.id);

              return (
                <>
                  <TableRow 
                    key={contract.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(contract.id)}
                  >
                    <TableCell>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{contract.projectName}</TableCell>
                    <TableCell>{contract.client}</TableCell>
                    <TableCell className="text-right font-mono">{formatKRW(contract.totalAmount)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{formatKRW(receivedTotal)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {formatKRW(contract.totalAmount - receivedTotal)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-10">{progress}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${contract.id}-details`} className="bg-muted/30">
                      <TableCell colSpan={7} className="p-0">
                        <div className="p-4">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead>회차</TableHead>
                                <TableHead>예정일</TableHead>
                                <TableHead className="text-right">예정금액</TableHead>
                                <TableHead>입금일</TableHead>
                                <TableHead className="text-right">입금금액</TableHead>
                                <TableHead className="text-center">상태</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {contract.deposits.map((deposit, idx) => (
                                <TableRow key={idx} className="hover:bg-transparent">
                                  <TableCell className="font-medium">{deposit.installment}</TableCell>
                                  <TableCell>{deposit.expectedDate}</TableCell>
                                  <TableCell className="text-right font-mono">{formatKRW(deposit.expectedAmount)}</TableCell>
                                  <TableCell>{deposit.actualDate || '-'}</TableCell>
                                  <TableCell className="text-right font-mono">
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
      </Card>
    </div>
  );
}
