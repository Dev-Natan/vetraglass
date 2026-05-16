import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VendaItem } from '@/components/caixa/NovaVendaDialog';
import { PaymentConfig } from '@/components/caixa/InstallmentPaymentSheet';

export function useSales() {
  const queryClient = useQueryClient();

  const cancelSaleMutation = useMutation({
    mutationFn: async ({ saleId, companyId, userId, reason }: { saleId: string; companyId: string; userId: string; reason: string }) => {
      // Usando a função RPC cancel_sale que já existe no banco
      const { data, error } = await supabase.rpc('cancel_sale', {
        p_sale_id: saleId,
        p_company_id: companyId,
        p_user_id: userId,
        p_reason: reason
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error || 'Erro ao cancelar venda');
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Venda cancelada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['approved-quotes-financial'] });
      queryClient.invalidateQueries({ queryKey: ['completed-os-pending-billing'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
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
      const { items, customerName, paymentConfig, discountPercent, discountAmount, subtotal, total, quoteId, cashRegisterId, companyId, userId } = data;

      // 1. Criar Venda
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          company_id: companyId,
          cash_register_id: cashRegisterId,
          customer_name: customerName,
          subtotal,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          total_amount: total,
          payment_method: paymentConfig.method,
          payment_status: paymentConfig.method === 'dinheiro' ? 'paid' : 'pending',
          sold_by: userId, // Usando sold_by em vez de created_by
          quote_id: quoteId,
          sale_type: quoteId ? 'partial' : 'full'
        })
        .select('*')
        .single();

      if (saleError) throw saleError;

      // 2. Inserir Itens da Venda
      const saleItems = items.map(item => ({
        sale_id: sale.id,
        item_name: item.name,
        item_unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        width: item.width || null,
        height: item.height || null,
        company_product_id: item.companyProductId || null,
        item_template_id: item.itemTemplateId || null
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      // 3. Registrar movimento de caixa se pago em dinheiro
      if (paymentConfig.method === 'dinheiro') {
        await supabase.from('cash_movements').insert({
          company_id: companyId,
          cash_register_id: cashRegisterId,
          type: 'entrada',
          category: 'venda',
          amount: total,
          description: `Venda #${String(sale.sale_number).padStart(4, '0')} - ${customerName}`,
          payment_method: 'dinheiro',
          sale_id: sale.id,
          created_by: userId,
          origem: 'venda'
        });
      }

      return sale;
    },
    onSuccess: (sale) => {
      toast.success(`Venda registrada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
    },
    onError: (error: Error) => toast.error(`Erro ao registrar venda: ${error.message}`),
  });

  return {
    cancelSale: cancelSaleMutation.mutateAsync,
    isCancelling: cancelSaleMutation.isPending,
    createSale: newSaleMutation.mutateAsync,
    isCreating: newSaleMutation.isPending,
  };
}
