import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VendaItem } from '@/components/caixa/NovaVendaDialog';
import { PaymentConfig } from '@/components/caixa/InstallmentPaymentSheet';

export function useSales() {
  const queryClient = useQueryClient();

  const cancelSaleMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_sale_v2', {
        _sale_id: saleId,
        _cancel_reason: reason,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error || 'Erro ao cancelar venda');
      return result;
    },
    onSuccess: () => {
      toast.success('Venda cancelada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
    },
    onError: (error: Error) => toast.error(`Erro ao cancelar venda: ${error.message}`),
  });

  const newSaleMutation = useMutation({
    mutationFn: async (data: { 
      items: VendaItem[]; 
      customerName: string; 
      paymentConfig: PaymentConfig; 
      discountPercent: number; 
      discountAmount: number; 
      subtotal: number; 
      total: number; 
      quoteId?: string;
      cashRegisterId: string;
      companyId: string;
      userId: string;
    }) => {
       const { data: result, error } = await supabase.rpc('process_new_sale', {
         _items: data.items,
         _customer_name: data.customerName,
         _payment_config: data.paymentConfig,
         _discount_percent: data.discountPercent,
         _discount_amount: data.discountAmount,
         _subtotal: data.subtotal,
         _total: data.total,
         _quote_id: data.quoteId,
         _cash_register_id: data.cashRegisterId,
         _company_id: data.companyId,
         _user_id: data.userId
       });
       
       if (error) throw error;
       return result;
    },
    onSuccess: () => {
      toast.success('Venda realizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error: Error) => toast.error(`Erro ao realizar venda: ${error.message}`),
  });

  return {
    cancelSale: cancelSaleMutation.mutateAsync,
    isCancelling: cancelSaleMutation.isPending,
    createSale: newSaleMutation.mutateAsync,
    isCreating: newSaleMutation.isPending,
  };
}
