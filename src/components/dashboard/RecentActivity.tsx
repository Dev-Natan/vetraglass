import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  FileText, 
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { CACHE_TIMES } from '@/lib/queryConfig';

interface ActivityItem {
  id: string;
  type: 'sale' | 'quote' | 'order';
  title: string;
  subtitle: string;
  status: string;
  value: number;
  timestamp: string;
}

export function RecentActivity() {
  const { currentCompany } = useAuth();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['dashboard-recent-activity', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const items: ActivityItem[] = [];

      // Últimas vendas
      const { data: sales } = await supabase
        .from('sales')
        .select('id, sale_number, customer_name, total_amount, payment_status, created_at')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(3);

      (sales || []).forEach(s => {
        items.push({
          id: s.id,
          type: 'sale',
          title: `Venda #${String(s.sale_number).padStart(4, '0')}`,
          subtitle: s.customer_name || 'Cliente não informado',
          status: s.payment_status,
          value: s.total_amount,
          timestamp: s.created_at,
        });
      });

      // Últimos orçamentos
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_name, final_amount, status, created_at')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(3);

      (quotes || []).forEach(q => {
        items.push({
          id: q.id,
          type: 'quote',
          title: `Orçamento #${String(q.quote_number).padStart(4, '0')}`,
          subtitle: q.customer_name,
          status: q.status,
          value: q.final_amount,
          timestamp: q.created_at,
        });
      });

      // Últimas OS
      const { data: orders } = await supabase
        .from('ordens_servico')
        .select('id, os_number, customer_name, total_amount, status, created_at')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(3);

      (orders || []).forEach(o => {
        items.push({
          id: o.id,
          type: 'order',
          title: `OS #${String(o.os_number).padStart(4, '0')}`,
          subtitle: o.customer_name,
          status: o.status,
          value: o.total_amount,
          timestamp: o.created_at,
        });
      });

      // Ordenar por data mais recente
      return items.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 6);
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'sale':
        return ShoppingCart;
      case 'quote':
        return FileText;
      case 'order':
        return ClipboardList;
    }
  };

  const getStatusBadge = (type: ActivityItem['type'], status: string) => {
    if (type === 'sale') {
      if (status === 'paid') return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Pago</Badge>;
      if (status === 'cancelled') return <Badge variant="destructive">Cancelado</Badge>;
      return <Badge variant="secondary">Pendente</Badge>;
    }
    if (type === 'quote') {
      if (status === 'approved') return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprovado</Badge>;
      if (status === 'rejected') return <Badge variant="destructive">Rejeitado</Badge>;
      return <Badge variant="secondary">Pendente</Badge>;
    }
    if (type === 'order') {
      if (status === 'completed') return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Concluído</Badge>;
      if (status === 'in_progress') return <Badge>Em andamento</Badge>;
      if (status === 'cancelled') return <Badge variant="destructive">Cancelado</Badge>;
      return <Badge variant="secondary">Pendente</Badge>;
    }
    return null;
  };

  const getLink = (type: ActivityItem['type']) => {
    switch (type) {
      case 'sale':
        return '/vendas';
      case 'quote':
        return '/orcamentos';
      case 'order':
        return '/ordens-servico';
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma atividade recente
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = getIcon(activity.type);
              return (
                <Link 
                  key={`${activity.type}-${activity.id}`}
                  to={getLink(activity.type)}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{activity.title}</span>
                      {getStatusBadge(activity.type, activity.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{activity.subtitle}</span>
                      <span>•</span>
                      <span className="shrink-0">
                        {formatDistanceToNow(new Date(activity.timestamp), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                  </div>
                  <span className="font-medium text-sm shrink-0">
                    {formatCurrency(activity.value)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
