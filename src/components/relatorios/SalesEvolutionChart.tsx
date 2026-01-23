import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Sale {
  id: string;
  total_amount: number;
  created_at: string;
  payment_status: string;
}

interface SalesEvolutionChartProps {
  sales: Sale[];
  dateRange: { start: Date; end: Date };
  isLoading?: boolean;
}

export function SalesEvolutionChart({ sales, dateRange, isLoading }: SalesEvolutionChartProps) {
  const chartData = useMemo(() => {
    // Limita a 31 dias para melhor visualização
    const days = eachDayOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    }).slice(0, 31);

    let accumulated = 0;
    
    return days.map(day => {
      const daySales = (sales || []).filter(sale => {
        const saleDate = new Date(sale.created_at);
        return isSameDay(saleDate, day) && sale.payment_status !== 'cancelled';
      });
      
      const dayTotal = daySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      accumulated += dayTotal;
      
      return {
        date: format(day, 'dd/MM', { locale: ptBR }),
        fullDate: format(day, "dd 'de' MMMM", { locale: ptBR }),
        vendas: daySales.length,
        total: dayTotal,
        acumulado: accumulated,
      };
    });
  }, [sales, dateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.fullDate}</p>
          <div className="space-y-1 mt-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Vendas: </span>
              <span className="font-medium">{data.vendas}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Total do dia: </span>
              <span className="font-medium text-primary">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(data.total)}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Acumulado: </span>
              <span className="font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(data.acumulado)}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução de Vendas</CardTitle>
          <CardDescription>Acumulado no período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-lg">Evolução de Vendas</CardTitle>
        <CardDescription>Faturamento acumulado no período</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                className="fill-muted-foreground"
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={60}
                className="fill-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="acumulado"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorAcumulado)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
