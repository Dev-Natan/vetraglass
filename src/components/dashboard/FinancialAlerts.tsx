import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Receipt, Wallet, ArrowRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FinancialAlertsData } from '@/hooks/useDashboardData';

interface FinancialAlertsProps {
  data?: FinancialAlertsData;
}

export const FinancialAlerts = memo(function FinancialAlerts({ data }: FinancialAlertsProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const expensesDueToday = data?.expensesDueToday;
  const overdueReceivables = data?.overdueReceivables;
  const receivablesDueToday = data?.receivablesDueToday;

  const totalAlerts = 
    (expensesDueToday?.count || 0) + 
    (overdueReceivables?.count || 0) + 
    (receivablesDueToday?.count || 0);

  if (totalAlerts === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 dark:border-orange-900 dark:from-orange-950/30 dark:to-amber-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
          <AlertTriangle className="h-5 w-5" />
          Alertas Financeiros
          <Badge variant="destructive" className="ml-auto">
            {totalAlerts} pendente{totalAlerts > 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Despesas Vencendo Hoje */}
        {expensesDueToday && expensesDueToday.count > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/80 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
                <Receipt className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {expensesDueToday.count} despesa{expensesDueToday.count > 1 ? 's' : ''} vencendo hoje
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
                  {formatCurrency(expensesDueToday.total)}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/financeiro')}
              className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
            >
              Ver <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Contas a Receber Atrasadas */}
        {overdueReceivables && overdueReceivables.count > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/80 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                <Wallet className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {overdueReceivables.count} conta{overdueReceivables.count > 1 ? 's' : ''} a receber atrasada{overdueReceivables.count > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
                  {formatCurrency(overdueReceivables.total)}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/financeiro')}
              className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-100"
            >
              Ver <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Recebimentos de Hoje */}
        {receivablesDueToday && receivablesDueToday.count > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/80 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
                <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {receivablesDueToday.count} recebimento{receivablesDueToday.count > 1 ? 's' : ''} para hoje
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
                  {formatCurrency(receivablesDueToday.total)}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/financeiro')}
              className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-100"
            >
              Ver <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
