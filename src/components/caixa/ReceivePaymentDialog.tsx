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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receber Pagamento
          </DialogTitle>
          <DialogDescription>
            Registre o recebimento desta parcela/conta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do Cliente */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{receivable.customer_name}</p>
              <p className="text-sm text-muted-foreground">{receivable.description}</p>
            </div>
          </div>

          {/* Vencimento */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Vencimento</p>
              <p className="font-medium">
                {format(new Date(receivable.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                Atrasado
              </Badge>
            )}
          </div>

          {/* Resumo do Valor */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor total:</span>
              <span className="font-medium">{formatCurrency(receivable.total_amount)}</span>
            </div>
            
            {(receivable.paid_amount || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Já pago:
                </span>
                <span className="font-medium text-green-600">
                  {formatCurrency(receivable.paid_amount || 0)}
                </span>
              </div>
            )}
            
            <Separator className="my-2" />
            
            <div className="flex justify-between">
              <span className="font-medium">Saldo pendente:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>

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
              {/* Pagamento parcial */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="partial-payment"
                  checked={isPartialPayment}
                  onChange={(e) => setIsPartialPayment(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="partial-payment" className="text-sm cursor-pointer">
                  Pagamento parcial
                </Label>
              </div>

              {isPartialPayment && (
                <div>
                  <Label className="text-sm font-medium">Valor a receber</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1"
                  />
                  {amountToPay > remainingAmount && (
                    <p className="text-xs text-destructive mt-1">
                      Valor não pode ser maior que o saldo pendente
                    </p>
                  )}
                </div>
              )}

              {/* Forma de Pagamento */}
              <div>
                <Label className="text-sm font-medium">Forma de Pagamento</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dinheiro" id="pay-dinheiro" />
                    <Label htmlFor="pay-dinheiro" className="flex items-center gap-1 cursor-pointer">
                      <DollarSign className="w-4 h-4" />
                      Dinheiro
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cartao" id="pay-cartao" />
                    <Label htmlFor="pay-cartao" className="flex items-center gap-1 cursor-pointer">
                      <CreditCard className="w-4 h-4" />
                      Cartão
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pay-pix" />
                    <Label htmlFor="pay-pix" className="flex items-center gap-1 cursor-pointer">
                      <Smartphone className="w-4 h-4" />
                      Pix
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Valor a receber */}
              {!isPartialPayment && (
                <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium">Valor a receber</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(amountToPay)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={receivePaymentMutation.isPending}
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
