import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign,
  CreditCard,
  Smartphone,
  Receipt,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useSalesFinancial, calculateFinancialStatus } from '@/hooks/useSalesFinancial';

interface Receivable {
  id: string;
  customer_name: string;
  description: string;
  total_amount: number;
  paid_amount: number | null;
  installment_number: number;
  total_installments: number;
  due_date: string;
  status: string;
  sale_id?: string | null;
  ordem_servico_id?: string | null;
  quote_id?: string | null;
}

interface ReceivePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: Receivable | null;
  onSuccess?: () => void;
}

export function ReceivePaymentDialog({
  open,
  onOpenChange,
  receivable,
  onSuccess,
}: ReceivePaymentDialogProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPartialPayment, setIsPartialPayment] = useState(false);

  // Buscar caixa aberto
  const { data: openCashRegister, isLoading: isLoadingCash } = useQuery({
    queryKey: ['open-cash-register', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('cash_registers')
        .select('id, status')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && open,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const remainingAmount = receivable ? 
    receivable.total_amount - (receivable.paid_amount || 0) : 0;

  const amountToPay = isPartialPayment 
    ? parseFloat(paymentAmount.replace(',', '.')) || 0
    : remainingAmount;

  const receivePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!receivable || !currentCompany?.id || !user?.id || !openCashRegister?.id) {
        throw new Error('Dados incompletos');
      }

      // Validar se a venda vinculada está cancelada
      if (receivable.sale_id) {
        const { data: saleData } = await supabase
          .from('sales')
          .select('payment_status')
          .eq('id', receivable.sale_id)
          .single();
        
        if (saleData?.payment_status === 'cancelled') {
          throw new Error('Esta venda está cancelada e não pode receber novos pagamentos.');
        }
      }

      if (amountToPay <= 0) {
        throw new Error('Valor deve ser maior que zero');
      }

      if (amountToPay > remainingAmount) {
        throw new Error('Valor não pode ser maior que o saldo pendente');
      }

      const description = receivable.installment_number > 0
        ? `Parcela ${receivable.installment_number}/${receivable.total_installments} - ${receivable.customer_name}`
        : `Pagamento - ${receivable.customer_name}`;

      // 1. Criar movimento de caixa (entrada real de dinheiro)
      const { data: cashMovement, error: movementError } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: openCashRegister.id,
          company_id: currentCompany.id,
          type: 'entrada',
          category: 'recebimento_parcela',
          amount: amountToPay,
          description: description,
          payment_method: paymentMethod,
          receivable_id: receivable.id,
          sale_id: receivable.sale_id,
          created_by: user.id,
          origem: 'conta_receber',
        })
        .select('id')
        .single();

      if (movementError) throw movementError;

      // 2. Atualizar a conta a receber
      const newPaidAmount = (receivable.paid_amount || 0) + amountToPay;
      const isFullyPaid = newPaidAmount >= receivable.total_amount;

      const { error: receivableUpdateError } = await supabase
        .from('accounts_receivable')
        .update({
          paid_amount: newPaidAmount,
          status: isFullyPaid ? 'paid' : 'partial',
          paid_date: isFullyPaid ? format(new Date(), 'yyyy-MM-dd') : null,
          payment_method: paymentMethod,
        })
        .eq('id', receivable.id);

      if (receivableUpdateError) throw receivableUpdateError;

      // 3. Atualizar venda vinculada (se existir)
      if (receivable.sale_id) {
        const { data: sale, error: saleSelectError } = await supabase
          .from('sales')
          .select('total_amount, paid_amount')
          .eq('id', receivable.sale_id)
          .single();

        if (!saleSelectError && sale) {
          const saleNewPaidAmount = (sale.paid_amount || 0) + amountToPay;
          const saleNewPendingAmount = Math.max(0, sale.total_amount - saleNewPaidAmount);
          const status = calculateFinancialStatus(saleNewPaidAmount, sale.total_amount);
          const paymentStatus = status === 'PAGO' ? 'paid' : status === 'PARCIAL' ? 'partial' : 'pending';

          await supabase
            .from('sales')
            .update({
              paid_amount: saleNewPaidAmount,
              pending_amount: saleNewPendingAmount,
              payment_status: paymentStatus,
            })
            .eq('id', receivable.sale_id);
        }
      }

      // 4. Atualizar OS vinculada (se existir)
      if (receivable.ordem_servico_id) {
        const { data: os, error: osSelectError } = await supabase
          .from('ordens_servico')
          .select('paid_amount, pending_amount, total_amount')
          .eq('id', receivable.ordem_servico_id)
          .single();

        if (!osSelectError && os) {
          const osNewPaidAmount = (os.paid_amount || 0) + amountToPay;
          const osNewPendingAmount = Math.max(0, (os.pending_amount || os.total_amount) - amountToPay);

          await supabase
            .from('ordens_servico')
            .update({
              paid_amount: osNewPaidAmount,
              pending_amount: osNewPendingAmount,
            })
            .eq('id', receivable.ordem_servico_id);
        }
      }

      return {
        cashMovementId: cashMovement.id,
        amountPaid: amountToPay,
        isFullyPaid,
      };
    },
    onSuccess: (data) => {
      toast.success('Pagamento registrado!', {
        description: data.isFullyPaid 
          ? `${formatCurrency(data.amountPaid)} recebido - Quitado`
          : `${formatCurrency(data.amountPaid)} recebido - Pagamento parcial`,
      });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  const handleConfirm = () => {
    receivePaymentMutation.mutate();
  };

  const isCaixaAberto = !!openCashRegister?.id;
  const isOverdue = receivable && new Date(receivable.due_date) < new Date();

  if (!receivable) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-base font-semibold leading-tight">
                Receber Pagamento
              </DialogTitle>
              <DialogDescription className="text-xs">
                Registre o recebimento desta parcela/conta
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">

          {/* Cliente / OS */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/60">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{receivable.customer_name}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                {receivable.description}
              </p>
            </div>
          </div>

          {/* Vencimento */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <div className="flex items-center gap-3 min-w-0">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">
                  Vencimento
                </p>
                <p className="text-sm font-medium truncate">
                  {format(new Date(receivable.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-tight shrink-0">
                Atrasado
              </Badge>
            )}
          </div>

          {/* Resumo: Valor total + Saldo pendente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border/60">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Valor total</p>
              <p className="text-sm font-semibold">{formatCurrency(receivable.total_amount)}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-[10px] uppercase font-bold text-primary mb-1">Saldo pendente</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(remainingAmount)}</p>
            </div>
          </div>

          {/* Já pago (se houver) */}
          {(receivable.paid_amount || 0) > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Já pago
              </span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(receivable.paid_amount || 0)}
              </span>
            </div>
          )}

          {/* Alerta se caixa fechado */}
          {!isCaixaAberto && !isLoadingCash && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum caixa aberto. Abra o caixa para receber pagamentos.
              </AlertDescription>
            </Alert>
          )}

          {/* Opções de pagamento */}
          {isCaixaAberto && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="partial-payment"
                  checked={isPartialPayment}
                  onChange={(e) => setIsPartialPayment(e.target.checked)}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                />
                <Label htmlFor="partial-payment" className="text-sm font-medium cursor-pointer">
                  Pagamento parcial
                </Label>
              </div>

              {isPartialPayment && (
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Valor a receber
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1.5"
                  />
                  {amountToPay > remainingAmount && (
                    <p className="text-xs text-destructive mt-1">
                      Valor não pode ser maior que o saldo pendente
                    </p>
                  )}
                </div>
              )}

              {/* Forma de Pagamento - segmented */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Forma de Pagamento
                </Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                  className="grid grid-cols-3 gap-2"
                >
                  {[
                    { value: 'dinheiro', label: 'Dinheiro', Icon: DollarSign },
                    { value: 'cartao', label: 'Cartão', Icon: CreditCard },
                    { value: 'pix', label: 'Pix', Icon: Smartphone },
                  ].map(({ value, label, Icon }) => {
                    const selected = paymentMethod === value;
                    return (
                      <Label
                        key={value}
                        htmlFor={`pay-${value}`}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        <RadioGroupItem value={value} id={`pay-${value}`} className="sr-only" />
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase tracking-tight">
                          {label}
                        </span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Totalizador */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-foreground text-background">
                <span className="text-sm font-medium opacity-70">Valor a receber</span>
                <span className="text-xl font-bold">{formatCurrency(amountToPay)}</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-6 pt-0 bg-muted/30 gap-2 sm:gap-3 flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={receivePaymentMutation.isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              receivePaymentMutation.isPending ||
              !isCaixaAberto ||
              amountToPay <= 0 ||
              amountToPay > remainingAmount
            }
            className="flex-1 shadow-lg shadow-primary/20"
          >
            {receivePaymentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Recebimento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
