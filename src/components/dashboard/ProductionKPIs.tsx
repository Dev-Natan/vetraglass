import { memo } from 'react';
import { Factory, AlertTriangle, Package, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import type { DashboardData } from '@/hooks/useDashboardData';

interface ProductionKPIsProps {
  data?: DashboardData;
}

export const ProductionKPIs = memo(function ProductionKPIs({ data }: ProductionKPIsProps) {
  const osData = data?.osStats;
  const materialsData = data?.materialsStats;
  const receivablesData = data?.receivablesStats;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const kpis = [
    {
      icon: Factory,
      label: 'OS em Produção',
      value: osData?.total || 0,
      subtitle: `${osData?.inProgress || 0} em andamento`,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      link: '/ordens-servico',
    },
    {
      icon: AlertTriangle,
      label: 'OS Atrasadas',
      value: osData?.overdue || 0,
      subtitle: osData?.overdue ? 'Clientes em risco' : 'Tudo em dia',
      color: osData?.overdue ? 'text-destructive' : 'text-muted-foreground',
      bgColor: osData?.overdue ? 'bg-destructive/10' : 'bg-muted/50',
      borderColor: osData?.overdue ? 'border-destructive/30' : 'border-border',
      link: '/ordens-servico?status=overdue',
      alert: osData?.overdue && osData.overdue > 0,
    },
    {
      icon: Package,
      label: 'Materiais Pendentes',
      value: materialsData?.pending || 0,
      subtitle: materialsData?.urgentOrders 
        ? `${materialsData.urgentOrders} urgentes` 
        : 'Nenhum urgente',
      color: materialsData?.pending ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      bgColor: materialsData?.pending ? 'bg-amber-500/10' : 'bg-muted/50',
      borderColor: materialsData?.pending ? 'border-amber-500/20' : 'border-border',
      link: '/pedidos-compra',
      alert: materialsData?.urgentOrders && materialsData.urgentOrders > 0,
    },
    {
      icon: Wallet,
      label: 'Saldo a Receber (OS)',
      value: formatCurrency(receivablesData?.total || 0),
      subtitle: `${receivablesData?.count || 0} parcelas`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      link: '/financeiro?tab=receber',
      isMonetary: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <Link key={kpi.label} to={kpi.link}>
          <Card className={`h-full transition-all hover:shadow-md ${kpi.borderColor} ${kpi.alert ? 'ring-2 ring-destructive/50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                {kpi.alert && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                  </span>
                )}
              </div>
              <div className={`text-2xl font-bold ${kpi.isMonetary ? 'text-lg' : ''} ${kpi.alert ? kpi.color : 'text-foreground'}`}>
                {kpi.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">
                {kpi.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {kpi.subtitle}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
});
