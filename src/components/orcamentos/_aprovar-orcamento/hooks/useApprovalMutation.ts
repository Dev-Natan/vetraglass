import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseAmount } from '../utils';
import type { ApprovalQuote, ApprovalQuoteItem, ApprovalFormState } from '../types';

interface Params {
  quote: ApprovalQuote | null;
  items: ApprovalQuoteItem[];
  companyId: string | undefined;
  userId: string | undefined;
  openCashRegister: { id: string } | null | undefined;
  totalOriginal: number;
  valorFinal: number;
  formState: ApprovalFormState;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ApprovalRpcResult {
  success: true;
  idempotent_replay: boolean;
  quote_id: string;
  ordem_servico_id: string;
  os_number: number;
  quote_deposit_id: string | null;
  entry_receivable_id: string | null;
  balance_receivable_id: string | null;
  cash_register_id: string | null;
  cash_movement_id: string | null;
  sale_id: string | null;
}

export function useApprovalMutation({
  quote, companyId, valorFinal, formState, onClose, onSuccess,
}: Params) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!quote || !companyId) throw new Error('Dados incompletos');

      const {
        selectedFormaId, selectedCondicaoId, entryAmount, entryPaymentMethod, cardActualReceived,
        balanceDueDate, receiveOnCompletion, estimatedEnd, priority, notes,
      } = formState;

      const entryValue = parseAmount(entryAmount);
      if (entryValue < 0 || entryValue > valorFinal) {
        throw new Error('A entrada deve estar entre zero e o valor final');
      }
      const pendingAmount = Number((valorFinal - entryValue).toFixed(2));
      const formaPagamentoId = selectedFormaId?.startsWith('fallback-') ? null : selectedFormaId;
      const effectiveBalanceDueDate = pendingAmount > 0
        ? (receiveOnCompletion ? estimatedEnd : balanceDueDate) ?? addDays(new Date(), 30)
        : null;
      const cardNetAmount = entryValue > 0
        && entryPaymentMethod === 'cartao'
        && cardActualReceived
        ? parseAmount(cardActualReceived)
        : null;

      const { data, error } = await supabase.rpc('approve_quote_transactional', {
        p_quote_id: quote.id,
        p_company_id: companyId,
        p_total_amount: valorFinal,
        p_entry_amount: entryValue,
        p_payment_method: entryValue > 0 ? entryPaymentMethod : null,
        p_card_net_amount: cardNetAmount,
        p_balance_due_date: effectiveBalanceDueDate
          ? format(effectiveBalanceDueDate, 'yyyy-MM-dd')
          : null,
        p_estimated_end: estimatedEnd ? format(estimatedEnd, 'yyyy-MM-dd') : null,
        p_priority: priority,
        p_notes: notes || null,
        p_forma_pagamento_id: formaPagamentoId,
        p_condicao_pagamento_id: selectedCondicaoId,
      });

      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Resposta inválida ao aprovar orçamento');
      }

      const result = data as unknown as ApprovalRpcResult;
      if (result.success !== true
        || !result.ordem_servico_id
        || typeof result.os_number !== 'number') {
        throw new Error('A aprovação não retornou uma ordem de serviço válida');
      }

      return {
        ordemServico: {
          id: result.ordem_servico_id,
          os_number: result.os_number,
        },
        saleId: result.sale_id,
        idempotentReplay: result.idempotent_replay,
      };
    },
    onSuccess: (data) => {
      toast({
        title: 'Orçamento aprovado!',
        description: `OS #${data.ordemServico.os_number} criada com sucesso.`,
      });
      // Close immediately so a completed approval cannot be submitted again
      // while the affected queries are being refreshed.
      onClose();
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['quote-deposit'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['material-consumption'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao aprovar orçamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
