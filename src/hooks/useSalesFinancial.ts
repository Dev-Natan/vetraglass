import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Status financeiro da venda
export type SaleFinancialStatus = 'EM_ABERTO' | 'PARCIAL' | 'PAGO';

// Tipos de operação
export interface RegisterEntryParams {
  saleId: string;
  ordemServicoId?: string;
  quoteId?: string;
  amount: number;
  paymentMethod: 'dinheiro' | 'cartao' | 'pix';
  cashRegisterId: string;
  customerName: string;
  description?: string;
}

export interface RegisterPaymentParams {
  receivableId: string;
  amount: number;
  paymentMethod: 'dinheiro' | 'cartao' | 'pix';
  cashRegisterId: string;
  notes?: string;
}

export interface SaleFinancialSummary {
  saleId: string;
  valorTotal: number;
  valorRecebido: number;
  valorRestante: number;
  statusFinanceiro: SaleFinancialStatus;
  entradas: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    receivedAt: string;
  }>;
  parcelas: Array<{
    id: string;
    numero: number;
    total: number;
    valor: number;
    vencimento: string;
    status: string;
    paidAmount: number;
  }>;
}

/**
 * Calcula o status financeiro com base nos valores recebidos e total
 */
export function calculateFinancialStatus(
  valorRecebido: number,
  valorTotal: number
): SaleFinancialStatus {
  if (valorRecebido <= 0) return 'EM_ABERTO';
  if (valorRecebido >= valorTotal) return 'PAGO';
  return 'PARCIAL';
}

/**
 * Hook principal para gerenciamento financeiro de vendas
 */
export function useSalesFinancial() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  /**
   * Registra entrada de venda no caixa
   * - Cria movimento de caixa (ENTRADA)
   * - Atualiza valorRecebido e valorRestante da OS/venda
   * - Atualiza status financeiro automaticamente
   */
  const registerEntryMutation = useMutation({
    mutationFn: async (params: RegisterEntryParams) => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuário não encontrado');
      }

      const {
        saleId,
        ordemServicoId,
        quoteId,
        amount,
        paymentMethod,
        cashRegisterId,
        customerName,
        description,
      } = params;

      // 1. Criar movimento de caixa (entrada real de dinheiro)
      const { data: cashMovement, error: movementError } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: cashRegisterId,
          company_id: currentCompany.id,
          type: 'entrada',
          category: 'entrada_venda',
          amount: amount,
          description: description || `Entrada de venda - ${customerName}`,
          payment_method: paymentMethod,
          sale_id: saleId,
          created_by: user.id,
          origem: 'venda',
        })
        .select('id')
        .single();

      if (movementError) throw movementError;

      // 2. Atualizar a venda (sales) com novo valorRecebido
      const { data: currentSale, error: saleSelectError } = await supabase
        .from('sales')
        .select('total_amount, paid_amount, pending_amount')
        .eq('id', saleId)
        .single();

      if (saleSelectError) throw saleSelectError;

      const newPaidAmount = (currentSale.paid_amount || 0) + amount;
      const newPendingAmount = Math.max(0, currentSale.total_amount - newPaidAmount);
      const newStatus = calculateFinancialStatus(newPaidAmount, currentSale.total_amount);
      const paymentStatus = newStatus === 'PAGO' ? 'paid' : newStatus === 'PARCIAL' ? 'partial' : 'pending';

      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          paid_amount: newPaidAmount,
          pending_amount: newPendingAmount,
          payment_status: paymentStatus,
        })
        .eq('id', saleId);

      if (saleUpdateError) throw saleUpdateError;

      // 3. Se tiver OS vinculada, atualizar também
      if (ordemServicoId) {
        const { data: currentOS, error: osSelectError } = await supabase
          .from('ordens_servico')
          .select('paid_amount, pending_amount, total_amount')
          .eq('id', ordemServicoId)
          .single();

        if (!osSelectError && currentOS) {
          const osNewPaidAmount = (currentOS.paid_amount || 0) + amount;
          const osNewPendingAmount = Math.max(0, (currentOS.pending_amount || currentOS.total_amount) - amount);

          await supabase
            .from('ordens_servico')
            .update({
              paid_amount: osNewPaidAmount,
              pending_amount: osNewPendingAmount,
            })
            .eq('id', ordemServicoId);
        }
      }

      // 4. Criar/atualizar registro em accounts_receivable para rastreamento
      const { error: receivableError } = await supabase
        .from('accounts_receivable')
        .insert({
          company_id: currentCompany.id,
          sale_id: saleId,
          ordem_servico_id: ordemServicoId,
          quote_id: quoteId,
          customer_name: customerName,
          description: description || `Entrada - ${customerName}`,
          total_amount: amount,
          paid_amount: amount,
          status: 'paid',
          due_date: format(new Date(), 'yyyy-MM-dd'),
          paid_date: format(new Date(), 'yyyy-MM-dd'),
          receivable_type: 'entrada_venda',
          payment_method: paymentMethod,
          installment_number: 0,
          total_installments: 0,
          created_by: user.id,
        });

      if (receivableError) {
        console.warn('Erro ao criar registro de entrada:', receivableError);
      }

      return {
        cashMovementId: cashMovement.id,
        newPaidAmount,
        newPendingAmount,
        financialStatus: newStatus,
      };
    },
    onSuccess: (data) => {
      toast.success('Entrada registrada com sucesso!', {
        description: `Status: ${data.financialStatus}`,
      });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
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
   * Registra pagamento de parcela/restante
   * - Lança no caixa como ENTRADA
   * - Abate valor da conta a receber
   * - Atualiza valorRecebido e valorRestante da venda
   * - Atualiza status financeiro automaticamente
   */
  const registerPaymentMutation = useMutation({
    mutationFn: async (params: RegisterPaymentParams) => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuário não encontrado');
      }

      const { receivableId, amount, paymentMethod, cashRegisterId, notes } = params;

      // 1. Buscar dados da conta a receber
      const { data: receivable, error: receivableSelectError } = await supabase
        .from('accounts_receivable')
        .select('*, sales(id, total_amount, paid_amount, pending_amount), ordens_servico(id, paid_amount, pending_amount, total_amount)')
        .eq('id', receivableId)
        .single();

      if (receivableSelectError) throw receivableSelectError;
      if (!receivable) throw new Error('Conta a receber não encontrada');

      const description = receivable.installment_number > 0
        ? `Parcela ${receivable.installment_number}/${receivable.total_installments} - ${receivable.customer_name}`
        : `Pagamento - ${receivable.customer_name}`;

      // 2. Criar movimento de caixa (entrada real de dinheiro)
      const { data: cashMovement, error: movementError } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: cashRegisterId,
          company_id: currentCompany.id,
          type: 'entrada',
          category: 'recebimento_parcela',
          amount: amount,
          description: description,
          payment_method: paymentMethod,
          receivable_id: receivableId,
          sale_id: receivable.sale_id,
          created_by: user.id,
          origem: 'conta_receber',
        })
        .select('id')
        .single();

      if (movementError) throw movementError;

      // 3. Atualizar a conta a receber
      const newPaidAmount = (receivable.paid_amount || 0) + amount;
      const isFullyPaid = newPaidAmount >= receivable.total_amount;

      const { error: receivableUpdateError } = await supabase
        .from('accounts_receivable')
        .update({
          paid_amount: newPaidAmount,
          status: isFullyPaid ? 'paid' : 'partial',
          paid_date: isFullyPaid ? format(new Date(), 'yyyy-MM-dd') : null,
          payment_method: paymentMethod,
          notes: notes || receivable.notes,
        })
        .eq('id', receivableId);

      if (receivableUpdateError) throw receivableUpdateError;

      // 4. Atualizar a venda vinculada
      let saleFinancialStatus: SaleFinancialStatus = 'EM_ABERTO';
      
      if (receivable.sale_id && receivable.sales) {
        const sale = receivable.sales;
        const saleNewPaidAmount = (sale.paid_amount || 0) + amount;
        const saleNewPendingAmount = Math.max(0, sale.total_amount - saleNewPaidAmount);
        saleFinancialStatus = calculateFinancialStatus(saleNewPaidAmount, sale.total_amount);
        const paymentStatus = saleFinancialStatus === 'PAGO' ? 'paid' : saleFinancialStatus === 'PARCIAL' ? 'partial' : 'pending';

        const { error: saleUpdateError } = await supabase
          .from('sales')
          .update({
            paid_amount: saleNewPaidAmount,
            pending_amount: saleNewPendingAmount,
            payment_status: paymentStatus,
          })
          .eq('id', receivable.sale_id);

        if (saleUpdateError) {
          console.warn('Erro ao atualizar venda:', saleUpdateError);
        }
      }

      // 5. Atualizar OS vinculada
      if (receivable.ordem_servico_id && receivable.ordens_servico) {
        const os = receivable.ordens_servico;
        const osNewPaidAmount = (os.paid_amount || 0) + amount;
        const osNewPendingAmount = Math.max(0, (os.pending_amount || os.total_amount) - amount);

        await supabase
          .from('ordens_servico')
          .update({
            paid_amount: osNewPaidAmount,
            pending_amount: osNewPendingAmount,
          })
          .eq('id', receivable.ordem_servico_id);
      }

      return {
        cashMovementId: cashMovement.id,
        receivableId,
        amountPaid: amount,
        isFullyPaid,
        saleFinancialStatus,
      };
    },
    onSuccess: (data) => {
      toast.success('Pagamento registrado!', {
        description: data.isFullyPaid ? 'Parcela quitada' : 'Pagamento parcial registrado',
      });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
    },
    onError: (error) => {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  /**
   * Busca resumo financeiro de uma venda
   */
  const getSaleFinancialSummary = async (saleId: string): Promise<SaleFinancialSummary | null> => {
    if (!currentCompany?.id) return null;

    // Buscar venda
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleError || !sale) return null;

    // Buscar contas a receber vinculadas
    const { data: receivables, error: receivablesError } = await supabase
      .from('accounts_receivable')
      .select('*')
      .eq('sale_id', saleId)
      .order('installment_number', { ascending: true });

    if (receivablesError) {
      console.warn('Erro ao buscar contas a receber:', receivablesError);
    }

    const entradas = (receivables || [])
      .filter(r => r.receivable_type === 'entrada_venda' || r.receivable_type === 'entrada_orcamento')
      .map(r => ({
        id: r.id,
        amount: r.total_amount,
        paymentMethod: r.payment_method || 'dinheiro',
        receivedAt: r.paid_date || r.created_at,
      }));

    const parcelas = (receivables || [])
      .filter(r => r.receivable_type !== 'entrada_venda' && r.receivable_type !== 'entrada_orcamento')
      .map(r => ({
        id: r.id,
        numero: r.installment_number,
        total: r.total_installments,
        valor: r.total_amount,
        vencimento: r.due_date,
        status: r.status,
        paidAmount: r.paid_amount || 0,
      }));

    const valorRecebido = sale.paid_amount || 0;
    const valorRestante = sale.pending_amount || (sale.total_amount - valorRecebido);
    const statusFinanceiro = calculateFinancialStatus(valorRecebido, sale.total_amount);

    return {
      saleId,
      valorTotal: sale.total_amount,
      valorRecebido,
      valorRestante,
      statusFinanceiro,
      entradas,
      parcelas,
    };
  };

  return {
    registerEntry: registerEntryMutation.mutate,
    registerEntryAsync: registerEntryMutation.mutateAsync,
    isRegisteringEntry: registerEntryMutation.isPending,
    
    registerPayment: registerPaymentMutation.mutate,
    registerPaymentAsync: registerPaymentMutation.mutateAsync,
    isRegisteringPayment: registerPaymentMutation.isPending,
    
    getSaleFinancialSummary,
    calculateFinancialStatus,
    formatCurrency,
  };
}

/**
 * Hook para buscar resumo financeiro de uma OS
 */
export function useOSFinancialSummary(ordemServicoId: string | undefined) {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['os-financial-summary', ordemServicoId],
    queryFn: async () => {
      if (!ordemServicoId || !currentCompany?.id) return null;

      // Buscar OS
      const { data: os, error: osError } = await supabase
        .from('ordens_servico')
        .select('*, quotes(quote_number)')
        .eq('id', ordemServicoId)
        .single();

      if (osError || !os) return null;

      // Buscar todas as contas a receber
      const { data: receivables } = await supabase
        .from('accounts_receivable')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .order('installment_number', { ascending: true });

      // Buscar depósitos/entradas
      const { data: deposits } = await supabase
        .from('quote_deposits')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId);

      // Buscar vendas parciais
      const { data: partialSales } = await supabase
        .from('sales')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .eq('sale_type', 'partial');

      const valorTotal = os.total_amount || 0;
      const valorRecebido = os.paid_amount || 0;
      const valorRestante = os.pending_amount || (valorTotal - valorRecebido);
      const statusFinanceiro = calculateFinancialStatus(valorRecebido, valorTotal);

      // Separar entradas e parcelas
      const entradas = [
        ...(deposits || []).filter(d => d.status === 'received').map(d => ({
          id: d.id,
          tipo: 'deposit' as const,
          amount: d.amount,
          paymentMethod: d.payment_method || 'pix',
          receivedAt: d.received_at || d.created_at,
        })),
        ...(partialSales || []).map(s => ({
          id: s.id,
          tipo: 'partial_sale' as const,
          amount: s.total_amount,
          paymentMethod: s.payment_method || 'pix',
          receivedAt: s.created_at,
        })),
      ];

      const parcelas = (receivables || [])
        .filter(r => r.receivable_type !== 'entrada_orcamento' && r.installment_number > 0)
        .map(r => ({
          id: r.id,
          numero: r.installment_number,
          total: r.total_installments,
          valor: r.total_amount,
          vencimento: r.due_date,
          status: r.status,
          paidAmount: r.paid_amount || 0,
        }));

      const entradasPendentes = (deposits || []).filter(d => d.status === 'pending');

      return {
        os,
        valorTotal,
        valorRecebido,
        valorRestante,
        statusFinanceiro,
        entradas,
        parcelas,
        entradasPendentes,
        quoteNumber: os.quotes?.quote_number,
      };
    },
    enabled: !!ordemServicoId && !!currentCompany?.id,
  });
}
