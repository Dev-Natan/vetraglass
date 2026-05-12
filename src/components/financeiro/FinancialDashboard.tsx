import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export function FinancialDashboard() {
  const { currentCompany } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['financial-stats', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;

      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
      const prevMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

      // current month sales
      const { data: sales } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('company_id', currentCompany.id)
        .eq('payment_status', 'paid')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      // current month expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', currentCompany.id)
        .eq('status', 'paid')
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd);

      // prev month sales for comparison
      const { data: prevSales } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('company_id', currentCompany.id)
        .eq('payment_status', 'paid')
        .gte('created_at', prevMonthStart)
        .lte('created_at', prevMonthEnd);

      // pending receivables
      const { data: pendingReceivables } = await supabase
        .from('accounts_receivable')
        .select('total_amount')
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending');

      // overdue expenses
      const { data: overdueExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString().split('T')[0]);

      const currentRevenue = sales?.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0) || 0;
      const currentExpenses = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
      const prevRevenue = prevSales?.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0) || 0;
      const totalPendingReceivables = pendingReceivables?.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0) || 0;
      const totalOverdueExpenses = overdueExpenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

      const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      return {
        currentRevenue,
        currentExpenses,
        netProfit: currentRevenue - currentExpenses,
        revenueChange,
        totalPendingReceivables,
        totalOverdueExpenses
      };
    },
    enabled: !!currentCompany?.id,
  });

  const { data: chartData } = useQuery({
    queryKey: ['financial-chart-data', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        months.push({
          start: startOfMonth(date).toISOString(),
          end: endOfMonth(date).toISOString(),
          label: format(date, 'MMM', { locale: ptBR }),
        });
      }

      const data = await Promise.all(months.map(async (m) => {
        const { data: sales } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('company_id', currentCompany.id)
          .eq('payment_status', 'paid')
          .gte('created_at', m.start)
          .lte('created_at', m.end);

        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('company_id', currentCompany.id)
          .eq('status', 'paid')
          .gte('due_date', m.start)
          .lte('due_date', m.end);

        return {
          name: m.label,
          receitas: sales?.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0) || 0,
          despesas: expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0,
        };
      }));

      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.currentRevenue || 0)}</div>
            <div className="flex items-center mt-1">
              {stats && stats.revenueChange >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-xs font-medium ${stats && stats.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(stats?.revenueChange || 0).toFixed(1)}% em relação ao mês anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats && stats.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(stats?.netProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Receitas - Despesas pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contas a Receber</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats?.totalPendingReceivables || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pendente no sistema</p>
          </CardContent>
        </Card>

        <Card className={stats && stats.totalOverdueExpenses > 0 ? "border-red-200 bg-red-50/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Atrasadas</CardTitle>
            <AlertCircle className={`h-4 w-4 ${stats && stats.totalOverdueExpenses > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats && stats.totalOverdueExpenses > 0 ? 'text-red-600' : ''}`}>
              {formatCurrency(stats?.totalOverdueExpenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pagamentos vencidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Fluxo de Caixa (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `R$${value/1000}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Distribuição Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `R$${value/1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area 
                    type="monotone" 
                    dataKey={(data) => data.receitas - data.despesas} 
                    name="Lucro Operacional" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
