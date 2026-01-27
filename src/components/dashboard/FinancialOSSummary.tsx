import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, Receipt } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CACHE_TIMES } from '@/lib/queryConfig';

export function FinancialOSSummary() {
  const { currentCompany } = useAuth();
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const currentMonthLabel = format(today, 'MMMM', { locale: ptBR });

  const { data: financialData, isLoading } = useQuery({
    queryKey: ['financial-os-summary', currentCompany?.id, format(monthStart, 'yyyy-MM')],
    queryFn: async () => {
      if (!currentCompany?.id) return null;

      // Recebimentos de OS no mês (quote_deposits)
      const { data: deposits } = await supabase
        .from('quote_deposits')
        .select('amount, created_at')
        .eq('company_id', currentCompany.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      const receivedFromDeposits = (deposits || [])
        .reduce((sum, d) => sum + (d.amount || 0), 0);

      // Pagamentos recebidos de contas a receber de OS
      const { data: receivables } = await supabase
        .from('accounts_receivable')
        .select('paid_amount, paid_date, total_amount, status')
        .eq('company_id', currentCompany.id)
        .not('ordem_servico_id', 'is', null)
        .gte('paid_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('paid_date', format(monthEnd, 'yyyy-MM-dd'));

      const receivedFromPayments = (receivables || [])
        .reduce((sum, r) => sum + (r.paid_amount || 0), 0);

      const totalReceived = receivedFromDeposits + receivedFromPayments;

      // Saldo a receber de OS
      const { data: pendingReceivables } = await supabase
        .from('accounts_receivable')
        .select('total_amount, paid_amount')
        .eq('company_id', currentCompany.id)
        .not('ordem_servico_id', 'is', null)
        .in('status', ['pending', 'partial']);

      const toReceive = (pendingReceivables || []).reduce((sum, r) => {
        return sum + ((r.total_amount || 0) - (r.paid_amount || 0));
      }, 0);

      // Custos de produção (despesas pagas no mês)
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', currentCompany.id)
        .eq('status', 'paid')
        .gte('paid_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('paid_date', format(monthEnd, 'yyyy-MM-dd'));

      const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

      // OS finalizadas no mês
      const { data: completedOS } = await supabase
        .from('ordens_servico')
        .select('id, total_amount')
        .eq('company_id', currentCompany.id)
        .eq('status', 'completed')
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());

      const completedRevenue = (completedOS || []).reduce((sum, os) => sum + (os.total_amount || 0), 0);
      // Usando uma estimativa de custo (50% da receita) até termos campo actual_cost
      const estimatedCosts = completedRevenue * 0.5;
      const realProfit = completedRevenue - estimatedCosts;

      return {
        received: totalReceived,
        toReceive,
        productionCosts: totalExpenses,
        realProfit,
        completedCount: completedOS?.length || 0,
      };
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            Financeiro das OS - {currentMonthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      icon: ArrowDownCircle,
      label: 'Recebido no mês',
      value: financialData?.received || 0,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: ArrowUpCircle,
      label: 'A receber (OS)',
      value: financialData?.toReceive || 0,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Receipt,
      label: 'Custos de produção',
      value: financialData?.productionCosts || 0,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
    },
    {
      icon: TrendingUp,
      label: `Lucro real (${financialData?.completedCount || 0} OS)`,
      value: financialData?.realProfit || 0,
      color: (financialData?.realProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600',
      bgColor: (financialData?.realProfit || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base capitalize">
          <Wallet className="h-4 w-4 text-primary" />
          Financeiro das OS - {currentMonthLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
            >
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <div>
                <p className={`text-lg font-bold ${metric.color}`}>
                  {formatCurrency(metric.value)}
                </p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
