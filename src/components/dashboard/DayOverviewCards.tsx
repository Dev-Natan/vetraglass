import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, DollarSign, Receipt, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TodayAppointmentsDialog } from './TodayAppointmentsDialog';

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
  const [appointmentsOpen, setAppointmentsOpen] = useState(false);

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
      link: null,
      onClick: () => setAppointmentsOpen(true),
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

  const renderCardContent = (card: typeof cards[number]) => (
    <Card className={cn(
      "h-full transition-all duration-300 border-none shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 relative overflow-hidden cursor-pointer",
      card.alert ? "ring-1 ring-primary/20" : ""
    )}>
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150",
        card.bgColor
      )} />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl transition-colors duration-300", card.bgColor, "group-hover:bg-opacity-20")}>
            <card.icon className={cn("h-6 w-6", card.color)} />
          </div>
          {card.alert && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Atenção
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">{card.label}</h3>
          <div className={cn(
            "text-xl sm:text-2xl font-bold tracking-tight transition-colors duration-300",
            card.alert ? card.color : "text-foreground",
            card.isMonetary ? "text-lg sm:text-xl lg:text-2xl" : "text-2xl sm:text-3xl"
          )}>
            {card.value}
          </div>
          <p className="text-xs text-muted-foreground/80 font-medium">{card.subtitle}</p>
        </div>
        <div className={cn(
          "absolute bottom-0 left-0 h-1 w-0 bg-primary transition-all duration-300 group-hover:w-full",
          card.alert ? "bg-destructive" : "bg-primary"
        )} />
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) =>
          card.link ? (
            <Link key={card.label} to={card.link} className="group">
              {renderCardContent(card)}
            </Link>
          ) : (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className="group text-left"
            >
              {renderCardContent(card)}
            </button>
          )
        )}
      </div>
      <TodayAppointmentsDialog open={appointmentsOpen} onOpenChange={setAppointmentsOpen} />
    </>
  );
});
