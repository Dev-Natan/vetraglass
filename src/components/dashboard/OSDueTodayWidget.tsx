import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, AlertTriangle, CheckCircle2, ArrowRight, Factory } from 'lucide-react';
import type { OSItem } from '@/hooks/useDashboardData';

interface OSDueTodayWidgetProps {
  data?: OSItem[];
}

export const OSDueTodayWidget = memo(function OSDueTodayWidget({ data: osList }: OSDueTodayWidgetProps) {
  const navigate = useNavigate();

  const overdueCount = osList?.filter(os => os.daysOverdue > 0).length || 0;
  const dueTodayCount = osList?.filter(os => os.daysOverdue === 0).length || 0;

  const getStatusBadge = (os: OSItem) => {
    if (os.daysOverdue > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          {os.daysOverdue} dia{os.daysOverdue > 1 ? 's' : ''} atrasada
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
        Vence hoje
      </Badge>
    );
  };

  if (!osList || osList.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Prazos de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Tudo em dia!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhuma OS vencendo ou atrasada
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={overdueCount > 0 ? 'border-red-500/30' : 'border-amber-500/30'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {overdueCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <Clock className="h-4 w-4 text-amber-500" />
            )}
            Prazos Críticos
            <div className="flex gap-1 ml-1">
              {overdueCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
                </Badge>
              )}
              {dueTodayCount > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  {dueTodayCount} hoje
                </Badge>
              )}
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="/ordens-servico" className="text-xs gap-1">
              Ver todas <ArrowRight className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[220px] pr-3">
          <div className="space-y-2">
            {osList.map((os) => (
              <button
                key={os.id}
                onClick={() => navigate(`/ordens-servico/${os.id}`)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  os.daysOverdue > 0
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    os.daysOverdue > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-100 dark:bg-amber-900/50'
                  }`}>
                    <Factory className={`h-4 w-4 ${
                      os.daysOverdue > 0 ? 'text-red-600' : 'text-amber-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">
                        OS #{String(os.os_number).padStart(4, '0')}
                      </span>
                      {getStatusBadge(os)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {os.customer_name}
                    </p>
                    {os.current_stage && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {os.current_stage}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});
