import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * Interface para parâmetros de entrada no orçamento
 */
export interface RegisterQuoteEntryParams {
  quoteId: string;
  ordemServicoId?: string;
  amount: number;
  paymentMethod: 'dinheiro' | 'cartao' | 'pix';
  cashRegisterId: string;
  customerName: string;
  description?: string;
}

/**
 * Interface para parâmetros de faturamento do orçamento
 */
export interface BillQuoteParams {
  quoteId: string;
  ordemServicoId: string;
  cashRegisterId: string;
  paymentMethod: 'dinheiro' | 'cartao' | 'pix';
  totalAmount: number;
  customerName: string;
}

/**
 * Resultado do faturamento
 */
export interface BillQuoteResult {
  saleId: string;
  totalAmount: number;
  entryAmount: number;
  billedAmount: number;
  transferredMovements: number;
}

/**
 * Hook para gerenciamento financeiro de orçamentos
 * 
 * Regras de arquitetura:
 * - Toda movimentação tem: tipo, origem, idReferencia, valor, data, formaPagamento
 * - Entradas no orçamento usam origem='orcamento' e idReferencia=quote_id
 * - Ao faturar, transferir vínculo para origem='venda' e idReferencia=sale_id
 */
export function useQuoteFinancial() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  /**
   * FLUXO 1: Registrar entrada no orçamento
   * 
   * Cria movimentação no caixa com:
   * - tipo: "entrada"
   * - origem: "orcamento"
   * - idReferencia: quote_id (via quote_id column)
   */
  const registerQuoteEntryMutation = useMutation({
    mutationFn: async (params: RegisterQuoteEntryParams) => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuário não encontrado');
      }

      const {
        quoteId,
        ordemServicoId,
        amount,
        paymentMethod,
        cashRegisterId,
        customerName,
        description,
      } = params;

      // 1. Criar movimento de caixa vinculado ao ORÇAMENTO
      const { data: cashMovement, error: movementError } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: cashRegisterId,
          company_id: currentCompany.id,
          type: 'entrada',
          category: 'entrada_orcamento',
          amount: amount,
          description: description || `Entrada de orçamento - ${customerName}`,
          payment_method: paymentMethod,
          created_by: user.id,
          // Vínculos obrigatórios
          origem: 'orcamento',
          // Quote ID será usado para vincular - nota: precisamos adicionar essa coluna
        })
        .select('id')
        .single();

      if (movementError) throw movementError;

      // 2. Criar/atualizar quote_deposit
      const { data: deposit, error: depositError } = await supabase
        .from('quote_deposits')
        .insert({
          company_id: currentCompany.id,
          quote_id: quoteId,
          ordem_servico_id: ordemServicoId,
          customer_name: customerName,
          amount: amount,
          payment_method: paymentMethod,
          status: 'received',
          received_at: new Date().toISOString(),
          cash_register_id: cashRegisterId,
          cash_movement_id: cashMovement.id,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (depositError) throw depositError;

      // 3. Criar accounts_receivable para rastreamento
      await supabase
        .from('accounts_receivable')
        .insert({
          company_id: currentCompany.id,
          quote_id: quoteId,
          ordem_servico_id: ordemServicoId,
          customer_name: customerName,
          description: description || `Entrada - ${customerName}`,
          total_amount: amount,
          paid_amount: amount,
          status: 'paid',
          due_date: format(new Date(), 'yyyy-MM-dd'),
          paid_date: format(new Date(), 'yyyy-MM-dd'),
          receivable_type: 'entrada_orcamento',
          payment_method: paymentMethod,
          installment_number: 0,
          total_installments: 0,
          created_by: user.id,
        });

      // 4. Atualizar OS se existir
      if (ordemServicoId) {
        const { data: currentOS } = await supabase
          .from('ordens_servico')
          .select('paid_amount, pending_amount, total_amount')
          .eq('id', ordemServicoId)
          .single();

        if (currentOS) {
          const newPaidAmount = (currentOS.paid_amount || 0) + amount;
          const newPendingAmount = Math.max(0, (currentOS.total_amount || 0) - newPaidAmount);

          await supabase
            .from('ordens_servico')
            .update({
              paid_amount: newPaidAmount,
              pending_amount: newPendingAmount,
            })
            .eq('id', ordemServicoId);
        }
      }

      return {
        cashMovementId: cashMovement.id,
        depositId: deposit.id,
        amount,
      };
    },
    onSuccess: (data) => {
      toast.success('Entrada registrada!', {
        description: `${formatCurrency(data.amount)} vinculado ao orçamento`,
      });
      queryClient.invalidateQueries({ queryKey: ['quote-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
    },
    onError: (error) => {
      console.error('Erro ao registrar entrada:', error);
      toast.error('Erro ao registrar entrada', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  /**
   * FLUXO 2: Faturar orçamento (converter em venda)
   * 
   * Passos:
   * 1. Buscar todas as entradas já pagas (quote_deposits + cash_movements)
   * 2. Criar VENDA com valorRecebido = soma das entradas
   * 3. Transferir vínculo das movimentações: origem='orcamento' → origem='venda'
   * 4. Atualizar status financeiro
   */
  const billQuoteMutation = useMutation({
    mutationFn: async (params: BillQuoteParams) => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuário não encontrado');
      }

      const {
        quoteId,
        ordemServicoId,
        cashRegisterId,
        paymentMethod,
        totalAmount,
        customerName,
      } = params;

      // PASSO 1: Buscar todas as entradas já pagas do orçamento
      const { data: existingDeposits, error: depositsError } = await supabase
        .from('quote_deposits')
        .select('id, amount, cash_movement_id')
        .eq('quote_id', quoteId)
        .eq('status', 'received');

      if (depositsError) throw depositsError;

      // PASSO 2: Somar valor das entradas
      const totalEntryAmount = (existingDeposits || []).reduce(
        (sum, deposit) => sum + Number(deposit.amount),
        0
      );

      // Valor restante a faturar
      const billedAmount = totalAmount - totalEntryAmount;
      
      // Determinar status financeiro
      const getPaymentStatus = () => {
        if (totalEntryAmount >= totalAmount) return 'paid';
        if (totalEntryAmount > 0) return 'partial';
        return 'pending';
      };

      // PASSO 3: Criar a VENDA
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          company_id: currentCompany.id,
          cash_register_id: cashRegisterId,
          customer_name: customerName,
          total_amount: totalAmount,
          subtotal: totalAmount,
          paid_amount: totalEntryAmount, // Entradas já recebidas
          pending_amount: billedAmount,
          payment_method: paymentMethod,
          payment_status: getPaymentStatus(),
          sale_type: billedAmount > 0 ? 'partial' : 'full',
          sold_by: user.id,
          ordem_servico_id: ordemServicoId,
          quote_id: quoteId,
          notes: `Faturamento - Orçamento`,
        })
        .select('id')
        .single();

      if (saleError) throw saleError;

      // PASSO 4: Se há saldo a faturar, criar movimento de caixa para o restante
      if (billedAmount > 0) {
        const { error: movementError } = await supabase
          .from('cash_movements')
          .insert({
            cash_register_id: cashRegisterId,
            company_id: currentCompany.id,
            type: 'entrada',
            category: 'venda',
            amount: billedAmount,
            description: `Faturamento final - ${customerName}`,
            payment_method: paymentMethod,
            sale_id: sale.id,
            created_by: user.id,
            origem: 'venda',
          });

        if (movementError) throw movementError;
      }

      // PASSO 5: Transferir vínculo das movimentações existentes
      // Atualizar cash_movements que eram do orçamento para pertencerem à venda
      let transferredCount = 0;
      for (const deposit of existingDeposits || []) {
        if (deposit.cash_movement_id) {
          const { error: updateError } = await supabase
            .from('cash_movements')
            .update({
              origem: 'venda',
              sale_id: sale.id,
            })
            .eq('id', deposit.cash_movement_id);

          if (!updateError) {
            transferredCount++;
          }
        }
      }

      // PASSO 6: Atualizar quote_deposits para 'billed'
      if (existingDeposits && existingDeposits.length > 0) {
        await supabase
          .from('quote_deposits')
          .update({ status: 'billed' })
          .eq('quote_id', quoteId)
          .eq('status', 'received');
      }

      // PASSO 7: Atualizar accounts_receivable vinculados
      await supabase
        .from('accounts_receivable')
        .update({ sale_id: sale.id })
        .eq('quote_id', quoteId);

      // PASSO 8: Atualizar ordens_servico
      await supabase
        .from('ordens_servico')
        .update({
          sale_id: sale.id,
          paid_amount: totalEntryAmount + (billedAmount > 0 ? billedAmount : 0),
          pending_amount: 0,
          status: 'completed',
        })
        .eq('id', ordemServicoId);

      // PASSO 9: Atualizar quote
      await supabase
        .from('quotes')
        .update({
          status: 'completed',
          deposit_status: 'billed',
        })
        .eq('id', quoteId);

      return {
        saleId: sale.id,
        totalAmount,
        entryAmount: totalEntryAmount,
        billedAmount,
        transferredMovements: transferredCount,
      } as BillQuoteResult;
    },
    onSuccess: (data) => {
      toast.success('Orçamento faturado!', {
        description: data.entryAmount > 0
          ? `Entrada de ${formatCurrency(data.entryAmount)} reconhecida. Faturado: ${formatCurrency(data.billedAmount)}`
          : `Venda de ${formatCurrency(data.totalAmount)} registrada`,
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
    },
    onError: (error) => {
      console.error('Erro ao faturar orçamento:', error);
      toast.error('Erro ao faturar', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  /**
   * Busca resumo de entradas de um orçamento
   */
  const useQuoteEntrySummary = (quoteId: string | undefined) => {
    return useQuery({
      queryKey: ['quote-entry-summary', quoteId],
      queryFn: async () => {
        if (!quoteId) return null;

        // Buscar quote_deposits recebidos
        const { data: deposits, error: depositsError } = await supabase
          .from('quote_deposits')
          .select('id, amount, payment_method, received_at, status')
          .eq('quote_id', quoteId)
          .in('status', ['received', 'billed']);

        if (depositsError) throw depositsError;

        // Calcular totais
        const totalReceived = (deposits || [])
          .filter(d => d.status === 'received' || d.status === 'billed')
          .reduce((sum, d) => sum + Number(d.amount), 0);

        return {
          deposits: deposits || [],
          totalReceived,
          hasEntries: totalReceived > 0,
        };
      },
      enabled: !!quoteId,
    });
  };

  return {
    // Registrar entrada no orçamento
    registerQuoteEntry: registerQuoteEntryMutation.mutate,
    registerQuoteEntryAsync: registerQuoteEntryMutation.mutateAsync,
    isRegisteringEntry: registerQuoteEntryMutation.isPending,

    // Faturar orçamento
    billQuote: billQuoteMutation.mutate,
    billQuoteAsync: billQuoteMutation.mutateAsync,
    isBilling: billQuoteMutation.isPending,

    // Hooks de consulta
    useQuoteEntrySummary,

    // Utilitários
    formatCurrency,
  };
}
