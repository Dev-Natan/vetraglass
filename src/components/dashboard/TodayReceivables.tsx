import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';

export interface ReceivableItem {
  id: string;
  customer_name: string;
  description: string;
  total_amount: number;
  paid_amount?: number;
  due_date: string;
  status: string;
}

interface TodayReceivablesProps {
  items?: ReceivableItem[];
}

export const TodayReceivables = memo(function TodayReceivables({ items }: TodayReceivablesProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const processedItems = (items || []).map(item => {
    const dueDate = parseISO(item.due_date);
    const daysOverdue = differenceInDays(today, dueDate);
    const remaining = (item.total_amount || 0) - (item.paid_amount || 0);
    return { ...item, daysOverdue, remaining };
  });

  const overdueItems = processedItems.filter(i => i.daysOverdue > 0);
  const todayItems = processedItems.filter(i => i.daysOverdue === 0);
  const total = processedItems.reduce((sum, i) => sum + i.remaining, 0);

  if (processedItems.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Cobranças do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma cobrança para hoje</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border-border/40 shadow-sm overflow-hidden rounded-[2.5rem]">
      <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            Recebimentos
          </CardTitle>
          <Badge variant="outline" className="rounded-lg border-2 border-emerald-500/20 bg-emerald-500/5 text-emerald-600 font-black">
            {formatCurrency(total)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <div className="flex-1 max-h-[350px] overflow-y-auto divide-y divide-border/40">
          {overdueItems.length > 0 && (
            <div className="bg-destructive/[0.02]">
              <div className="px-8 py-3 bg-destructive/5 border-y border-destructive/10 flex items-center justify-between">
                <p className="text-[10px] font-black text-destructive uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  Pendências Críticas
                </p>
                <Badge variant="destructive" className="h-5 px-1.5 text-[9px] font-black rounded-md">
                  {overdueItems.length}
                </Badge>
              </div>
              {overdueItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between p-8 hover:bg-destructive/[0.04] transition-all group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black truncate text-foreground group-hover:text-destructive transition-colors tracking-tight">{item.customer_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black text-destructive uppercase bg-destructive/10 px-1.5 py-0.5 rounded">
                        {item.daysOverdue} DIA(S) ATRASO
                      </span>
                    </div>
                  </div>
                  <span className="text-lg font-black text-destructive tracking-tighter shrink-0 ml-4">
                    {formatCurrency(item.remaining)}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {todayItems.length > 0 && (
            <div>
              <div className="px-8 py-3 bg-muted/30 border-y border-border/40 flex items-center justify-between">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Previsão para Hoje
                </p>
                <Badge variant="secondary" className="h-5 px-1.5 text-[9px] font-black rounded-md">
                  {todayItems.length}
                </Badge>
              </div>
              {todayItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between p-8 hover:bg-emerald-500/[0.04] transition-all group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black truncate text-foreground group-hover:text-emerald-600 transition-colors tracking-tight">{item.customer_name}</p>
                    <p className="text-xs text-muted-foreground/60 truncate mt-1 font-bold">{item.description}</p>
                  </div>
                  <span className="text-lg font-black text-foreground tracking-tighter shrink-0 ml-4 group-hover:text-emerald-600 transition-colors">
                    {formatCurrency(item.remaining)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-muted/30 border-t border-border/40 mt-auto">
          <Button asChild variant="outline" className="w-full h-12 rounded-2xl border-2 font-black uppercase tracking-tighter text-xs group">
            <Link to="/financeiro?tab=receber">
              Gerenciar Fluxo Financeiro
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
