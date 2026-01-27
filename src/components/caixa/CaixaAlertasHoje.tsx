import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, DollarSign, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  due_date: string;
  status: string;
}

interface Receivable {
  id: string;
  customer_name: string;
  description: string;
  total_amount: number;
  due_date: string;
  status: string;
  installment_number: number;
  total_installments: number;
}

interface CaixaAlertasHojeProps {
  expensesDueToday: Expense[];
  receivablesDueToday: Receivable[];
  onPayExpense: (expense: Expense) => void;
  onReceivePayment: (receivable: Receivable) => void;
  disabled?: boolean;
}

export function CaixaAlertasHoje({
  expensesDueToday,
  receivablesDueToday,
  onPayExpense,
  onReceivePayment,
  disabled = false,
}: CaixaAlertasHojeProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const expenses = Array.isArray(expensesDueToday) ? expensesDueToday : [];
  const receivables = Array.isArray(receivablesDueToday) ? receivablesDueToday : [];
  
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalReceivables = receivables.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const hasAlerts = expenses.length > 0 || receivables.length > 0;

  if (!hasAlerts) {
    return null;
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      material: 'Material',
      mao_de_obra: 'Mão de obra',
      aluguel: 'Aluguel',
      energia: 'Energia',
      agua: 'Água',
      internet: 'Internet',
      combustivel: 'Combustível',
      alimentacao: 'Alimentação',
      manutencao: 'Manutenção',
      outros: 'Outros',
    };
    return labels[category] || category;
  };

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Atenção Hoje
          <Badge variant="outline" className="ml-auto border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
            {expenses.length + receivables.length} pendências
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Despesas a pagar */}
        {expenses.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <ArrowDownCircle className="h-4 w-4" />
              Despesas a Pagar ({expenses.length})
              <span className="ml-auto font-bold">{formatCurrency(totalExpenses)}</span>
            </div>
            <div className="space-y-2 pl-6">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-background border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {getCategoryLabel(expense.category)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-destructive">
                      {formatCurrency(expense.amount)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onPayExpense(expense)}
                      disabled={disabled}
                    >
                      Pagar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parcelas a receber */}
        {receivables.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ArrowUpCircle className="h-4 w-4" />
              Parcelas a Receber ({receivables.length})
              <span className="ml-auto font-bold">{formatCurrency(totalReceivables)}</span>
            </div>
            <div className="space-y-2 pl-6">
              {receivables.map((receivable) => (
                <div
                  key={receivable.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-background border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{receivable.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Parcela {receivable.installment_number}/{receivable.total_installments}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary">
                      {formatCurrency(receivable.total_amount)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onReceivePayment(receivable)}
                      disabled={disabled}
                    >
                      Receber
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
