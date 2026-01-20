import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DollarSign, CreditCard, Smartphone, Receipt, User, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OrdemServico {
  id: string;
  os_number: number;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  quote_id: string | null;
}

interface FaturarSaldoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServico: OrdemServico;
  onSuccess: () => void;
}

export function FaturarSaldoDialog({
  open,
  onOpenChange,
  ordemServico,
  onSuccess,
}: FaturarSaldoDialogProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');

  // Buscar caixa aberto
  const { data: openCashRegister } = useQuery({
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

  // Buscar entrada já recebida (quote_deposit com status 'received')
  const { data: depositInfo } = useQuery({
    queryKey: ['quote-deposit-info', ordemServico.quote_id],
    queryFn: async () => {
      if (!ordemServico.quote_id) return null;
      
      const { data, error } = await supabase
        .from('quote_deposits')
        .select('id, amount, status, received_at, payment_method')
        .eq('quote_id', ordemServico.quote_id)
        .eq('status', 'received')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!ordemServico.quote_id && open,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const faturarMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuário não encontrado');
      }

      if (!openCashRegister?.id) {
        throw new Error('Nenhum caixa aberto. Abra o caixa para faturar.');
      }

      const saldoRestante = ordemServico.pending_amount;
      
      if (saldoRestante <= 0) {
        throw new Error('Não há saldo pendente para faturar');
      }

      // 1. Criar venda (apenas do saldo restante!)
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          company_id: currentCompany.id,
          cash_register_id: openCashRegister.id,
          customer_name: ordemServico.customer_name,
          total_amount: saldoRestante,
          subtotal: saldoRestante,
          payment_method: paymentMethod,
          sale_type: 'full',
          payment_status: 'completed',
          notes: `Faturamento final - OS #${String(ordemServico.os_number).padStart(4, '0')}`,
          sold_by: user.id,
          ordem_servico_id: ordemServico.id,
          quote_id: ordemServico.quote_id,
        })
        .select('id')
        .single();

      if (saleError) throw saleError;

      // 2. Criar movimento de caixa (tipo VENDA)
      const { error: movementError } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: openCashRegister.id,
          company_id: currentCompany.id,
          type: 'entrada',
          category: 'venda',
          amount: saldoRestante,
          description: `Venda - OS #${String(ordemServico.os_number).padStart(4, '0')} - ${ordemServico.customer_name}`,
          payment_method: paymentMethod,
          sale_id: sale.id,
          created_by: user.id,
        });

      if (movementError) throw movementError;

      // 3. Atualizar quote_deposit para 'billed' (se existir)
      if (depositInfo?.id) {
        const { error: depositError } = await supabase
          .from('quote_deposits')
          .update({ status: 'billed' })
          .eq('id', depositInfo.id);

        if (depositError) {
          console.warn('Erro ao atualizar quote_deposit:', depositError);
        }
      }

      // 4. Atualizar accounts_receivable do saldo como pago
      if (ordemServico.quote_id) {
        const { error: receivableError } = await supabase
          .from('accounts_receivable')
          .update({
            status: 'paid',
            paid_date: new Date().toISOString().split('T')[0],
            paid_amount: saldoRestante,
            payment_method: paymentMethod,
          })
          .eq('quote_id', ordemServico.quote_id)
          .or('receivable_type.eq.saldo_final,receivable_type.eq.installment')
          .eq('status', 'pending');

        if (receivableError) {
          console.warn('Erro ao atualizar accounts_receivable:', receivableError);
        }
      }

      // 5. Atualizar ordens_servico como concluída
      const { error: osError } = await supabase
        .from('ordens_servico')
        .update({
          status: 'completed',
          paid_amount: ordemServico.total_amount,
          pending_amount: 0,
        })
        .eq('id', ordemServico.id);

      if (osError) throw osError;

      // 6. Atualizar quotes como concluído
      if (ordemServico.quote_id) {
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            status: 'completed',
            deposit_status: 'billed',
          })
          .eq('id', ordemServico.quote_id);

        if (quoteError) {
          console.warn('Erro ao atualizar quote:', quoteError);
        }
      }

      return sale;
    },
    onSuccess: () => {
      toast.success('Serviço faturado e concluído!', {
        description: `Venda de ${formatCurrency(ordemServico.pending_amount)} registrada`,
      });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao faturar saldo:', error);
      toast.error('Erro ao faturar saldo', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  const handleConfirm = () => {
    faturarMutation.mutate();
  };

  const isCaixaAberto = !!openCashRegister?.id;
  const entradaRecebida = Number(depositInfo?.amount || 0);
  const totalOrcamento = ordemServico.total_amount;
  const saldoRestante = ordemServico.pending_amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Faturar Saldo - OS #{String(ordemServico.os_number).padStart(4, '0')}
          </DialogTitle>
          <DialogDescription>
            Finalize o faturamento para concluir a ordem de serviço
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do Cliente */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">{ordemServico.customer_name}</p>
          </div>

          {/* Resumo Financeiro */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor total do orçamento:</span>
              <span className="font-medium">{formatCurrency(totalOrcamento)}</span>
            </div>
            
            {entradaRecebida > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Entrada já recebida:
                </span>
                <span className="font-medium text-green-600">
                  {formatCurrency(entradaRecebida)}
                </span>
              </div>
            )}
            
            <Separator className="my-2" />
            
            <div className="flex justify-between">
              <span className="font-medium">Saldo a faturar:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(saldoRestante)}
              </span>
            </div>
          </div>

          {/* Alerta se caixa fechado */}
          {!isCaixaAberto && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum caixa aberto. Abra o caixa para faturar o saldo.
              </AlertDescription>
            </Alert>
          )}

          {/* Forma de Pagamento */}
          {isCaixaAberto && (
            <div>
              <Label className="text-sm font-medium">Forma de Pagamento</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dinheiro" id="fat-dinheiro" />
                  <Label htmlFor="fat-dinheiro" className="flex items-center gap-1 cursor-pointer">
                    <DollarSign className="w-4 h-4" />
                    Dinheiro
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cartao" id="fat-cartao" />
                  <Label htmlFor="fat-cartao" className="flex items-center gap-1 cursor-pointer">
                    <CreditCard className="w-4 h-4" />
                    Cartão
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pix" id="fat-pix" />
                  <Label htmlFor="fat-pix" className="flex items-center gap-1 cursor-pointer">
                    <Smartphone className="w-4 h-4" />
                    Pix
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={faturarMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={faturarMutation.isPending || !isCaixaAberto}
          >
            {faturarMutation.isPending ? 'Processando...' : 'Faturar e Concluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
