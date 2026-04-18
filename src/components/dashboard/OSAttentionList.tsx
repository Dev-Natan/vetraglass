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
      <Card className="border-none shadow-sm overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 group-hover:w-2 transition-all duration-300" />
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            OS em Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          <div className="text-center py-10 bg-emerald-50/30 dark:bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
            <div className="relative inline-block mb-4">
              <CheckCircle className="h-14 w-14 text-emerald-500 animate-bounce" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-4 border-background" />
            </div>
            <p className="text-base font-semibold text-foreground">Excelente trabalho!</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">Todas as ordens de serviço estão rigorosamente no prazo.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdueItems = items.filter(i => i.daysOverdue > 0);
  const todayItems = items.filter(i => i.daysOverdue === 0);

  return (
    <Card className="border-none shadow-sm overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-destructive group-hover:w-2 transition-all duration-300" />
      <CardHeader className="pb-4 px-6 pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            Atenção Necessária
          </CardTitle>
          <Badge variant="destructive" className="px-3 py-1 rounded-full text-xs font-bold animate-pulse">
            {items.length} pendentes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-6">
        {overdueItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <p className="text-sm font-bold text-destructive uppercase tracking-wider">
                Atrasadas ({overdueItems.length})
              </p>
            </div>
            <div className="grid gap-2.5">
              {overdueItems.slice(0, 4).map(os => (
                <Link 
                  key={os.id} 
                  to={`/ordens-servico/${os.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 hover:border-destructive/20 hover:scale-[1.01] transition-all duration-300 group/item"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground group-hover/item:text-destructive transition-colors">
                        OS #{String(os.os_number).padStart(4, '0')}
                      </span>
                      <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                        {os.daysOverdue}D ATRASO
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5 font-medium">
                      {os.customer_name}
                      {os.current_stage && (
                        <span className="flex items-center gap-1.5 mt-1">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          {stageLabels[os.current_stage] || os.current_stage}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all">
                    <ArrowRight className="h-4 w-4 text-destructive" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {todayItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Vencendo Hoje ({todayItems.length})
              </p>
            </div>
            <div className="grid gap-2.5">
              {todayItems.slice(0, 4).map(os => (
                <Link 
                  key={os.id} 
                  to={`/ordens-servico/${os.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 hover:border-amber-500/20 hover:scale-[1.01] transition-all duration-300 group/item"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground">
                        OS #{String(os.os_number).padStart(4, '0')}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                        HOJE
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5 font-medium">
                      {os.customer_name}
                      {os.current_stage && (
                        <span className="flex items-center gap-1.5 mt-1">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          {stageLabels[os.current_stage] || os.current_stage}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all">
                    <ArrowRight className="h-4 w-4 text-amber-600" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Button asChild variant="ghost" size="lg" className="w-full mt-2 rounded-2xl hover:bg-accent text-primary font-bold transition-all hover:gap-3">
          <Link to="/ordens-servico">
            Explorar todas as ordens
            <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});
