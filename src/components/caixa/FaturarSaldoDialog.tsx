import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DollarSign, CreditCard, Smartphone, Receipt, User, CheckCircle2, AlertCircle, ArrowRight, ClipboardList } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

interface OrdemServico {
  id: string;
  os_number: number;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  quote_id: string | null;
  status?: string;
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

  // FLUXO CORRIGIDO: Buscar TODAS as entradas já pagas do orçamento
  const { data: allDeposits, isLoading: isLoadingDeposits } = useQuery({
    queryKey: ['quote-all-deposits', ordemServico.quote_id],
    queryFn: async () => {
      if (!ordemServico.quote_id) return { deposits: [], totalReceived: 0 };
      
      // Buscar todos os depósitos recebidos
      const { data: deposits, error: depositsError } = await supabase
        .from('quote_deposits')
        .select('id, amount, status, received_at, payment_method')
        .eq('quote_id', ordemServico.quote_id)
        .in('status', ['received', 'pending']);
      
      if (depositsError) throw depositsError;

      // Também buscar vendas parciais já vinculadas
      const { data: partialSales, error: salesError } = await supabase
        .from('sales')
        .select('id, total_amount, paid_amount')
        .eq('ordem_servico_id', ordemServico.id)
        .eq('sale_type', 'partial');

      if (salesError) console.warn('Erro ao buscar vendas parciais:', salesError);

      // Calcular total recebido via depósitos
      const depositsReceived = (deposits || [])
        .filter(d => d.status === 'received')
        .reduce((sum, d) => sum + Number(d.amount), 0);

      // Calcular total recebido via vendas parciais
      const salesReceived = (partialSales || [])
        .reduce((sum, s) => sum + Number(s.paid_amount || s.total_amount), 0);

      // Total efetivamente recebido
      const totalReceived = Math.max(depositsReceived, salesReceived, ordemServico.paid_amount || 0);
      
      return {
        deposits: deposits || [],
        partialSales: partialSales || [],
        totalReceived,
        depositsReceived,
        salesReceived,
      };
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

      // CORREÇÃO: Usar o valor REAL das entradas já recebidas
      const entradaJaRecebida = allDeposits?.totalReceived || 0;
      const totalOrcamento = ordemServico.total_amount;
      const saldoRestante = Math.max(0, totalOrcamento - entradaJaRecebida);
      
      if (saldoRestante <= 0 && entradaJaRecebida <= 0) {
        throw new Error('Não há saldo pendente para faturar');
      }

      // Buscar venda parcial existente vinculada à OS
      const partialSale = allDeposits?.partialSales?.[0];
      
      let saleId: string;

      // FLUXO CORRIGIDO: Atualizar venda parcial existente OU criar nova
      if (partialSale) {
        // 1A. ATUALIZAR venda parcial para venda completa
        const { error: updateSaleError } = await supabase
          .from('sales')
          .update({
            total_amount: totalOrcamento,
            subtotal: totalOrcamento,
            paid_amount: entradaJaRecebida + saldoRestante,
            pending_amount: 0,
            payment_status: 'paid',
            sale_type: 'full',
            notes: `Faturamento completo - OS #${String(ordemServico.os_number).padStart(4, '0')} (atualizado de venda parcial)`,
          })
          .eq('id', partialSale.id);

        if (updateSaleError) throw updateSaleError;
        saleId = partialSale.id;
      } else {
        // 1B. Criar venda nova (caso não exista venda parcial)
        const { data: newSale, error: saleError } = await supabase
          .from('sales')
          .insert({
            company_id: currentCompany.id,
            cash_register_id: openCashRegister.id,
            customer_name: ordemServico.customer_name,
            total_amount: totalOrcamento,
            subtotal: totalOrcamento,
            paid_amount: entradaJaRecebida + saldoRestante,
            pending_amount: 0,
            payment_method: paymentMethod,
            sale_type: 'full',
            payment_status: 'paid',
            notes: `Faturamento completo - OS #${String(ordemServico.os_number).padStart(4, '0')}`,
            sold_by: user.id,
            ordem_servico_id: ordemServico.id,
            quote_id: ordemServico.quote_id,
          })
          .select('id')
          .single();

        if (saleError) throw saleError;
        saleId = newSale.id;
      }

      // 2. Criar movimento de caixa APENAS para o saldo restante (não duplicar entrada)
      if (saldoRestante > 0) {
        const { error: movementError } = await supabase
          .from('cash_movements')
          .insert({
            cash_register_id: openCashRegister.id,
            company_id: currentCompany.id,
            type: 'entrada',
            category: 'venda',
            amount: saldoRestante,
            description: `Saldo final - OS #${String(ordemServico.os_number).padStart(4, '0')} - ${ordemServico.customer_name}`,
            payment_method: paymentMethod,
            sale_id: saleId,
            created_by: user.id,
            origem: 'venda',
          });

        if (movementError) throw movementError;
      }

      // 3. TRANSFERIR VÍNCULO: Atualizar movimentações de entrada para pertencerem à venda
      const receivedDeposits = (allDeposits?.deposits || []).filter(d => d.status === 'received');
      for (const deposit of receivedDeposits) {
        // Buscar cash_movement vinculado ao deposit
        const { data: depositData } = await supabase
          .from('quote_deposits')
          .select('cash_movement_id')
          .eq('id', deposit.id)
          .single();

        if (depositData?.cash_movement_id) {
          // Transferir vínculo: orcamento → venda
          await supabase
            .from('cash_movements')
            .update({
              origem: 'venda',
              sale_id: saleId,
            })
            .eq('id', depositData.cash_movement_id);
        }
      }

      // 4. Atualizar quote_deposits para 'billed'
      if (ordemServico.quote_id) {
        await supabase
          .from('quote_deposits')
          .update({ status: 'billed' })
          .eq('quote_id', ordemServico.quote_id)
          .in('status', ['received', 'pending']);
      }

      // 5. Atualizar accounts_receivable - vincular à venda e marcar como pago
      if (ordemServico.quote_id) {
        // Atualizar entradas
        await supabase
          .from('accounts_receivable')
          .update({
            status: 'paid',
            sale_id: saleId,
            paid_date: new Date().toISOString().split('T')[0],
          })
          .eq('quote_id', ordemServico.quote_id)
          .eq('receivable_type', 'entrada_orcamento');

        // Atualizar parcelas
        await supabase
          .from('accounts_receivable')
          .update({
            status: 'paid',
            paid_date: new Date().toISOString().split('T')[0],
            paid_amount: saldoRestante,
            payment_method: paymentMethod,
            sale_id: saleId,
          })
          .eq('quote_id', ordemServico.quote_id)
          .or('receivable_type.eq.saldo_final,receivable_type.eq.installment')
          .eq('status', 'pending');
      }

      // 6. Atualizar ordens_servico (apenas campos financeiros - status já está 'completed')
      const { error: osError } = await supabase
        .from('ordens_servico')
        .update({
          sale_id: saleId,
          paid_amount: totalOrcamento,
          pending_amount: 0,
        })
        .eq('id', ordemServico.id);

      if (osError) throw osError;

      // 7. Atualizar quotes como concluído
      if (ordemServico.quote_id) {
        await supabase
          .from('quotes')
          .update({
            status: 'completed',
            deposit_status: 'billed',
          })
          .eq('id', ordemServico.quote_id);
      }

      return { 
        saleId, 
        entradaJaRecebida, 
        saldoFaturado: saldoRestante,
        totalFaturado: totalOrcamento,
      };
    },
    onSuccess: (data) => {
      const mensagem = data.entradaJaRecebida > 0
        ? `Entrada de ${formatCurrency(data.entradaJaRecebida)} reconhecida. Saldo de ${formatCurrency(data.saldoFaturado)} faturado.`
        : `Venda de ${formatCurrency(data.totalFaturado)} registrada`;

      toast.success('Serviço faturado e concluído!', {
        description: mensagem,
      });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
  const entradaRecebida = allDeposits?.totalReceived || 0;
  const totalOrcamento = ordemServico.total_amount;
  const saldoRestante = Math.max(0, totalOrcamento - entradaRecebida);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Faturar Saldo - OS #{String(ordemServico.os_number).padStart(4, '0')}
          </DialogTitle>
          <DialogDescription>
            Finalize o faturamento do serviço concluído
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Badge de OS Concluída */}
          <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <ClipboardList className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-400 font-medium">Serviço Concluído</span>
            <Badge variant="outline" className="ml-auto text-green-600 border-green-300">Pronto para Faturar</Badge>
          </div>

          {/* Info do Cliente */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">{ordemServico.customer_name}</p>
          </div>

          {/* Resumo Financeiro Detalhado */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor total do orçamento:</span>
              <span className="font-medium">{formatCurrency(totalOrcamento)}</span>
            </div>
            
            {entradaRecebida > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Entrada(s) já recebida(s):
                </span>
                <span className="font-medium text-green-600">
                  - {formatCurrency(entradaRecebida)}
                </span>
              </div>
            )}
            
            <Separator className="my-2" />
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Saldo a faturar agora:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(saldoRestante)}
              </span>
            </div>

            {entradaRecebida > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs text-green-700 dark:text-green-400">
                <ArrowRight className="h-3 w-3" />
                As entradas anteriores serão vinculadas automaticamente a esta venda
              </div>
            )}
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

          {/* Forma de Pagamento (apenas se há saldo) */}
          {isCaixaAberto && saldoRestante > 0 && (
            <div>
              <Label className="text-sm font-medium">Forma de Pagamento do Saldo</Label>
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

          {/* Caso não haja saldo (já está tudo pago) */}
          {isCaixaAberto && saldoRestante === 0 && entradaRecebida >= totalOrcamento && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                O valor total já foi recebido via entradas. Clique em "Faturar" para finalizar.
              </AlertDescription>
            </Alert>
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
            disabled={faturarMutation.isPending || !isCaixaAberto || isLoadingDeposits}
          >
            {faturarMutation.isPending ? 'Processando...' : 'Faturar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
