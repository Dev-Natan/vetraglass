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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Cobranças do Dia
          </CardTitle>
          <Badge variant="secondary" className="text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
            {formatCurrency(total)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="space-y-2 flex-1 max-h-[200px] overflow-y-auto">
          {overdueItems.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-destructive mb-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Atrasadas ({overdueItems.length})
              </p>
              {overdueItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 px-2 rounded bg-destructive/5 border border-destructive/20 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.customer_name}</p>
                    <p className="text-xs text-destructive">{item.daysOverdue} dia(s) atraso</p>
                  </div>
                  <span className="text-sm font-semibold text-destructive shrink-0 ml-2">
                    {formatCurrency(item.remaining)}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {todayItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Vencendo Hoje ({todayItems.length})
              </p>
              {todayItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 border mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0 ml-2">
                    {formatCurrency(item.remaining)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="pt-3 mt-auto border-t">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/financeiro?tab=receber">
              Gerenciar Cobranças
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
