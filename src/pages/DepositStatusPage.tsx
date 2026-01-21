import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Check, X, Trash2, Banknote } from 'lucide-react';
import { toast } from 'sonner';

interface DepositItem {
  id: string;
  installment: string;
  expectedDate: string;
  expectedAmount: number;
}

// Mock data - would come from store/API in real app
const initialDeposits: DepositItem[] = [
  { id: 'ps-1', installment: '1차(선금)', expectedDate: '2025-09-30', expectedAmount: 100000000 },
  { id: 'ps-2', installment: '2차(중도)', expectedDate: '2025-11-30', expectedAmount: 100000000 },
  { id: 'ps-3', installment: '3차(잔액)', expectedDate: '2026-02-28', expectedAmount: 112059000 },
];

export default function DepositStatusPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [deposits, setDeposits] = useState<DepositItem[]>(initialDeposits);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [tempDeposit, setTempDeposit] = useState<Partial<DepositItem>>({});

  const totalAmount = deposits.reduce((sum, d) => sum + d.expectedAmount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const parseCurrency = (value: string): number => {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
  };

  const handleSave = (item: DepositItem) => {
    setDeposits(prev => prev.map(d => d.id === item.id ? item : d));
    setEditingId(null);
    toast.success('입금 정보가 수정되었습니다.');
  };

  const handleAdd = () => {
    const newItem: DepositItem = {
      id: `ps-${Date.now()}`,
      installment: tempDeposit.installment || `${deposits.length + 1}차`,
      expectedDate: tempDeposit.expectedDate || '',
      expectedAmount: tempDeposit.expectedAmount || 0,
    };
    setDeposits(prev => [...prev, newItem]);
    setIsAdding(false);
    setTempDeposit({});
    toast.success('입금 항목이 추가되었습니다.');
  };

  const handleDelete = (id: string) => {
    setDeposits(prev => prev.filter(d => d.id !== id));
    toast.success('입금 항목이 삭제되었습니다.');
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="page-title">입금 현황</h1>
            <p className="text-sm text-muted-foreground mt-1">
              프로젝트 입금 스케줄을 관리합니다
            </p>
          </div>
        </div>
      </div>

      {/* Total Summary Card */}
      <Card className="p-6 shadow-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Banknote className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">총 계약금액 (VAT 포함)</p>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
            <p className="text-sm text-primary mt-1">{deposits.length}회 분할 입금</p>
          </div>
        </div>
      </Card>

      {/* Deposit Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">입금 스케줄</h3>
          <p className="text-sm text-muted-foreground">각 항목을 클릭하여 수정하거나, 하단에서 새 항목을 추가하세요</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">No.</TableHead>
              <TableHead>차수</TableHead>
              <TableHead className="w-[150px]">입금 예정일</TableHead>
              <TableHead className="text-right w-[200px]">예정금액</TableHead>
              <TableHead className="text-right w-[120px]">비율</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deposits.map((deposit, index) => (
              editingId === deposit.id ? (
                <TableRow key={deposit.id} className="bg-blue-50/50">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Input
                      value={deposit.installment}
                      onChange={(e) => {
                        setDeposits(prev => prev.map(d => d.id === deposit.id ? { ...d, installment: e.target.value } : d));
                      }}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={deposit.expectedDate}
                      onChange={(e) => {
                        setDeposits(prev => prev.map(d => d.id === deposit.id ? { ...d, expectedDate: e.target.value } : d));
                      }}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={deposit.expectedAmount.toLocaleString('ko-KR')}
                      onChange={(e) => {
                        const value = parseCurrency(e.target.value);
                        setDeposits(prev => prev.map(d => d.id === deposit.id ? { ...d, expectedAmount: value } : d));
                      }}
                      className="h-8 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {totalAmount > 0 ? ((deposit.expectedAmount / totalAmount) * 100).toFixed(1) : 0}%
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSave(deposit)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow 
                  key={deposit.id} 
                  className="hover:bg-muted/10 cursor-pointer"
                  onClick={() => setEditingId(deposit.id)}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{deposit.installment}</TableCell>
                  <TableCell>{new Date(deposit.expectedDate).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(deposit.expectedAmount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {totalAmount > 0 ? ((deposit.expectedAmount / totalAmount) * 100).toFixed(1) : 0}%
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(deposit.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            ))}

            {/* Add New Row */}
            {isAdding ? (
              <TableRow className="bg-emerald-50/50">
                <TableCell>새 항목</TableCell>
                <TableCell>
                  <Input
                    value={tempDeposit.installment || ''}
                    onChange={(e) => setTempDeposit(prev => ({ ...prev, installment: e.target.value }))}
                    className="h-8"
                    placeholder={`${deposits.length + 1}차`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={tempDeposit.expectedDate || ''}
                    onChange={(e) => setTempDeposit(prev => ({ ...prev, expectedDate: e.target.value }))}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={(tempDeposit.expectedAmount || 0).toLocaleString('ko-KR')}
                    onChange={(e) => setTempDeposit(prev => ({ ...prev, expectedAmount: parseCurrency(e.target.value) }))}
                    className="h-8 text-right"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleAdd}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAdding(false); setTempDeposit({}); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow 
                className="hover:bg-emerald-50/50 cursor-pointer border-dashed"
                onClick={() => setIsAdding(true)}
              >
                <TableCell colSpan={6} className="text-center text-muted-foreground py-3">
                  <Plus className="w-4 h-4 inline mr-2" />
                  새 입금 항목 추가
                </TableCell>
              </TableRow>
            )}

            {/* Total Row */}
            <TableRow className="bg-muted/50 font-semibold border-t-2">
              <TableCell colSpan={3} className="text-right">총 계약금액</TableCell>
              <TableCell className="text-right text-lg">{formatCurrency(totalAmount)}</TableCell>
              <TableCell className="text-right">100%</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
