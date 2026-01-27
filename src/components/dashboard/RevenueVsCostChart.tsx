import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';
import { CACHE_TIMES } from '@/lib/queryConfig';

export function RevenueVsCostChart() {
  const { currentCompany } = useAuth();
  const today = new Date();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['revenue-vs-cost-chart', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const days: { date: string; label: string; receita: number; custo: number }[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const day = subDays(today, i);
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayStr = format(day, 'yyyy-MM-dd');

        // Receitas (entradas de caixa)
        const { data: movements } = await supabase
          .from('cash_movements')
          .select('amount, type')
          .eq('company_id', currentCompany.id)
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());

        const receita = (movements || [])
          .filter(m => m.type === 'entrada')
          .reduce((sum, m) => sum + (m.amount || 0), 0);

        const custo = (movements || [])
          .filter(m => m.type === 'saida')
          .reduce((sum, m) => sum + (m.amount || 0), 0);

        days.push({
          date: dayStr,
          label: format(day, 'EEE', { locale: ptBR }),
          receita,
          custo,
        });
      }

      return days;
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
    return `R$ ${value.toFixed(0)}`;
  };

  const totalReceita = chartData?.reduce((sum, d) => sum + d.receita, 0) || 0;
  const totalCusto = chartData?.reduce((sum, d) => sum + d.custo, 0) || 0;
  const lucro = totalReceita - totalCusto;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Receita vs Custo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Fluxo de Caixa - 7 dias
          </CardTitle>
          <span className={`text-sm font-semibold ${lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {lucro >= 0 ? '+' : ''}{formatCurrency(lucro)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="label" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                className="fill-muted-foreground"
              />
              <Tooltip 
                formatter={(value: number) => [
                  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="receita"
                name="Receita"
                stroke="hsl(142, 71%, 45%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReceita)"
              />
              <Area
                type="monotone"
                dataKey="custo"
                name="Custo"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCusto)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
