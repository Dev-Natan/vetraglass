import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RefreshCw,
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
  Line,
  ComposedChart,
} from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Categorias de caixa que são apenas transferência interna (não são receita/despesa). */
const INTERNAL_CATEGORIES = ['abertura_caixa', 'fechamento_caixa', 'ajuste_sistema', 'sangria', 'reforco'];

interface MonthlyFlow {
  name: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export function FinancialDashboard() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  /** KPIs do mês corrente, calculados a partir do caixa real + despesas. */
  const { data: stats, isLoading } = useQuery({
    queryKey: ['financial-stats', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const prevStart = startOfMonth(subMonths(now, 1));
      const prevEnd = endOfMonth(subMonths(now, 1));

      const iso = (d: Date) => d.toISOString();
      const day = (d: Date) => format(d, 'yyyy-MM-dd');

      const [receivedNow, receivedPrev, expensesNow, expensesPrev] = await Promise.all([
        supabase
          .from('accounts_receivable')
          .select('paid_amount, total_amount, paid_date')
          .eq('company_id', companyId)
          .eq('status', 'paid')
          .gte('paid_date', day(monthStart))
          .lte('paid_date', day(monthEnd)),
        supabase
          .from('accounts_receivable')
          .select('paid_amount, total_amount')
          .eq('company_id', companyId)
          .eq('status', 'paid')
          .gte('paid_date', day(prevStart))
          .lte('paid_date', day(prevEnd)),
        supabase
          .from('expenses')
          .select('amount, paid_amount')
          .eq('company_id', companyId)
          .eq('status', 'paid')
          .gte('due_date', day(monthStart))
          .lte('due_date', day(monthEnd)),
        supabase
          .from('expenses')
          .select('amount, paid_amount')
          .eq('company_id', companyId)
          .eq('status', 'paid')
          .gte('due_date', day(prevStart))
          .lte('due_date', day(prevEnd)),
      ]);

      // Depósitos/sinais de orçamento recebidos no período (não passam por accounts_receivable)
      const { data: deposits } = await supabase
        .from('quote_deposits')
        .select('amount, created_at, status')
        .eq('company_id', companyId)
        .eq('status', 'paid')
        .gte('created_at', iso(monthStart))
        .lte('created_at', iso(monthEnd));

      const sum = (rows: any[] | null | undefined, field: string, fallback?: string) =>
        (rows || []).reduce(
          (acc, r) => acc + (Number(r[field]) || (fallback ? Number(r[fallback]) || 0 : 0)),
          0,
        );

      const revenue =
        sum(receivedNow.data, 'paid_amount', 'total_amount') + sum(deposits, 'amount');
      const prevRevenue = sum(receivedPrev.data, 'paid_amount', 'total_amount');
      const expensesTotal = sum(expensesNow.data, 'paid_amount', 'amount');
      const prevExpenses = sum(expensesPrev.data, 'paid_amount', 'amount');

      return {
        revenue,
        expenses: expensesTotal,
        netProfit: revenue - expensesTotal,
        revenueChange: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
        expenseChange: prevExpenses > 0 ? ((expensesTotal - prevExpenses) / prevExpenses) * 100 : 0,
      };
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  /** Inadimplência: saldos devedores de cobranças vencidas. */
  const { data: delinquency } = useQuery({
    queryKey: ['financial-delinquency', companyId],
    queryFn: async () => {
      if (!companyId) return { total: 0, count: 0, clients: 0 };

      const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('total_amount, paid_amount, due_date, status, customer_name, client_id')
        .eq('company_id', companyId)
        .in('status', ['pending', 'partial', 'overdue'])
        .lt('due_date', today);

      if (error) throw error;

      const rows = (data || []).filter((r) =>
        isBefore(new Date(r.due_date), startOfDay(new Date())),
      );
      const total = rows.reduce(
        (acc, r) => acc + Math.max(0, (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0)),
        0,
      );
      const clients = new Set(rows.map((r) => r.client_id || r.customer_name)).size;

      return { total: Number(total.toFixed(2)), count: rows.length, clients };
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  /** Fluxo de caixa real mês a mês (últimos 6 meses) via movimentações de caixa. */
  const { data: chartData = [], isLoading: chartLoading } = useQuery({
    queryKey: ['financial-chart-data', companyId],
    queryFn: async (): Promise<MonthlyFlow[]> => {
      if (!companyId) return [];

      const rangeStart = startOfMonth(subMonths(new Date(), 5));
      const rangeEnd = endOfMonth(new Date());

      const [drawer, company] = await Promise.all([
        supabase
          .from('cash_movements')
          .select('type, amount, category, created_at')
          .eq('company_id', companyId)
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString()),
        supabase
          .from('company_cash_movements')
          .select('type, amount, category, created_at')
          .eq('company_id', companyId)
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString()),
      ]);

      const buckets = new Map<string, MonthlyFlow>();
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        buckets.set(format(d, 'yyyy-MM'), {
          name: format(d, 'MMM/yy', { locale: ptBR }),
          entradas: 0,
          saidas: 0,
          saldo: 0,
        });
      }

      const apply = (rows: any[] | null | undefined) => {
        (rows || []).forEach((m) => {
          if (INTERNAL_CATEGORIES.includes(String(m.category || ''))) return;
          const key = format(new Date(m.created_at), 'yyyy-MM');
          const bucket = buckets.get(key);
          if (!bucket) return;
          const amount = Number(m.amount) || 0;
          if (String(m.type).startsWith('entrada') || m.type === 'transferencia_in') {
            bucket.entradas += amount;
          } else {
            bucket.saidas += amount;
          }
        });
      };

      apply(drawer.data);
      apply(company.data);

      return Array.from(buckets.values()).map((b) => ({
        ...b,
        entradas: Number(b.entradas.toFixed(2)),
        saidas: Number(b.saidas.toFixed(2)),
        saldo: Number((b.entradas - b.saidas).toFixed(2)),
      }));
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  const hasFlow = useMemo(
    () => chartData.some((d) => d.entradas > 0 || d.saidas > 0),
    [chartData],
  );

  const refreshAll = () => {
    ['financial-stats', 'financial-chart-data', 'financial-delinquency'].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key], refetchType: 'all' }),
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[340px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Consolidado de {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })} · atualização em tempo real
        </p>
        <Button variant="ghost" size="sm" onClick={refreshAll} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(stats?.revenue || 0)}</div>
            <div className="flex items-center mt-1">
              {(stats?.revenueChange ?? 0) >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive mr-1" />
              )}
              <span className="text-xs text-muted-foreground">
                {Math.abs(stats?.revenueChange || 0).toFixed(1)}% vs. mês anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{fmt(stats?.expenses || 0)}</div>
            <div className="flex items-center mt-1">
              <span className="text-xs text-muted-foreground">
                {Math.abs(stats?.expenseChange || 0).toFixed(1)}% vs. mês anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro Líquido
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (stats?.netProfit ?? 0) >= 0 ? 'text-primary' : 'text-destructive'
              }`}
            >
              {fmt(stats?.netProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Recebido − Despesas pagas</p>
          </CardContent>
        </Card>

        <Card className={(delinquency?.total ?? 0) > 0 ? 'border-destructive/40' : undefined}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inadimplência
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                (delinquency?.total ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (delinquency?.total ?? 0) > 0 ? 'text-destructive' : ''
              }`}
            >
              {fmt(delinquency?.total || 0)}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className="text-[10px]">
                {delinquency?.count || 0} cobranças vencidas
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {delinquency?.clients || 0} clientes
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Fluxo de Caixa Mês a Mês (Entradas vs Saídas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : !hasFlow ? (
            <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma movimentação de caixa registrada nos últimos 6 meses.
            </div>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [fmt(value), name]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="entradas"
                    name="Entradas"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="saidas"
                    name="Saídas"
                    fill="hsl(var(--destructive))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo líquido"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
