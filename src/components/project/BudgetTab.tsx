import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  FileText,
  Download,
} from 'lucide-react';

interface BudgetTabProps {
  projectId: string;
}

// Mock budget data
const mockBudgetData = {
  totalBudget: 150000,
  spent: 98500,
  remaining: 51500,
  categories: [
    { name: 'Production', allocated: 60000, spent: 45000 },
    { name: 'Design & Creative', allocated: 35000, spent: 28000 },
    { name: 'Media & Advertising', allocated: 30000, spent: 15500 },
    { name: 'Talent & Crew', allocated: 20000, spent: 8000 },
    { name: 'Miscellaneous', allocated: 5000, spent: 2000 },
  ],
  transactions: [
    { id: 't1', description: 'Equipment Rental - Sony A7S III', amount: -2500, date: '2024-01-15', category: 'Production' },
    { id: 't2', description: 'Studio Booking - Day 1-3', amount: -8000, date: '2024-01-14', category: 'Production' },
    { id: 't3', description: 'Freelance Designer - Week 1', amount: -4500, date: '2024-01-12', category: 'Design & Creative' },
    { id: 't4', description: 'Initial Budget Allocation', amount: 150000, date: '2024-01-01', category: 'Budget' },
    { id: 't5', description: 'Facebook Ads Prepayment', amount: -5000, date: '2024-01-10', category: 'Media & Advertising' },
  ],
};

export function BudgetTab({ projectId }: BudgetTabProps) {
  const { totalBudget, spent, remaining, categories, transactions } = mockBudgetData;
  const spentPercentage = (spent / totalBudget) * 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(totalBudget)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Spent</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(spent)}
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
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Budget Utilization</h3>
          <Badge variant={spentPercentage > 90 ? 'destructive' : spentPercentage > 70 ? 'secondary' : 'default'}>
            {Math.round(spentPercentage)}% used
          </Badge>
        </div>
        <Progress value={spentPercentage} className="h-3" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>{formatCurrency(spent)} spent</span>
          <span>{formatCurrency(remaining)} remaining</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Category Breakdown</h3>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          </div>
          <div className="space-y-4">
            {categories.map((category) => {
              const percentage = (category.spent / category.allocated) * 100;
              return (
                <div key={category.name}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-foreground">{category.name}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(category.spent)} / {formatCurrency(category.allocated)}
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className={`h-2 ${percentage > 90 ? '[&>div]:bg-destructive' : ''}`} 
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recent Transactions</h3>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
          <ScrollArea className="h-[280px]">
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    transaction.amount > 0 
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.category} · {formatDate(transaction.date)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${
                    transaction.amount > 0 ? 'text-emerald-600' : 'text-foreground'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
