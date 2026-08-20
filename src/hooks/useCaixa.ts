import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caixaService } from '@/services/caixaService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useCaixa() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  const companyCashQuery = useQuery({
    queryKey: ['company-cash', currentCompany?.id],
    queryFn: () => caixaService.fetchCompanyCash(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const openCashRegisterQuery = useQuery({
    queryKey: ['cash-register-open', currentCompany?.id],
    queryFn: () => caixaService.getOpenCashRegister(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const lastClosingQuery = useQuery({
    queryKey: ['cash-register-last-closing', currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('closing_amount, closed_at')
        .eq('company_id', currentCompany!.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.closing_amount != null ? Number(data.closing_amount) : null;
    },
    enabled: !!currentCompany?.id,
  });

  const openCashMutation = useMutation({
    mutationFn: (openingAmount: number) =>
      caixaService.openCash(currentCompany!.id, user!.id, openingAmount),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Caixa aberto com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
        queryClient.invalidateQueries({ queryKey: ['company-cash'] });
        queryClient.invalidateQueries({ queryKey: ['cash-register-last-closing'] });
      } else {
        toast.error(result.error || 'Erro ao abrir caixa');
      }
    },
    onError: (error: Error) => toast.error(`Erro ao abrir caixa: ${error.message}`),
  });

  return {
    companyCash: companyCashQuery.data,
    openCashRegister: openCashRegisterQuery.data,
    lastClosingAmount: lastClosingQuery.data ?? null,
    isLoading: companyCashQuery.isLoading || openCashRegisterQuery.isLoading,
    openCash: openCashMutation.mutate,
    isOpening: openCashMutation.isPending,
  };
}
