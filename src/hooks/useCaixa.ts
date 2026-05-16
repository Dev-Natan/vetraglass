import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caixaService } from '@/services/caixaService';
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
    queryKey: ['cash-register-open', currentCompany?.id, user?.id],
    queryFn: () => caixaService.getOpenCashRegister(currentCompany!.id),
    enabled: !!currentCompany?.id && !!user?.id,
  });

  const openCashMutation = useMutation({
    mutationFn: (openingAmount: number) => 
      caixaService.openCash(currentCompany!.id, user!.id, openingAmount),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Caixa aberto com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
        queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      } else {
        toast.error(result.error || 'Erro ao abrir caixa');
      }
    },
    onError: (error: Error) => toast.error(`Erro ao abrir caixa: ${error.message}`),
  });

  return {
    companyCash: companyCashQuery.data,
    openCashRegister: openCashRegisterQuery.data,
    isLoading: companyCashQuery.isLoading || openCashRegisterQuery.isLoading,
    openCash: openCashMutation.mutate,
    isOpening: openCashMutation.isPending,
  };
}
