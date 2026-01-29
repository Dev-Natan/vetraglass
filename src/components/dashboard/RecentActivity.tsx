import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  FileText, 
  ClipboardList,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import type { ActivityItem } from '@/hooks/useDashboardData';

interface RecentActivityProps {
  data?: ActivityItem[];
}

export const RecentActivity = memo(function RecentActivity({ data: activities }: RecentActivityProps) {
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
        return '/caixa-vendas';
      case 'quote':
        return '/orcamentos';
      case 'order':
        return '/ordens-servico';
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

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
});
