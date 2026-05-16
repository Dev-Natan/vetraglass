import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quoteService, QuoteStatus, Quote } from '@/services/quoteService';
import { toast } from 'sonner';

export function useQuotes(companyId?: string) {
  const queryClient = useQueryClient();

  const quotesQuery = useQuery({
    queryKey: ['quotes', companyId],
    queryFn: () => quoteService.fetchQuotes(companyId!),
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: quoteService.deleteQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Orçamento excluído com sucesso');
    },
    onError: (error: Error) => toast.error(`Erro ao excluir orçamento: ${error.message}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) => 
      quoteService.updateQuoteStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Status do orçamento atualizado');
    },
    onError: (error: Error) => toast.error(`Erro ao atualizar status: ${error.message}`),
  });

  const cancelApprovedMutation = useMutation({
    mutationFn: quoteService.cancelApprovedQuote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['ordens'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_receivable'] });
      toast.success('Orçamento cancelado com sucesso');
    },
    onError: (error: Error) => toast.error(`Erro ao cancelar orçamento: ${error.message}`),
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ quote, items }: { quote: Quote, items: any[] }) => 
      quoteService.duplicateQuote(companyId!, quote, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Orçamento duplicado com sucesso');
    },
    onError: (error: Error) => toast.error(`Erro ao duplicar orçamento: ${error.message}`),
  });

  return {
    quotes: quotesQuery.data || [],
    isLoading: quotesQuery.isLoading,
    deleteQuote: deleteMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    cancelApproved: cancelApprovedMutation.mutateAsync,
    duplicateQuote: duplicateMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    isUpdating: updateStatusMutation.isPending,
    isCancelling: cancelApprovedMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
  };
}
