import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VendaItem } from '@/components/caixa/NovaVendaDialog';
import { PaymentConfig } from '@/components/caixa/InstallmentPaymentSheet';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
import { createUuid } from '@/utils/createUuid';

interface CancelSaleResult {
  success: boolean;
  error?: string;
  sale_number: number;
}

interface AvailableSaleItem {
  id: string;
  unit?: string | null;
}

interface AvailableSaleProduct {
  id: string;
}

export function useSales() {
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();

  const cancelSaleMutation = useMutation({
    mutationFn: async ({ saleId, companyId, userId, reason }: { saleId: string; companyId: string; userId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_sale', {
        p_sale_id: saleId,
        p_company_id: companyId,
        p_user_id: userId,
        p_reason: reason
      });

      if (error) throw error;
      const result = data as unknown as CancelSaleResult;
      if (!result.success) throw new Error(result.error || 'Erro ao cancelar venda');
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Venda #${String(result.sale_number).padStart(4, '0')} cancelada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
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
      availableItems: AvailableSaleItem[];
      availableProducts: AvailableSaleProduct[];
    }) => {
      const { items, customerName, paymentConfig, discountPercent, discountAmount,
        subtotal, total, quoteId, cashRegisterId, companyId } = data;
      const operationKey = createUuid();
      const rpcItems = items.map((item) => {
        if (!item.engineeringSnapshot || !item.fulfillmentMode) {
          throw new Error('SNAPSHOT_MISSING');
        }
        return {
          item_template_id: item.itemTemplateId ?? null,
          company_product_id: item.companyProductId ?? null,
          product_template_id: item.productTemplateId ?? null,
          item_name: item.name,
          item_unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          width: item.width ?? null,
          height: item.height ?? null,
          fulfillment_mode: item.fulfillmentMode,
          engineering_snapshot: item.engineeringSnapshot,
        };
      });
      const payment = {
        type: paymentConfig.type,
        method: paymentConfig.method,
        paid_amount: paymentConfig.paidAmount,
        installments: paymentConfig.installments.map((installment) => ({
          number: installment.number,
          due_date: installment.dueDate.toISOString().slice(0, 10),
          amount: installment.amount,
        })),
      };
      const { data: result, error } = await supabase.rpc('create_direct_sale_transactional', {
        _company_id: companyId,
        _cash_register_id: cashRegisterId,
        _customer_name: customerName,
        _items: rpcItems,
        _payment: payment,
        _subtotal: subtotal,
        _discount_percent: discountPercent,
        _discount_amount: discountAmount,
        _total: total,
        _operation_key: operationKey,
        _quote_id: quoteId ?? null,
        _notes: null,
      });
      if (error) throw error;
      return result as unknown as { sale_id: string; sale_number: number };
    },
    onSuccess: (sale) => {
      toast.success(`Venda #${String(sale.sale_number).padStart(4, '0')} registrada!`);
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      queryClient.invalidateQueries({ queryKey: ['approved-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
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
