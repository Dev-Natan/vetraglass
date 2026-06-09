import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface OperatorDiscrepancy {
  id: string;
  type: 'deficit' | 'surplus';
  amount: number;
  notes: string | null;
  date: string;
}

interface OperatorPendingResult {
  has_pending: boolean;
  total_deficit: number;
  total_surplus: number;
  net_balance: number;
  discrepancies: OperatorDiscrepancy[];
}

export function useCashAudits() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  // Pendências de discrepância do operador (não relacionado a aprovação de fechamento)
  const { data: operatorPending, isLoading: loadingOperatorPending } = useQuery({
    queryKey: ['operator-pending-discrepancies', currentCompany?.id, user?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !user?.id) return null;
      const { data, error } = await supabase.rpc('get_operator_pending_discrepancies', {
        _company_id: currentCompany.id,
        _operator_id: user.id,
      });
      if (error) throw error;
      return data as unknown as OperatorPendingResult;
    },
    enabled: !!currentCompany?.id && !!user?.id,
  });

  // Fechamento direto do caixa (sem auditoria/aprovação de gerente)
  const submitForAuditMutation = useMutation({
    mutationFn: async ({
      cashRegisterId,
      counts,
      notes,
    }: {
      cashRegisterId: string;
      counts: Array<{ payment_method: string; amount: number }>;
      notes?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)('close_cash_register_direct', {
        _cash_register_id: cashRegisterId,
        _counts: counts,
        _notes: notes || null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao fechar caixa');
      }
      return result;
    },
    onSuccess: () => {
      toast.success('Caixa fechado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash-movements'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    operatorPending,
    loadingOperatorPending,
    submitForAudit: submitForAuditMutation.mutateAsync,
    isSubmittingForAudit: submitForAuditMutation.isPending,
  };
}
