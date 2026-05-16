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
    <Card className="border-border/40 shadow-sm overflow-hidden rounded-[2.5rem] relative group">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-destructive transition-all duration-500 group-hover:w-3" />
      <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            Prioridades de Produção
          </CardTitle>
          <Badge variant="destructive" className="px-3 py-1 font-black animate-pulse">
            {items.length} ALERTA(S)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {overdueItems.length > 0 && (
            <div className="bg-destructive/[0.02]">
              <div className="px-8 py-3 bg-destructive/5 border-y border-destructive/10 flex items-center justify-between">
                <p className="text-[10px] font-black text-destructive uppercase tracking-widest flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  Prazos Expirados ({overdueItems.length})
                </p>
              </div>
              {overdueItems.slice(0, 5).map(os => (
                <Link 
                  key={os.id} 
                  to={`/ordens-servico/${os.id}`}
                  className="flex items-center justify-between p-8 hover:bg-destructive/[0.04] transition-all group/item"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-foreground group-hover/item:text-destructive transition-colors tracking-tight">
                        OS #{String(os.os_number).padStart(4, '0')}
                      </span>
                      <span className="text-[10px] font-black bg-destructive text-white px-2 py-0.5 rounded-md uppercase tracking-tighter">
                        {os.daysOverdue}D ATRASO
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-sm text-muted-foreground font-bold tracking-tight">
                        {os.customer_name}
                      </p>
                      {os.current_stage && (
                        <div className="flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          <span className="text-xs font-black text-primary/80 uppercase tracking-widest">
                            {stageLabels[os.current_stage] || os.current_stage}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-destructive/10 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all shadow-sm">
                    <ArrowRight className="h-5 w-5 text-destructive" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {todayItems.length > 0 && (
            <div>
              <div className="px-8 py-3 bg-amber-500/5 border-y border-amber-500/10 flex items-center justify-between">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Vencimento Hoje ({todayItems.length})
                </p>
              </div>
              {todayItems.slice(0, 5).map(os => (
                <Link 
                  key={os.id} 
                  to={`/ordens-servico/${os.id}`}
                  className="flex items-center justify-between p-8 hover:bg-amber-500/[0.04] transition-all group/item"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-foreground group-hover/item:text-amber-600 transition-colors tracking-tight">
                        OS #{String(os.os_number).padStart(4, '0')}
                      </span>
                      <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-md uppercase tracking-tighter">
                        HOJE
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-sm text-muted-foreground font-bold tracking-tight">
                        {os.customer_name}
                      </p>
                      {os.current_stage && (
                        <div className="flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          <span className="text-xs font-black text-amber-600 uppercase tracking-widest">
                            {stageLabels[os.current_stage] || os.current_stage}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all shadow-sm">
                    <ArrowRight className="h-5 w-5 text-amber-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-muted/30 border-t border-border/40">
          <Button asChild variant="outline" className="w-full h-12 rounded-2xl border-2 font-black uppercase tracking-tighter text-xs group">
            <Link to="/ordens-servico">
              Visualizar Painel de Produção
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
