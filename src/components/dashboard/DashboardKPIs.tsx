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
import { CACHE_TIMES } from '@/lib/queryConfig';

export function DashboardKPIs() {
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
    ...CACHE_TIMES.DYNAMIC,
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
    ...CACHE_TIMES.DYNAMIC,
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
    ...CACHE_TIMES.DYNAMIC,
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
    ...CACHE_TIMES.DYNAMIC,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Vendas do Mês */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Vendas do Mês
          </CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(salesData?.current || 0)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {growth >= 0 ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
                <TrendingUp className="h-3 w-3" />
                +{growth.toFixed(1)}%
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 gap-1">
                <TrendingDown className="h-3 w-3" />
                {growth.toFixed(1)}%
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">vs mês anterior</span>
          </div>
        </CardContent>
      </Card>

      {/* Vendas de Hoje */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Hoje
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(salesData?.todayValue || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {salesData?.todayCount || 0} vendas realizadas
          </p>
        </CardContent>
      </Card>

      {/* Orçamentos Pendentes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Orçamentos Pendentes
          </CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {quotesData?.pending || 0}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {quotesData?.expiringSoon && quotesData.expiringSoon > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {quotesData.expiringSoon} vencendo
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                {formatCurrency(quotesData?.pendingValue || 0)} em aberto
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OS em Andamento */}
      <Card className={osData?.overdue && osData.overdue > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            OS em Andamento
          </CardTitle>
          <ClipboardList className={`h-4 w-4 ${osData?.overdue && osData.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {osData?.inProgress || 0}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {osData?.overdue && osData.overdue > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {osData.overdue} atrasadas
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                {osData?.pending || 0} pendentes
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Estoque - mostrar apenas se houver alertas */}
      {stockAlerts?.lowStock && stockAlerts.lowStock > 0 && (
        <Card className="col-span-full sm:col-span-2 lg:col-span-1 border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Estoque Baixo
            </CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {stockAlerts.lowStock} itens
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
              Precisam de reposição
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
