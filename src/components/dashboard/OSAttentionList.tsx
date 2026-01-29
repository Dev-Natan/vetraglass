import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface OSAttentionItem {
  id: string;
  os_number: number;
  customer_name: string;
  status: string;
  estimated_end: string;
  daysOverdue: number;
  current_stage?: string | null;
}

interface OSAttentionListProps {
  items?: OSAttentionItem[];
}

const stageLabels: Record<string, string> = {
  cutting: 'Corte',
  assembly: 'Montagem',
  finishing: 'Acabamento',
  quality: 'Qualidade',
  delivery: 'Entrega',
};

export const OSAttentionList = memo(function OSAttentionList({ items }: OSAttentionListProps) {
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            OS em Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-50" />
            <p className="text-sm">Todas as OS estão dentro do prazo!</p>
            <p className="text-xs mt-1">Continue assim 🎉</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdueItems = items.filter(i => i.daysOverdue > 0);
  const todayItems = items.filter(i => i.daysOverdue === 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            OS que Precisam de Atenção
          </CardTitle>
          <Badge variant="destructive">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {overdueItems.length > 0 && (
          <div>
            <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Atrasadas ({overdueItems.length})
            </p>
            <div className="space-y-2">
              {overdueItems.slice(0, 4).map(os => (
                <Link 
                  key={os.id} 
                  to={`/ordens-servico/${os.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">OS #{String(os.os_number).padStart(4, '0')}</span>
                      <Badge variant="destructive" className="text-xs">
                        {os.daysOverdue} dia(s) atraso
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {os.customer_name}
                      {os.current_stage && ` • ${stageLabels[os.current_stage] || os.current_stage}`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {todayItems.length > 0 && (
          <div>
            <p className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Vencendo Hoje ({todayItems.length})
            </p>
            <div className="space-y-2">
              {todayItems.slice(0, 4).map(os => (
                <Link 
                  key={os.id} 
                  to={`/ordens-servico/${os.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">OS #{String(os.os_number).padStart(4, '0')}</span>
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Vence hoje
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {os.customer_name}
                      {os.current_stage && ` • ${stageLabels[os.current_stage] || os.current_stage}`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <Button asChild variant="outline" size="sm" className="w-full mt-2">
          <Link to="/ordens-servico">
            Ver Todas as OS
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});
