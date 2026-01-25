import { Link } from 'react-router-dom';
import { Package, Truck, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CACHE_TIMES } from '@/lib/queryConfig';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingPurchaseSummary {
  pending: number;
  ordered: number;
  partial: number;
  totalItems: number;
  oldestOrder: string | null;
  urgentOrders: number;
}

export function PendingPurchasesAlert() {
  const { currentCompany } = useAuth();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['pending-purchases-summary', currentCompany?.id],
    queryFn: async (): Promise<PendingPurchaseSummary> => {
      if (!currentCompany?.id) {
        return { pending: 0, ordered: 0, partial: 0, totalItems: 0, oldestOrder: null, urgentOrders: 0 };
      }

      // Get counts by status
      const { data: orders, error } = await supabase
        .from('purchase_orders')
        .select('id, status, created_at, expected_delivery')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'ordered', 'partial']);

      if (error) throw error;

      const pending = orders?.filter(o => o.status === 'pending').length || 0;
      const ordered = orders?.filter(o => o.status === 'ordered').length || 0;
      const partial = orders?.filter(o => o.status === 'partial').length || 0;

      // Find oldest order
      const oldestOrder = orders?.length 
        ? orders.reduce((oldest, current) => 
            new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest
          ).created_at
        : null;

      // Count urgent orders (expected delivery today or overdue)
      const today = new Date().toISOString().split('T')[0];
      const urgentOrders = orders?.filter(o => 
        o.expected_delivery && o.expected_delivery <= today && o.status !== 'received'
      ).length || 0;

      // Get total items pending
      const orderIds = orders?.map(o => o.id) || [];
      let totalItems = 0;
      
      if (orderIds.length > 0) {
        const { count } = await supabase
          .from('purchase_order_items')
          .select('*', { count: 'exact', head: true })
          .in('purchase_order_id', orderIds)
          .eq('status', 'pending');
        
        totalItems = count || 0;
      }

      return { pending, ordered, partial, totalItems, oldestOrder, urgentOrders };
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
    refetchInterval: 60000, // Refresh every minute
  });

  // Don't render if no pending purchases
  if (isLoading || !summary || (summary.pending === 0 && summary.ordered === 0 && summary.partial === 0)) {
    return null;
  }

  const totalOrders = summary.pending + summary.ordered + summary.partial;
  const hasUrgent = summary.urgentOrders > 0;

  return (
    <Card className={hasUrgent ? 'border-destructive/50 bg-destructive/5' : 'border-blue-500/50 bg-blue-500/5'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {hasUrgent ? (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            ) : (
              <Package className="w-5 h-5 text-blue-500" />
            )}
            <span className={hasUrgent ? 'text-destructive' : 'text-blue-700 dark:text-blue-400'}>
              Pedidos de Compra Pendentes
            </span>
            <Badge variant={hasUrgent ? 'destructive' : 'secondary'} className="ml-2">
              {totalOrders}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/pedidos-compra" className="gap-1 text-muted-foreground hover:text-foreground">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Aguardando envio */}
          {summary.pending > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.pending}</p>
                <p className="text-xs text-muted-foreground">Aguardando envio</p>
              </div>
            </div>
          )}

          {/* Em trânsito */}
          {summary.ordered > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.ordered}</p>
                <p className="text-xs text-muted-foreground">Em trânsito</p>
              </div>
            </div>
          )}

          {/* Recebimento parcial */}
          {summary.partial > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.partial}</p>
                <p className="text-xs text-muted-foreground">Recebimento parcial</p>
              </div>
            </div>
          )}

          {/* Itens pendentes */}
          {summary.totalItems > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.totalItems}</p>
                <p className="text-xs text-muted-foreground">Itens aguardando</p>
              </div>
            </div>
          )}
        </div>

        {/* Alert for urgent orders */}
        {hasUrgent && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {summary.urgentOrders} pedido{summary.urgentOrders > 1 ? 's' : ''} com entrega atrasada ou para hoje
              </span>
            </div>
          </div>
        )}

        {/* Oldest order info */}
        {summary.oldestOrder && !hasUrgent && (
          <p className="mt-3 text-xs text-muted-foreground">
            Pedido mais antigo: {formatDistanceToNow(new Date(summary.oldestOrder), { 
              addSuffix: true, 
              locale: ptBR 
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
