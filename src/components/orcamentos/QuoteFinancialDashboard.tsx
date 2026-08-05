import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  CreditCard,
  Banknote,
  History,
  ArrowDownCircle,
  ArrowUpCircle
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
  // Fetch cash movements (payments and expenses) linked to this quote
  const { data: movements } = useQuery({
    queryKey: ['quote-financial-movements', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!quoteId,
  });

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

  // Buscar entradas: se temos ordem_servico_id, filtrar por ela para não misturar OSes
  const { data: allDeposits } = useQuery({
    queryKey: ['quote-all-deposits', quoteId, ordemServicoId],
    queryFn: async () => {
      if (!quoteId) return [];
      let query = supabase
        .from('quote_deposits')
        .select('*')
        .eq('quote_id', quoteId)
        .in('status', ['received', 'pending', 'billed'])
        .order('created_at', { ascending: true });
      
      // Se temos OS específica, filtrar depósitos apenas dessa OS
      if (ordemServicoId) {
        query = query.eq('ordem_servico_id', ordemServicoId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
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
    enabled: !!ordemServicoId && (!allDeposits || allDeposits.length === 0),
  });

  // Calcular total das entradas
  const totalDepositAmount = (allDeposits || []).reduce((sum, d) => sum + Number(d.amount), 0);
  
  // Combine deposit info: prefer quote_deposits sum, fallback to sales
  const effectiveDeposit = totalDepositAmount > 0 
    ? {
        amount: totalDepositAmount,
        payment_method: allDeposits?.[0]?.payment_method || null,
        status: allDeposits?.some(d => d.status === 'billed') ? 'billed' 
              : allDeposits?.every(d => d.status === 'received') ? 'paid' 
              : 'pending',
        deposits: allDeposits,
      }
    : (entrySale ? {
        amount: entrySale.total_amount,
        payment_method: entrySale.payment_method,
        status: entrySale.payment_status === 'paid' ? 'paid' : 'pending',
        deposits: null,
      } : null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Calcular total pago: somar entradas e parcelas pagas
  // Garantimos que não haja dupla contagem se a entrada estiver tanto em quote_deposits quanto em accounts_receivable
  const paidReceivables = receivables?.filter(r => r.status === 'paid' && r.receivable_type !== 'entrada_orcamento') || [];
  const paidReceivablesAmount = paidReceivables.reduce((sum, r) => sum + (Number(r.paid_amount) || r.total_amount), 0);
  const depositPaidAmount = effectiveDeposit?.status === 'paid' ? (Number(effectiveDeposit.amount) || 0) : 0;
  
  // Somar também movimentos de entrada vinculados (recebimentos parciais diretos via NovoRecebimentoDialog)
  // que salvam quote_id e category='recebimento_parcial'
  const otherMovementsAmount = (movements || [])
    .filter(m => m.type === 'entrada' && (m.category === 'recebimento_parcial' || m.category === 'entrada_orcamento'))
    .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  // O total pago deve ser o maior entre a soma de parcelas/depósitos OU a soma bruta de movimentos de entrada
  // para garantir que nenhum pagamento escape, mesmo se não houver parcela vinculada.
  const totalPaid = Math.max(paidReceivablesAmount + depositPaidAmount, otherMovementsAmount);
  const pendingAmount = Math.max(0, Number((totalAmount - totalPaid).toFixed(2)));
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

      {/* Entry Info - Suporta múltiplas entradas */}
      {effectiveDeposit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Entrada / Sinal
              {effectiveDeposit.deposits && effectiveDeposit.deposits.length > 1 && (
                <Badge variant="secondary" className="text-[10px]">
                  {effectiveDeposit.deposits.length} entradas
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Exibir cada entrada individualmente se houver múltiplas */}
            {effectiveDeposit.deposits && effectiveDeposit.deposits.length > 1 ? (
              <>
                {effectiveDeposit.deposits.map((deposit: any, index: number) => (
                  <div key={deposit.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div>
                      <div className="font-medium text-sm">{formatCurrency(deposit.amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {getPaymentMethodLabel(deposit.payment_method)}
                      </div>
                    </div>
                    <Badge 
                      variant={deposit.status === 'received' ? 'default' : deposit.status === 'pending' ? 'secondary' : 'outline'}
                      className="text-[10px]"
                    >
                      {deposit.status === 'received' ? 'Pago' : deposit.status === 'pending' ? 'Pendente' : 'Faturado'}
                    </Badge>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-bold">Total Entradas:</span>
                  <span className="font-bold text-lg">{formatCurrency(effectiveDeposit.amount)}</span>
                </div>
              </>
            ) : (
              // Exibição simples para uma única entrada
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
            )}
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

      {/* Histórico de Recebimentos e Pagamentos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico de Lançamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Forma</TableHead>
                  <TableHead className="text-right text-xs">Valor</TableHead>
                  <TableHead className="text-right text-xs">Saldo Restante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let runningBalance = totalAmount;
                  if (!movements || movements.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-xs">
                          Nenhum lançamento registrado
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return movements.map((movement) => {
                    const isCredit = movement.type === 'in' || movement.type === 'sale';
                    if (isCredit) {
                      runningBalance -= Number(movement.amount);
                    }
                    
                    return (
                      <TableRow key={movement.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs py-2">
                          {format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            {isCredit ? (
                              <ArrowDownCircle className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <ArrowUpCircle className="w-3 h-3 text-destructive" />
                            )}
                            <span className={cn("text-xs font-medium", isCredit ? "text-emerald-600" : "text-destructive")}>
                              {isCredit ? 'Recebimento' : 'Saída/Custo'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          {getPaymentMethodLabel(movement.payment_method)}
                        </TableCell>
                        <TableCell className={cn("text-right text-xs font-bold py-2", isCredit ? "text-emerald-600" : "text-destructive")}>
                          {isCredit ? '' : '-'}{formatCurrency(Number(movement.amount))}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono py-2">
                          {formatCurrency(Math.max(0, runningBalance))}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Saldo Final Restante:</span>
              <span className="font-bold text-sm text-foreground">{formatCurrency(Math.max(0, pendingAmount))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {(!receivables || receivables.length === 0) && !effectiveDeposit && (!movements || movements.length === 0) && (
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
