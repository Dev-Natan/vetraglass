import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CashAudit {
  id: string;
  cash_register_id: string;
  operator_id: string;
  operator_name: string;
  total_counted: number;
  expected_amount: number;
  difference: number;
  operator_notes: string | null;
  submitted_at: string;
  counts_submitted: Array<{ payment_method: string; amount: number }>;
}

interface PendingAuditsResult {
  audits: CashAudit[];
  count: number;
}

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

  // Buscar auditorias pendentes da empresa
  const { data: pendingAudits, isLoading: loadingAudits } = useQuery({
    queryKey: ['pending-cash-audits', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { audits: [], count: 0 };
      const { data, error } = await supabase.rpc('get_pending_cash_audits', {
        _company_id: currentCompany.id,
      });
      if (error) throw error;
      return data as unknown as PendingAuditsResult;
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar pendências do operador atual
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

  // Mutation: Submeter fechamento para auditoria
  const submitForAuditMutation = useMutation({
    mutationFn: async ({ 
      cashRegisterId, 
      counts, 
      notes 
    }: { 
      cashRegisterId: string; 
      counts: Array<{ payment_method: string; amount: number }>; 
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('submit_cash_closing_for_audit', {
        _cash_register_id: cashRegisterId,
        _counts: counts,
        _notes: notes || null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao submeter para auditoria');
      }
      return result;
    },
    onSuccess: (result) => {
      toast.success(result.message || 'Fechamento enviado para auditoria');
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['pending-cash-audits'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Mutation: Aprovar/Rejeitar auditoria
  const completeAuditMutation = useMutation({
    mutationFn: async ({ 
      auditId, 
      action, 
      notes, 
      adjustmentAmount 
    }: { 
      auditId: string; 
      action: 'approved' | 'rejected' | 'adjusted';
      notes?: string;
      adjustmentAmount?: number;
    }) => {
      const { data, error } = await supabase.rpc('complete_cash_audit', {
        _audit_id: auditId,
        _action: action,
        _notes: notes || null,
        _adjustment_amount: adjustmentAmount || null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; audit_action?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar auditoria');
      }
      return result;
    },
    onSuccess: (result) => {
      const message = result.audit_action === 'rejected' 
        ? 'Fechamento rejeitado. Operador notificado.' 
        : 'Fechamento aprovado e caixa fechado!';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['pending-cash-audits'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash-movements'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    pendingAudits,
    loadingAudits,
    operatorPending,
    loadingOperatorPending,
    submitForAudit: submitForAuditMutation.mutateAsync,
    isSubmittingForAudit: submitForAuditMutation.isPending,
    completeAudit: completeAuditMutation.mutateAsync,
    isCompletingAudit: completeAuditMutation.isPending,
  };
}
