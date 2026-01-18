import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Advance {
  id: string;
  amount: number;
  compensated_amount: number;
  pending_amount: number;
  reason: string;
  status: string;
  created_at: string;
}

interface AdvancesSummary {
  total_pending: number;
  count: number;
  advances: Advance[];
}

export function CaixaAdiantamentosCard() {
  const { currentCompany } = useAuth();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['pending-advances', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase.rpc('get_pending_advances_summary', {
        _company_id: currentCompany.id,
      });
      if (error) throw error;
      return data as unknown as AdvancesSummary;
    },
    enabled: !!currentCompany?.id,
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Adiantamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.count === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Adiantamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Nenhum adiantamento pendente
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Adiantamentos Pendentes
          <Badge variant="secondary" className="ml-auto">
            {summary.count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total pendente */}
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium">Total a compensar</span>
          </div>
          <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(summary.total_pending)}
          </span>
        </div>

        {/* Lista de adiantamentos */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {summary.advances.map((advance) => (
            <div
              key={advance.id}
              className="flex items-start justify-between p-2 rounded-lg bg-muted/50 text-sm"
            >
              <div className="space-y-1">
                <p className="font-medium line-clamp-1">{advance.reason}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(new Date(advance.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  {advance.status === 'partial' && (
                    <Badge variant="outline" className="text-xs py-0">
                      Parcial
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-amber-600">
                  {formatCurrency(advance.pending_amount)}
                </p>
                {advance.compensated_amount > 0 && (
                  <p className="text-xs text-green-600">
                    -{formatCurrency(advance.compensated_amount)} pago
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Info sobre compensação */}
        <p className="text-xs text-muted-foreground border-t pt-2">
          Os adiantamentos serão compensados automaticamente nos próximos fechamentos de caixa com excedente.
        </p>
      </CardContent>
    </Card>
  );
}
