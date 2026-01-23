import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Sale {
  id: string;
  items?: any;
  created_at: string;
  payment_status: string;
}

interface TopProductsChartProps {
  sales: Sale[];
  isLoading?: boolean;
}

export function TopProductsChart({ sales, isLoading }: TopProductsChartProps) {
  const chartData = useMemo(() => {
    const productMap = new Map<string, { name: string; total: number; quantity: number }>();
    
    (sales || []).forEach(sale => {
      if (sale.payment_status === 'cancelled') return;
      
      const items = sale.items as any[];
      if (!Array.isArray(items)) return;
      
      items.forEach((item: any) => {
        const name = item.name || item.description || 'Produto';
        const existing = productMap.get(name);
        const itemTotal = (item.quantity || 1) * (item.unit_price || item.price || 0);
        
        if (existing) {
          existing.total += itemTotal;
          existing.quantity += (item.quantity || 1);
        } else {
          productMap.set(name, {
            name: name.length > 20 ? name.substring(0, 20) + '...' : name,
            total: itemTotal,
            quantity: item.quantity || 1,
          });
        }
      });
    });
    
    return Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [sales]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-primary font-bold">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(data.total)}
          </p>
          <p className="text-muted-foreground text-sm">{data.quantity} unidades</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Produtos Mais Vendidos</CardTitle>
          <CardDescription>Top 5 por faturamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Produtos Mais Vendidos</CardTitle>
          <CardDescription>Top 5 por faturamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Nenhum produto vendido no período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Produtos Mais Vendidos</CardTitle>
        <CardDescription>Top 5 por faturamento</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis 
                type="number"
                tickFormatter={formatCurrency}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={100}
                className="fill-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    className={index === 0 ? 'fill-primary' : 'fill-primary/60'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
