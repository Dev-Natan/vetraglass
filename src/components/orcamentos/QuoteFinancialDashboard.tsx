import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  CreditCard,
  Banknote
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface QuoteFinancialDashboardProps {
  quoteId: string;
  ordemServicoId?: string;
  totalAmount: number;
}

interface AccountReceivable {
  id: string;
  description: string;
  total_amount: number;
  paid_amount: number | null;
  status: string;
  due_date: string;
  installment_number: number;
  total_installments: number;
  payment_method: string | null;
  receivable_type: string | null;
}

export function QuoteFinancialDashboard({
  quoteId,
  ordemServicoId,
  totalAmount,
}: QuoteFinancialDashboardProps) {
  // Fetch receivables - can be linked to quote or OS
  const { data: receivables, isLoading } = useQuery({
    queryKey: ['quote-receivables', quoteId, ordemServicoId],
    queryFn: async () => {
      let query = supabase
        .from('accounts_receivable')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (ordemServicoId) {
        query = query.eq('ordem_servico_id', ordemServicoId);
      } else {
        query = query.eq('quote_id', quoteId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as AccountReceivable[];
    },
    enabled: !!quoteId,
  });

  // Fetch entry deposit info from quote_deposits
  const { data: depositInfo } = useQuery({
    queryKey: ['quote-deposit', quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const { data, error } = await supabase
        .from('quote_deposits')
        .select('*')
        .eq('quote_id', quoteId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });

  // Fallback: fetch entry from sales if quote_deposits is empty
  const { data: entrySale } = useQuery({
    queryKey: ['quote-entry-sale', quoteId, ordemServicoId],
    queryFn: async () => {
      if (ordemServicoId) {
        const { data, error } = await supabase
          .from('sales')
          .select('*')
          .eq('ordem_servico_id', ordemServicoId)
          .eq('sale_type', 'partial')
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      return null;
    },
    enabled: !!ordemServicoId && !depositInfo,
  });

  // Combine deposit info: prefer quote_deposits, fallback to sales
  const effectiveDeposit = depositInfo || (entrySale ? {
    amount: entrySale.total_amount,
    payment_method: entrySale.payment_method,
    status: entrySale.payment_status === 'paid' ? 'paid' : 'pending',
  } : null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Calculate paid and pending
  const paidAmount = receivables?.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.total_amount, 0) || 0;
  const depositPaidAmount = effectiveDeposit?.status === 'paid' ? (effectiveDeposit.amount || 0) : 0;
  const totalPaid = paidAmount + depositPaidAmount;
  const pendingAmount = totalAmount - totalPaid;
  const percentPaid = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
  
  // Calculate overdue and upcoming payments
  const today = new Date().toISOString().split('T')[0];
  const overdueReceivables = receivables?.filter(r => r.status === 'pending' && r.due_date < today) || [];
  const totalOverdue = overdueReceivables.reduce((sum, r) => sum + r.total_amount, 0);

  const getPaymentMethodIcon = (method: string | null) => {
    switch (method) {
      case 'pix':
        return <Banknote className="w-3 h-3" />;
      case 'cartao':
        return <CreditCard className="w-3 h-3" />;
      default:
        return <DollarSign className="w-3 h-3" />;
    }
  };

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'cartao': return 'Cartão';
      case 'dinheiro': return 'Dinheiro';
      default: return method || '-';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6 h-24" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-primary mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Total</span>
            </div>
            <div className="text-xl font-bold">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>

        {/* Paid */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-medium">Recebido</span>
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalPaid)}
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className={cn(
          "bg-gradient-to-br border-amber-500/20",
          pendingAmount > 0 
            ? "from-amber-500/10 to-amber-500/5" 
            : "from-muted/50 to-muted/30"
        )}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Pendente</span>
            </div>
            <div className={cn(
              "text-xl font-bold",
              pendingAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )}>
              {formatCurrency(pendingAmount)}
            </div>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className={cn(
          "bg-gradient-to-br border-destructive/20",
          totalOverdue > 0 
            ? "from-destructive/10 to-destructive/5" 
            : "from-muted/50 to-muted/30"
        )}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Vencido</span>
            </div>
            <div className={cn(
              "text-xl font-bold",
              totalOverdue > 0 ? "text-destructive" : "text-muted-foreground"
            )}>
              {formatCurrency(totalOverdue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Progresso de Pagamento
            </span>
            <span className="text-sm font-bold text-primary">{percentPaid.toFixed(0)}%</span>
          </div>
          <Progress value={percentPaid} className="h-2" />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>Pago: {formatCurrency(totalPaid)}</span>
            <span>Restante: {formatCurrency(pendingAmount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Entry Info */}
      {effectiveDeposit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Entrada / Sinal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">{formatCurrency(effectiveDeposit.amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {getPaymentMethodLabel(effectiveDeposit.payment_method)}
                </div>
              </div>
              <Badge variant={effectiveDeposit.status === 'paid' ? 'default' : effectiveDeposit.status === 'pending' ? 'secondary' : 'outline'}>
                {effectiveDeposit.status === 'paid' ? 'Pago' : effectiveDeposit.status === 'pending' ? 'Pendente' : 'Faturado'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receivables List */}
      {receivables && receivables.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Parcelas e Cobranças
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {receivables.map((receivable) => {
              const isOverdue = receivable.status === 'pending' && receivable.due_date < today;
              const isDueToday = isToday(new Date(receivable.due_date));
              
              return (
                <div
                  key={receivable.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    receivable.status === 'paid' 
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                      : isOverdue
                        ? "bg-destructive/5 border-destructive/30"
                        : isDueToday
                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                          : "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      receivable.status === 'paid'
                        ? "bg-emerald-500 text-white"
                        : isOverdue
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {receivable.installment_number}/{receivable.total_installments}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        Parcela {receivable.installment_number}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">
                            VENCIDA
                          </Badge>
                        )}
                        {isDueToday && receivable.status !== 'paid' && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1 bg-amber-500 text-white">
                            HOJE
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "font-bold",
                      receivable.status === 'paid'
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isOverdue
                          ? "text-destructive"
                          : "text-foreground"
                    )}>
                      {formatCurrency(receivable.total_amount)}
                    </div>
                    {receivable.status === 'paid' && receivable.payment_method && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        {getPaymentMethodIcon(receivable.payment_method)}
                        {getPaymentMethodLabel(receivable.payment_method)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {(!receivables || receivables.length === 0) && !effectiveDeposit && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma cobrança registrada ainda</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
