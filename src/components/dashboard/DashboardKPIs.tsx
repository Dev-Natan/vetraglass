import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DollarSign, 
  FileText, 
  ClipboardList, 
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { startOfMonth, endOfMonth, startOfDay, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';


export const DashboardKPIs = memo(function DashboardKPIs() {
  const { currentCompany } = useAuth();
  const today = new Date();
  const startMonth = startOfMonth(today);
  const endMonth = endOfMonth(today);
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));

  // Vendas do mês atual
  const { data: salesData } = useQuery({
    queryKey: ['dashboard-sales', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { current: 0, last: 0, todayCount: 0, todayValue: 0 };

      // Mês atual
      const { data: currentMonth } = await supabase
        .from('sales')
        .select('id, total_amount, created_at')
        .eq('company_id', currentCompany.id)
        .neq('payment_status', 'cancelled')
        .gte('created_at', startMonth.toISOString())
        .lte('created_at', endMonth.toISOString());

      // Mês anterior
      const { data: lastMonth } = await supabase
        .from('sales')
        .select('id, total_amount')
        .eq('company_id', currentCompany.id)
        .neq('payment_status', 'cancelled')
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString());

      const currentTotal = (currentMonth || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const lastTotal = (lastMonth || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);

      // Vendas de hoje
      const todayStart = startOfDay(today);
      const todaySales = (currentMonth || []).filter(s => 
        new Date(s.created_at) >= todayStart
      );

      return {
        current: currentTotal,
        last: lastTotal,
        todayCount: todaySales.length,
        todayValue: todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
      };
    },
    enabled: !!currentCompany?.id,
    
  });

  // Orçamentos pendentes
  const { data: quotesData } = useQuery({
    queryKey: ['dashboard-quotes', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { pending: 0, approved: 0, expiringSoon: 0 };

      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, status, valid_until, final_amount')
        .eq('company_id', currentCompany.id)
        .in('status', ['draft', 'sent', 'approved']);

      const pending = (quotes || []).filter(q => q.status === 'draft' || q.status === 'sent');
      const approved = (quotes || []).filter(q => q.status === 'approved');
      
      // Orçamentos que vencem nos próximos 3 dias
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const expiringSoon = pending.filter(q => 
        q.valid_until && new Date(q.valid_until) <= threeDaysFromNow
      );

      return {
        pending: pending.length,
        approved: approved.length,
        pendingValue: pending.reduce((sum, q) => sum + (q.final_amount || 0), 0),
        expiringSoon: expiringSoon.length,
      };
    },
    enabled: !!currentCompany?.id,
    
  });

  // OS em andamento e atrasadas
  const { data: osData } = useQuery({
    queryKey: ['dashboard-os', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { inProgress: 0, overdue: 0, pending: 0 };

      const { data: orders } = await supabase
        .from('ordens_servico')
        .select('id, status, estimated_end')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'in_progress']);

      const todayStr = format(today, 'yyyy-MM-dd');
      const inProgress = (orders || []).filter(o => o.status === 'in_progress');
      const pending = (orders || []).filter(o => o.status === 'pending');
      const overdue = (orders || []).filter(o => 
        o.estimated_end && o.estimated_end < todayStr
      );

      return {
        inProgress: inProgress.length,
        pending: pending.length,
        overdue: overdue.length,
      };
    },
    enabled: !!currentCompany?.id,
    
  });

  // Alertas de estoque baixo
  const { data: stockAlerts } = useQuery({
    queryKey: ['dashboard-stock-alerts', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { lowStock: 0 };

      const { data: stock } = await supabase
        .from('company_stock')
        .select('id, quantity, min_quantity')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      const lowStock = (stock || []).filter(s => 
        s.min_quantity > 0 && s.quantity <= s.min_quantity
      );

      return { lowStock: lowStock.length };
    },
    enabled: !!currentCompany?.id,
    
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const calculateGrowth = (current: number, last: number) => {
    if (last === 0) return current > 0 ? 100 : 0;
    return ((current - last) / last) * 100;
  };

  const growth = salesData ? calculateGrowth(salesData.current, salesData.last) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Vendas do Mês */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vendas do Mês
            </span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(salesData?.current || 0)}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {growth >= 0 ? (
              <>
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-xs text-success font-medium">
                  +{growth.toFixed(0)}%
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 text-destructive" />
                <span className="text-xs text-destructive font-medium">
                  {growth.toFixed(0)}%
                </span>
              </>
            )}
            <span className="text-xs text-muted-foreground">vs anterior</span>
          </div>
        </CardContent>
      </Card>

      {/* Vendas de Hoje */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Hoje
            </span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(salesData?.todayValue || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {salesData?.todayCount || 0} vendas
          </p>
        </CardContent>
      </Card>

      {/* Orçamentos Pendentes */}
      <Card className={quotesData?.expiringSoon && quotesData.expiringSoon > 0 ? 'border-warning/30' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Orçamentos
            </span>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {quotesData?.pending || 0}
          </div>
          <div className="mt-2">
            {quotesData?.expiringSoon && quotesData.expiringSoon > 0 ? (
              <span className="text-xs text-warning font-medium">
                {quotesData.expiringSoon} vencendo em breve
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                pendentes
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OS em Andamento */}
      <Card className={osData?.overdue && osData.overdue > 0 ? 'border-destructive/30' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              OS Ativas
            </span>
            <ClipboardList className={`h-4 w-4 ${osData?.overdue && osData.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </div>
          <div className="text-xl font-bold text-foreground">
            {(osData?.inProgress || 0) + (osData?.pending || 0)}
          </div>
          <div className="mt-2">
            {osData?.overdue && osData.overdue > 0 ? (
              <span className="text-xs text-destructive font-medium">
                {osData.overdue} atrasadas
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {osData?.inProgress || 0} em produção
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Estoque - inline condicional */}
      {stockAlerts?.lowStock && stockAlerts.lowStock > 0 && (
        <Card className="col-span-2 lg:col-span-4 border-warning/30 bg-warning/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Package className="h-5 w-5 text-warning" />
            <span className="text-sm font-medium text-warning-foreground">
              {stockAlerts.lowStock} itens com estoque baixo precisam de reposição
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
