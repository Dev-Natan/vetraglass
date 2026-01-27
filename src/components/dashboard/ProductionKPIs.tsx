import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Factory, AlertTriangle, Package, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { CACHE_TIMES } from '@/lib/queryConfig';
import { Link } from 'react-router-dom';

export const ProductionKPIs = memo(function ProductionKPIs() {
  const { currentCompany } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  // OS em produção e atrasadas
  const { data: osData } = useQuery({
    queryKey: ['production-kpis-os', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { inProgress: 0, overdue: 0, pending: 0 };

      const { data: orders } = await supabase
        .from('ordens_servico')
        .select('id, status, estimated_end')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'in_progress']);

      const inProgress = (orders || []).filter(o => o.status === 'in_progress').length;
      const pending = (orders || []).filter(o => o.status === 'pending').length;
      const overdue = (orders || []).filter(o => 
        o.estimated_end && o.estimated_end < today
      ).length;

      return { inProgress, pending, overdue, total: inProgress + pending };
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  // Materiais pendentes (pedidos de compra não recebidos)
  const { data: materialsData } = useQuery({
    queryKey: ['production-kpis-materials', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { pending: 0, urgentOrders: 0 };

      const { data: orders } = await supabase
        .from('purchase_orders')
        .select('id, status, expected_delivery')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'ordered', 'partial']);

      const pending = orders?.length || 0;
      const urgentOrders = orders?.filter(o => 
        o.expected_delivery && o.expected_delivery <= today
      ).length || 0;

      return { pending, urgentOrders };
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  // Saldo a receber de OS
  const { data: receivablesData } = useQuery({
    queryKey: ['production-kpis-receivables', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { total: 0, count: 0 };

      const { data: receivables } = await supabase
        .from('accounts_receivable')
        .select('id, total_amount, paid_amount, ordem_servico_id')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'partial'])
        .not('ordem_servico_id', 'is', null);

      const total = (receivables || []).reduce((sum, r) => {
        const remaining = (r.total_amount || 0) - (r.paid_amount || 0);
        return sum + remaining;
      }, 0);

      return { total, count: receivables?.length || 0 };
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const kpis = [
    {
      icon: Factory,
      label: 'OS em Produção',
      value: osData?.total || 0,
      subtitle: `${osData?.inProgress || 0} em andamento`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      link: '/ordens-servico',
    },
    {
      icon: AlertTriangle,
      label: 'OS Atrasadas',
      value: osData?.overdue || 0,
      subtitle: osData?.overdue ? 'Clientes em risco' : 'Tudo em dia',
      color: osData?.overdue ? 'text-red-600' : 'text-muted-foreground',
      bgColor: osData?.overdue ? 'bg-red-500/10' : 'bg-muted/50',
      borderColor: osData?.overdue ? 'border-red-500/30' : 'border-border',
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
      color: materialsData?.pending ? 'text-amber-600' : 'text-muted-foreground',
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
      color: 'text-emerald-600',
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
          <Card className={`h-full transition-all hover:shadow-md ${kpi.borderColor} ${kpi.alert ? 'animate-pulse' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                {kpi.alert && (
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
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
