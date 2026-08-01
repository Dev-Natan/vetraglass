import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, ShoppingCart, AlertTriangle, Calendar, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientKPIsProps {
  clientId: string;
  clientName?: string | null;
}

/** Status considerados como "compra efetivada" para o cliente. */
const CLOSED_QUOTE_STATUSES = ['approved', 'converted', 'completed', 'finalizado'];

export const ClientKPIs = memo(function ClientKPIs({ clientId, clientName }: ClientKPIsProps) {
  const { currentCompany } = useAuth();

  const { data: kpiData, isLoading } = useQuery({
    queryKey: ['client-kpis', clientId, clientName, currentCompany?.id],
    enabled: !!currentCompany?.id && !!clientId,
    queryFn: async () => {
      const companyId = currentCompany!.id;
      // Registros antigos podem não ter client_id preenchido — casamos também pelo nome.
      const escapedName = clientName ? clientName.replace(/[,()]/g, ' ').trim() : null;
      const linkFilter = escapedName
        ? `client_id.eq.${clientId},customer_name.eq.${escapedName}`
        : `client_id.eq.${clientId}`;

      const [quotesResult, receivablesResult, osResult] = await Promise.all([
        supabase
          .from('quotes')
          .select('id, status, final_amount, total_amount, created_at')
          .eq('company_id', companyId)
          .or(linkFilter),
        supabase
          .from('accounts_receivable')
          .select('total_amount, paid_amount, status')
          .eq('company_id', companyId)
          .eq('client_id', clientId)
          .in('status', ['pending', 'overdue']),
        supabase
          .from('ordens_servico')
          .select('id, status')
          .eq('company_id', companyId)
          .or(linkFilter),
      ]);

      const quotes = quotesResult.data || [];
      const receivables = receivablesResult.data || [];
      const os = osResult.data || [];

      const closedQuotes = quotes.filter((q: any) =>
        CLOSED_QUOTE_STATUSES.includes(String(q.status || '').toLowerCase())
      );

      const totalGasto = closedQuotes.reduce(
        (sum: number, q: any) => sum + Number(q.final_amount ?? q.total_amount ?? 0),
        0
      );
      const totalCompras = closedQuotes.length;
      const ticketMedio = totalCompras > 0 ? totalGasto / totalCompras : 0;

      const saldoDevedor = receivables.reduce(
        (sum: number, r: any) => sum + (Number(r.total_amount || 0) - Number(r.paid_amount || 0)),
        0
      );
      const inadimplente = receivables.some((r: any) => r.status === 'overdue');

      const ultimaCompra = closedQuotes
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

      const osAtivas = os.filter((o: any) =>
        ['pending', 'in_progress', 'em_producao', 'aguardando'].includes(
          String(o.status || '').toLowerCase()
        )
      ).length;

      return {
        totalGasto,
        totalCompras,
        ticketMedio,
        saldoDevedor,
        inadimplente,
        ultimaCompraDate: ultimaCompra ? new Date(ultimaCompra.created_at) : null,
        osAtivas,
      };
    },
  });

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
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
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      icon: ShoppingCart,
      label: 'Compras',
      value: kpiData?.totalCompras || 0,
      subLabel: `Ticket: ${formatCurrency(kpiData?.ticketMedio || 0)}`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      icon: AlertTriangle,
      label: 'Saldo Devedor',
      value: formatCurrency(kpiData?.saldoDevedor || 0),
      alert: kpiData?.inadimplente,
      color: kpiData?.inadimplente ? 'text-red-600' : 'text-yellow-600',
      bgColor: kpiData?.inadimplente
        ? 'bg-red-50 dark:bg-red-950/30'
        : 'bg-yellow-50 dark:bg-yellow-950/30',
    },
    {
      icon: Calendar,
      label: 'Última Compra',
      value: kpiData?.ultimaCompraDate
        ? format(kpiData.ultimaCompraDate, 'dd/MM/yyyy', { locale: ptBR })
        : 'Nunca',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      icon: TrendingUp,
      label: 'OS Ativas',
      value: kpiData?.osAtivas || 0,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    },
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
          {kpi.subLabel && <p className="text-xs text-muted-foreground">{kpi.subLabel}</p>}
          {kpi.alert && <span className="text-xs text-red-600 font-medium">Inadimplente</span>}
        </Card>
      ))}
    </div>
  );
});
