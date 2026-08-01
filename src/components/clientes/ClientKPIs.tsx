import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, ShoppingCart, AlertTriangle, Calendar, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { differenceInDays } from 'date-fns';

interface ClientKPIsProps {
  clientId: string;
}

export const ClientKPIs = memo(function ClientKPIs({ clientId }: ClientKPIsProps) {
  const { currentCompany } = useAuth();

  const { data: kpiData, isLoading } = useQuery({
    queryKey: ['client-kpis', clientId, currentCompany?.id],
    enabled: !!currentCompany?.id && !!clientId,
    queryFn: async () => {
      // Total de vendas
      const salesResult = await supabase
        .from('sales')
        .select('total_amount, created_at')
        .eq('company_id', currentCompany!.id)
        .eq('client_id', clientId)
        .neq('payment_status', 'cancelled');
      
      // Saldo devedor
      const receivablesResult = await supabase
        .from('accounts_receivable')
        .select('total_amount, paid_amount, status')
        .eq('company_id', currentCompany!.id)
        .eq('client_id', clientId)
        .in('status', ['pending', 'overdue']);
      
      // OS ativas - using any to avoid TS depth issues
      const osResult = await supabase
        .from('ordens_servico')
        .select('id, status')
        .eq('company_id', currentCompany!.id)
        .eq('client_id', clientId)
        .in('status', ['pending', 'in_progress']);
        
      const sales = salesResult.data || [];
      const receivables = receivablesResult.data || [];
      const osAtivas = osResult.data || [];

      // Calcular métricas
      const totalGasto = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const totalCompras = sales.length;
      const ticketMedio = totalCompras > 0 ? totalGasto / totalCompras : 0;
      
      // Saldo devedor
      const saldoDevedor = receivables.reduce((sum, r) => {
        return sum + ((r.total_amount || 0) - (r.paid_amount || 0));
      }, 0);
      
      const inadimplente = receivables.some(r => r.status === 'overdue');
      
      // Dias desde última compra
      const ultimaCompra = sales.length > 0 
        ? sales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;
      const diasDesdeUltimaCompra = ultimaCompra 
        ? differenceInDays(new Date(), new Date(ultimaCompra.created_at))
        : null;

      return {
        totalGasto,
        totalCompras,
        ticketMedio,
        saldoDevedor,
        inadimplente,
        diasDesdeUltimaCompra,
        osAtivas: osAtivas.length
      };
    }
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="p-3 animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-6 bg-muted rounded w-16" />
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      icon: DollarSign,
      label: 'Total Gasto',
      value: formatCurrency(kpiData?.totalGasto || 0),
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30'
    },
    {
      icon: ShoppingCart,
      label: 'Compras',
      value: kpiData?.totalCompras || 0,
      subLabel: `Ticket: ${formatCurrency(kpiData?.ticketMedio || 0)}`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30'
    },
    {
      icon: AlertTriangle,
      label: 'Saldo Devedor',
      value: formatCurrency(kpiData?.saldoDevedor || 0),
      alert: kpiData?.inadimplente,
      color: kpiData?.inadimplente ? 'text-red-600' : 'text-yellow-600',
      bgColor: kpiData?.inadimplente ? 'bg-red-50 dark:bg-red-950/30' : 'bg-yellow-50 dark:bg-yellow-950/30'
    },
    {
      icon: Calendar,
      label: 'Última Compra',
      value: kpiData?.diasDesdeUltimaCompra !== null 
        ? `${kpiData.diasDesdeUltimaCompra} dias`
        : 'Nunca',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30'
    },
    {
      icon: TrendingUp,
      label: 'OS Ativas',
      value: kpiData?.osAtivas || 0,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((kpi, index) => (
        <Card key={index} className={`p-3 ${kpi.bgColor} border-0`}>
          <div className="flex items-center gap-2 mb-1">
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
          </div>
          <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
          {kpi.subLabel && (
            <p className="text-xs text-muted-foreground">{kpi.subLabel}</p>
          )}
          {kpi.alert && (
            <span className="text-xs text-red-600 font-medium">Inadimplente</span>
          )}
        </Card>
      ))}
    </div>
  );
});
