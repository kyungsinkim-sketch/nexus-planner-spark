import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ChevronLeft, 
  ChevronRight,
  TrendingDown,
  Wallet,
  CreditCard,
  FileText
} from 'lucide-react';
import { formatKRW } from '@/lib/format';

interface DailyExpense {
  date: string;
  items: {
    id: string;
    projectName: string;
    description: string;
    type: 'TAX_INVOICE' | 'WITHHOLDING' | 'CORPORATE_CARD' | 'CORPORATE_CASH' | 'PERSONAL';
    amount: number;
    note?: string;
  }[];
  totalAmount: number;
  runningBalance: number;
}

// Mock data based on the screenshot - daily expense schedule
const generateMockExpenseSchedule = (): DailyExpense[] => {
  const startBalance = 445435196; // Starting balance from screenshot
  
  const expenses: DailyExpense[] = [
    {
      date: '2025-01-19',
      items: [
        { id: 'e1', projectName: '개발자금여', description: '12월 개발자금여 (달러매수)', type: 'CORPORATE_CASH', amount: 13785148, note: '$9,308 × 1,481' },
      ],
      totalAmount: 13785148,
      runningBalance: startBalance - 13785148,
    },
    {
      date: '2025-01-20',
      items: [
        { id: 'e2', projectName: '운영비', description: '개발자금여 송금수수료', type: 'CORPORATE_CASH', amount: 92712, note: '2건' },
        { id: 'e3', projectName: '운영비', description: '정수기 (자동이체)', type: 'CORPORATE_CASH', amount: 61900, note: 'SK인텔릭스 1/1' },
        { id: 'e4', projectName: '금융비용', description: '대출이자_트러스트온', type: 'CORPORATE_CASH', amount: 1031244, note: '4.34%' },
        { id: 'e5', projectName: '세금', description: '3분기 부가세_3차', type: 'TAX_INVOICE', amount: 40000000 },
      ],
      totalAmount: 41185856,
      runningBalance: startBalance - 13785148 - 41185856,
    },
    {
      date: '2025-01-21',
      items: [
        { id: 'e6', projectName: '운영비', description: '통신료 (자동)', type: 'CORPORATE_CASH', amount: 49820, note: 'KT' },
        { id: 'e7', projectName: '금융비용', description: '대출이자(9642)', type: 'CORPORATE_CASH', amount: 1003890, note: '3.94%' },
      ],
      totalAmount: 1053710,
      runningBalance: startBalance - 13785148 - 41185856 - 1053710,
    },
    {
      date: '2025-01-26',
      items: [
        { id: 'e8', projectName: '운영비', description: '전기요금 (자동)', type: 'CORPORATE_CASH', amount: 966060 },
        { id: 'e9', projectName: '운영비', description: '화재보험 (자동)', type: 'CORPORATE_CASH', amount: 43200, note: '메리츠' },
        { id: 'e10', projectName: '운영비', description: '복합기 (자동)', type: 'CORPORATE_CASH', amount: 152460, note: '엔케이 1/25' },
        { id: 'e11', projectName: '운영비', description: '법무자문 수수료 (자동)', type: 'CORPORATE_CASH', amount: 550000, note: '대륜' },
        { id: 'e12', projectName: '세금', description: '4분기 부가세_1차', type: 'TAX_INVOICE', amount: 12621800 },
      ],
      totalAmount: 14333520,
      runningBalance: startBalance - 13785148 - 41185856 - 1053710 - 14333520,
    },
    {
      date: '2025-01-27',
      items: [
        { id: 'e13', projectName: '운영비', description: '우리카드 대금 (자동)', type: 'CORPORATE_CARD', amount: 4544274 },
        { id: 'e14', projectName: '운영비', description: '신한카드 대금 (자동)', type: 'CORPORATE_CARD', amount: 6303900 },
        { id: 'e15', projectName: '금융비용', description: '대출이자(1691)', type: 'CORPORATE_CASH', amount: 1690136, note: '7.96%' },
      ],
      totalAmount: 12538310,
      runningBalance: startBalance - 13785148 - 41185856 - 1053710 - 14333520 - 12538310,
    },
    {
      date: '2025-01-30',
      items: [
        { id: 'e16', projectName: '운영비', description: '서버비', type: 'TAX_INVOICE', amount: 957320, note: '메가존 12/31' },
        { id: 'e17', projectName: 'Samsung Galaxy Campaign', description: '용역비', type: 'WITHHOLDING', amount: 4303150 },
        { id: 'e18', projectName: 'Hyundai EV Brand Film', description: '외주비', type: 'TAX_INVOICE', amount: 31715594 },
        { id: 'e19', projectName: '개인비용', description: '1월 개인비용 정산', type: 'PERSONAL', amount: 2500000 },
        { id: 'e20', projectName: '운영비', description: '인터넷 팩스 (자동)', type: 'CORPORATE_CASH', amount: 2210 },
        { id: 'e21', projectName: '운영비', description: '상하수도요금 (자동)', type: 'CORPORATE_CASH', amount: 60870 },
      ],
      totalAmount: 39539144,
      runningBalance: startBalance - 13785148 - 41185856 - 1053710 - 14333520 - 12538310 - 39539144,
    },
  ];

  return expenses;
};

interface ExpenseScheduleSectionProps {
  year: number;
}

export function ExpenseScheduleSection({ year }: ExpenseScheduleSectionProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(year, 0));
  
  const expenses = generateMockExpenseSchedule();
  
  const totalExpenses = expenses.reduce((sum, day) => sum + day.totalAmount, 0);
  const startingBalance = 445435196;
  const endingBalance = startingBalance - totalExpenses;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TAX_INVOICE':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'WITHHOLDING':
        return <FileText className="w-4 h-4 text-violet-500" />;
      case 'CORPORATE_CARD':
        return <CreditCard className="w-4 h-4 text-orange-500" />;
      case 'CORPORATE_CASH':
      case 'PERSONAL':
        return <Wallet className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'TAX_INVOICE':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">세금계산서</Badge>;
      case 'WITHHOLDING':
        return <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-xs">원천징수</Badge>;
      case 'CORPORATE_CARD':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">법인카드</Badge>;
      case 'CORPORATE_CASH':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">법인현금</Badge>;
      case 'PERSONAL':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-xs">개인비용</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{type}</Badge>;
    }
  };

  const monthStr = currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">주거래계좌 출금가능금액</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-foreground">{formatKRW(165434699)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">그 외 출금가능금액</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-foreground">{formatKRW(280000497)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card bg-yellow-50 border-yellow-200 overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground">총 가용자금</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-yellow-700">{formatKRW(startingBalance)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground truncate">이번 달 예상 지출</p>
          </div>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-red-600">{formatKRW(totalExpenses)}</AutoFitText>
        </Card>
      </div>

      {/* Monthly Navigator */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            이전 달
          </Button>
          <h3 className="text-lg font-semibold text-foreground">{monthStr} 지출 예정</h3>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
            다음 달
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* Daily Expense Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-20 text-xs">이체일정</TableHead>
                <TableHead className="text-xs min-w-[120px]">내용</TableHead>
                <TableHead className="w-24 text-center text-xs hidden sm:table-cell">유형</TableHead>
                <TableHead className="text-right w-28 text-xs">지출액</TableHead>
                <TableHead className="text-right w-28 text-xs hidden md:table-cell">일일 지출금액</TableHead>
                <TableHead className="text-right w-32 text-xs hidden md:table-cell">잔액</TableHead>
                <TableHead className="w-24 text-xs hidden lg:table-cell">비고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((day, dayIdx) => (
                <>
                  {day.items.map((item, itemIdx) => (
                    <TableRow key={item.id} className={itemIdx === 0 ? 'border-t-2' : ''}>
                      {itemIdx === 0 && (
                        <TableCell rowSpan={day.items.length} className="font-medium bg-muted/30 align-top pt-3 text-xs sm:text-sm">
                          {new Date(day.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}일
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getTypeIcon(item.type)}
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate">{item.description}</p>
                            {item.projectName !== '운영비' && item.projectName !== '금융비용' && item.projectName !== '세금' && item.projectName !== '개인비용' && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.projectName}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{getTypeBadge(item.type)}</TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums">{formatKRW(item.amount)}</TableCell>
                      {itemIdx === 0 && (
                        <>
                          <TableCell rowSpan={day.items.length} className="text-right font-mono text-xs sm:text-sm font-semibold bg-red-50 text-red-700 align-middle tabular-nums hidden md:table-cell">
                            {formatKRW(day.totalAmount)}
                          </TableCell>
                          <TableCell rowSpan={day.items.length} className="text-right font-mono text-xs sm:text-sm bg-muted/30 align-middle tabular-nums hidden md:table-cell">
                            {formatKRW(day.runningBalance)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{item.note || ''}</TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
              {/* Total Row */}
              <TableRow className="bg-yellow-50 font-bold border-t-2">
                <TableCell colSpan={2} className="text-right text-xs sm:text-sm">총 합계</TableCell>
                <TableCell className="hidden sm:table-cell"></TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums">{formatKRW(totalExpenses)}</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums hidden md:table-cell">{formatKRW(totalExpenses)}</TableCell>
                <TableCell className="text-right font-mono text-xs sm:text-sm tabular-nums hidden md:table-cell">{formatKRW(endingBalance)}</TableCell>
                <TableCell className="hidden lg:table-cell"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
