import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Factory, AlertTriangle, Package, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CACHE_TIMES } from '@/lib/queryConfig';
import { Link } from 'react-router-dom';

export const ProductionKPIs = memo(function ProductionKPIs() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  // 🏭 OS EM PRODUÇÃO
  const { data: osData } = useQuery({
    queryKey: ['kpi-os-producao', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      
      // Total em produção
      const { count: total } = await supabase
        .from('ordens_servico')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!)
        .in('status', ['pending', 'in_progress']);
      
      // Em andamento
      const { count: inProgress } = await supabase
        .from('ordens_servico')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!)
        .eq('status', 'in_progress');

      // Atrasadas
      const { count: overdue } = await supabase
        .from('ordens_servico')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!)
        .in('status', ['pending', 'in_progress'])
        .not('estimated_end', 'is', null)
        .lt('estimated_end', hoje);

      return {
        total: total || 0,
        inProgress: inProgress || 0,
        overdue: overdue || 0,
      };
    },
    ...CACHE_TIMES.DYNAMIC,
  });

  // 📦 MATERIAIS PENDENTES
  const { data: materialsData } = useQuery({
    queryKey: ['kpi-materiais-pendentes', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: pendingPOs } = await supabase
        .from('purchase_orders')
        .select('id, status')
        .eq('company_id', companyId!)
        .in('status', ['pending', 'ordered', 'partial']);

      if (!pendingPOs || pendingPOs.length === 0) {
        return { pending: 0, urgentOrders: 0 };
      }

      const poIds = pendingPOs.map(po => po.id);
      const { count } = await supabase
        .from('purchase_order_items')
        .select('*', { count: 'exact', head: true })
        .in('purchase_order_id', poIds)
        .eq('status', 'pending');

      // Pedidos urgentes (status = pending ainda não foram encomendados)
      const urgentOrders = pendingPOs.filter(po => po.status === 'pending').length;

      return { 
        pending: count || 0, 
        urgentOrders 
      };
    },
    ...CACHE_TIMES.DYNAMIC,
  });

  // 💰 SALDO A RECEBER (contas a receber pendentes de OS)
  const { data: receivablesData } = useQuery({
    queryKey: ['kpi-saldo-receber-os', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts_receivable')
        .select('total_amount, paid_amount')
        .eq('company_id', companyId!)
        .not('ordem_servico_id', 'is', null)
        .in('status', ['pending', 'partial']);

      const total = data?.reduce(
        (acc, ar) => acc + ((ar.total_amount || 0) - (ar.paid_amount || 0)),
        0
      ) || 0;

      return { total, count: data?.length || 0 };
    },
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
