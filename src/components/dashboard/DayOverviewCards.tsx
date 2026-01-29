import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, DollarSign, Receipt, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DayOverviewData {
  appointmentsCount: number;
  receivablesTotal: number;
  receivablesCount: number;
  expensesTotal: number;
  expensesCount: number;
  osAttentionCount: number;
}

interface DayOverviewCardsProps {
  data?: DayOverviewData;
}

export const DayOverviewCards = memo(function DayOverviewCards({ data }: DayOverviewCardsProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const cards = [
    {
      icon: Calendar,
      label: 'Compromissos Hoje',
      value: data?.appointmentsCount || 0,
      subtitle: data?.appointmentsCount === 1 ? '1 agendamento' : `${data?.appointmentsCount || 0} agendamentos`,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      link: '/ordens-servico?tab=calendario',
    },
    {
      icon: DollarSign,
      label: 'Cobrar Hoje',
      value: formatCurrency(data?.receivablesTotal || 0),
      subtitle: `${data?.receivablesCount || 0} parcela(s)`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      link: '/financeiro?tab=receber',
      isMonetary: true,
      alert: (data?.receivablesCount || 0) > 0,
    },
    {
      icon: Receipt,
      label: 'Pagar Hoje',
      value: formatCurrency(data?.expensesTotal || 0),
      subtitle: `${data?.expensesCount || 0} despesa(s)`,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      link: '/financeiro?tab=despesas',
      isMonetary: true,
      alert: (data?.expensesCount || 0) > 0,
    },
    {
      icon: AlertTriangle,
      label: 'OS Atenção',
      value: data?.osAttentionCount || 0,
      subtitle: (data?.osAttentionCount || 0) > 0 ? 'Atrasadas/vencendo' : 'Tudo em dia',
      color: (data?.osAttentionCount || 0) > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: (data?.osAttentionCount || 0) > 0 ? 'bg-destructive/10' : 'bg-muted/50',
      borderColor: (data?.osAttentionCount || 0) > 0 ? 'border-destructive/30' : 'border-border',
      link: '/ordens-servico',
      alert: (data?.osAttentionCount || 0) > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Link key={card.label} to={card.link}>
          <Card className={`h-full transition-all hover:shadow-md ${card.borderColor} ${card.alert ? 'ring-2 ring-offset-2 ring-offset-background ring-primary/20' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                {card.alert && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                )}
              </div>
              <div className={`text-2xl font-bold ${card.isMonetary ? 'text-lg' : ''} ${card.alert ? card.color : 'text-foreground'}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">
                {card.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {card.subtitle}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
});
