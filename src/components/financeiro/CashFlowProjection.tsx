import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  AlertTriangle
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';


export function CashFlowProjection() {
  const { currentCompany } = useAuth();
  const today = startOfDay(new Date());
  const sevenDaysFromNow = addDays(today, 7);

  // Fetch receivables due in next 7 days
  const { data: upcomingReceivables, isLoading: loadingReceivables } = useQuery({
    queryKey: ['receivables-7days', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const todayStr = format(today, 'yyyy-MM-dd');
      const futureStr = format(sevenDaysFromNow, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('id, customer_name, description, total_amount, due_date')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'partial'])
        .gte('due_date', todayStr)
        .lte('due_date', futureStr)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    
  });

  // Fetch expenses due in next 7 days
  const { data: upcomingExpenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses-7days', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const todayStr = format(today, 'yyyy-MM-dd');
      const futureStr = format(sevenDaysFromNow, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, due_date, category')
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending')
        .gte('due_date', todayStr)
        .lte('due_date', futureStr)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    
  });

  // Fetch current company cash balance
  const { data: companyCash, isLoading: loadingCash } = useQuery({
    queryKey: ['company-cash-balance', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;

      const { data, error } = await supabase
        .from('company_cash')
        .select('current_balance')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
    
  });

  const isLoading = loadingReceivables || loadingExpenses || loadingCash;

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  const totalReceivables = (upcomingReceivables || []).reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalExpenses = (upcomingExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const currentBalance = companyCash?.current_balance || 0;
  const projectedBalance = currentBalance + totalReceivables - totalExpenses;
  const netFlow = totalReceivables - totalExpenses;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const isNegativeProjection = projectedBalance < 0;

  return (
    <Card className={isNegativeProjection ? 'border-destructive/50 bg-destructive/5' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Projeção de Fluxo de Caixa
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          Próximos 7 dias
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Balance */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Saldo Atual</span>
          </div>
          <span className={`font-semibold ${currentBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
            {formatCurrency(currentBalance)}
          </span>
        </div>

        {/* Inflows and Outflows */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700 dark:text-green-400">Entradas</span>
            </div>
            <p className="text-lg font-bold text-green-700 dark:text-green-400">
              +{formatCurrency(totalReceivables)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500">
              {upcomingReceivables?.length || 0} parcelas a receber
            </p>
          </div>

          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-red-700 dark:text-red-400">Saídas</span>
            </div>
            <p className="text-lg font-bold text-red-700 dark:text-red-400">
              -{formatCurrency(totalExpenses)}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500">
              {upcomingExpenses?.length || 0} despesas a pagar
            </p>
          </div>
        </div>

        {/* Net Flow */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            {netFlow >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Fluxo Líquido</span>
          </div>
          <span className={`font-semibold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
          </span>
        </div>

        {/* Projected Balance */}
        <div className={`flex items-center justify-between p-4 rounded-lg ${
          isNegativeProjection 
            ? 'bg-destructive/10 border-destructive' 
            : 'bg-primary/10 border-primary/30'
        } border-2`}>
          <div>
            <p className="text-sm text-muted-foreground">Saldo Projetado</p>
            <p className="text-xs text-muted-foreground">
              {format(sevenDaysFromNow, "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold ${isNegativeProjection ? 'text-destructive' : 'text-primary'}`}>
              {formatCurrency(projectedBalance)}
            </p>
          </div>
        </div>

        {/* Warning if negative */}
        {isNegativeProjection && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Atenção: o saldo projetado ficará negativo. Revise as despesas ou antecipe recebimentos.
            </p>
          </div>
        )}

        {/* Upcoming items preview */}
        {(upcomingReceivables?.length || 0) > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Próximos recebimentos:</p>
            <div className="space-y-1">
              {upcomingReceivables?.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[60%]">{r.customer_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {format(new Date(r.due_date + 'T12:00:00'), 'dd/MM')}
                    </span>
                    <span className="font-medium text-green-600">
                      +{formatCurrency(r.total_amount)}
                    </span>
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
