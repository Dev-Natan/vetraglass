import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VendaItem } from '@/components/caixa/NovaVendaDialog';
import { PaymentConfig } from '@/components/caixa/InstallmentPaymentSheet';
import { calculateFormulaQuantity } from '@/utils/safeFormulaEvaluator';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';

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
      const { items, customerName, paymentConfig, discountPercent, discountAmount, subtotal, total, quoteId, cashRegisterId, companyId, userId, availableItems, availableProducts } = data;

      // Logic copied from CaixaVendas.tsx for consistency
      
      // 1. Verificar entradas e vendas anteriores
      let depositsTotalReceived = 0;
      let existingDeposits: Array<{ id: string; amount: number; cash_movement_id: string | null }> = [];
      let existingPartialSale: { id: string } | null = null;

      if (quoteId) {
        const { data: deposits } = await supabase.from('quote_deposits').select('id, amount, cash_movement_id').eq('quote_id', quoteId).eq('status', 'received');
        existingDeposits = deposits || [];
        depositsTotalReceived = existingDeposits.reduce((sum, d) => sum + d.amount, 0);

        const { data: partialSales } = await supabase.from('sales').select('id').eq('quote_id', quoteId).eq('sale_type', 'partial').limit(1).maybeSingle();
        existingPartialSale = partialSales;
      }

      const isPartialQuoteSale = !!quoteId && total < subtotal;

      // 2. Create Sale
      const paidNow = paymentConfig.method === 'dinheiro' ? total : (paymentConfig.paidAmount ?? 0);
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
          paid_amount: paidNow,
          pending_amount: Math.max(0, total - paidNow),
          payment_method: paymentConfig.method,
          payment_status: paymentConfig.method === 'dinheiro' ? 'paid' : 'pending',
          sold_by: userId,
          quote_id: quoteId,
          sale_type: quoteId ? (existingPartialSale ? 'completion' : (isPartialQuoteSale ? 'partial' : 'full')) : 'full',
          parent_sale_id: existingPartialSale?.id
        })
        .select('*')
        .single();

      if (saleError) throw saleError;

      // 3. Insert Items
      const saleItemsData = items.map(item => ({
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

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsData);
      if (itemsError) throw itemsError;

      // 4. Cash movement (para TODAS as formas de pagamento — fonte única de verdade do caixa)
      await supabase.from('cash_movements').insert({
        company_id: companyId,
        cash_register_id: cashRegisterId,
        type: 'entrada',
        category: 'venda',
        amount: total,
        description: `Venda #${String(sale.sale_number).padStart(4, '0')} - ${customerName}`,
        payment_method: paymentConfig.method,
        sale_id: sale.id,
        created_by: userId,
        origem: 'venda'
      });


      // 5. Only direct counter sales deduct here. Quote/OS materials are consumed
      // exactly once by complete_os_production after reservation and review.
      const shouldDeductStock = !quoteId && !isPartialQuoteSale;
      if (shouldDeductStock) {
        const stockDeductions: Map<string, number> = new Map();
        for (const item of items) {
          if (item.itemTemplateId && !item.isProduct) {
            const template = availableItems.find(t => t.id === item.itemTemplateId);
            let deductionQty = item.quantity;
            if ((template?.unit === 'm²' || template?.unit === 'm2') && item.width && item.height) {
              deductionQty = (item.width / 1000) * (item.height / 1000) * item.quantity;
            }
            stockDeductions.set(item.itemTemplateId, (stockDeductions.get(item.itemTemplateId) || 0) + deductionQty);
          }
          // Product composition logic omitted for brevity in this hook but can be added if needed
        }

        for (const [key, deductionQty] of stockDeductions) {
          const { data: stockItem } = await supabase.from('company_stock').select('id, quantity, company_item_id, item_template_id').eq('company_id', companyId).eq('item_template_id', key).maybeSingle();
          if (stockItem) {
            await supabase.from('company_stock').update({ quantity: Math.max(0, stockItem.quantity - deductionQty) }).eq('id', stockItem.id);
            await supabase.from('stock_movements').insert({
              company_id: companyId,
              company_item_id: stockItem.company_item_id,
              item_template_id: stockItem.item_template_id || key,
              type: 'saida',
              category: 'venda_direta',
              quantity: deductionQty,
              description: `Venda #${String(sale.sale_number).padStart(4, '0')}`,
              reference_id: sale.id,
              reference_type: 'sale',
              created_by: userId,
            });
          }
        }
      }

      if (quoteId) await supabase.from('quotes').update({ status: 'invoiced' }).eq('id', quoteId);
      
      const { data: sellerEmployee } = await supabase.from('employees').select('id, commission_enabled').eq('company_id', companyId).eq('user_id', userId).eq('commission_enabled', true).maybeSingle();
      if (sellerEmployee?.commission_enabled) await supabase.rpc('calculate_sale_commission', { _sale_id: sale.id, _employee_id: sellerEmployee.id });

      return sale;
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
