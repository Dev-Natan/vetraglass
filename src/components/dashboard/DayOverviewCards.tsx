import { memo } from 'react';
import { cn } from '@/lib/utils';
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
      link: '/ordens-servico?tab=hoje',
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
      link: '/ordens-servico?tab=lista',
      alert: (data?.osAttentionCount || 0) > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <Link key={card.label} to={card.link} className="group h-full">
          <Card className={cn(
            "h-full transition-all duration-500 border border-border/40 shadow-sm group-hover:shadow-2xl group-hover:-translate-y-2 relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem]",
            card.alert ? "ring-2 ring-primary/10" : ""
          )}>
            {/* Background Accent Gradient */}
            <div className={cn(
              "absolute top-0 right-0 w-40 h-40 -mr-10 -mt-10 rounded-full opacity-10 transition-transform duration-700 group-hover:scale-150 group-hover:opacity-20 blur-2xl",
              card.bgColor
            )} />
            
            <CardContent className="p-5 sm:p-8 relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <div className={cn(
                  "p-4 rounded-2xl transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:rotate-6",
                  card.bgColor,
                  "group-hover:bg-opacity-30"
                )}>
                  <card.icon className={cn("h-7 w-7 transition-transform group-hover:scale-110", card.color)} />
                </div>
                {card.alert && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive text-[9px] font-black uppercase tracking-[0.15em] border border-destructive/20 shadow-sm animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    Prioridade
                  </div>
                )}
              </div>
              
              <div className="space-y-1 mt-auto">
                <h3 className="text-xs font-black text-muted-foreground/60 uppercase tracking-[0.1em]">
                  {card.label}
                </h3>
                <div className={cn(
                  "font-display font-black tracking-tighter transition-all duration-500",
                  card.alert ? card.color : "text-foreground",
                  card.isMonetary ? "text-2xl sm:text-3xl" : "text-4xl"
                )}>
                  {card.value}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <p className="text-[11px] text-muted-foreground font-bold tracking-tight">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
});
