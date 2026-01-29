import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FinancialOSData } from '@/hooks/useDashboardData';

interface FinancialOSSummaryProps {
  data?: FinancialOSData;
}

export const FinancialOSSummary = memo(function FinancialOSSummary({ data }: FinancialOSSummaryProps) {
  const currentMonthLabel = format(new Date(), 'MMMM', { locale: ptBR });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const metrics = [
    {
      icon: ArrowDownCircle,
      label: 'Recebido no mês',
      value: data?.received || 0,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: ArrowUpCircle,
      label: 'A receber (OS)',
      value: data?.toReceive || 0,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Receipt,
      label: 'Custos de produção',
      value: data?.productionCosts || 0,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
    },
    {
      icon: TrendingUp,
      label: `Lucro real (${data?.completedCount || 0} OS)`,
      value: data?.realProfit || 0,
      color: (data?.realProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600',
      bgColor: (data?.realProfit || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
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
});
