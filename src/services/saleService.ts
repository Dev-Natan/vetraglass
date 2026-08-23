import { supabase } from '@/integrations/supabase/client';
import { VendaItem } from '@/components/caixa/NovaVendaDialog';
import { PaymentConfig } from '@/components/caixa/InstallmentPaymentSheet';
import { registerStockExit } from '@/utils/stockMovements';

export const saleService = {
  async fetchTodaySales(cashRegisterId: string) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchAvailableItems(companyId: string) {
    const { data: companyItems, error } = await supabase
      .from('company_items')
      .select('id,item_template_id,name,pricing_unit,unit,type,linha,sale_price,cost')
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (error) throw error;
    return (companyItems || []).map(item => ({
      id: item.item_template_id ?? item.id,
      name: item.name,
      unit: item.pricing_unit ?? item.unit,
      type: item.type,
      linha: item.linha,
      price: Number(item.sale_price),
      isDefaultPrice: false,
      pricingError: Number(item.cost) <= 0 ? 'MISSING_COST' : Number(item.sale_price) <= 0 ? 'MISSING_PRICE' : null,
    }));
  },

  async fetchAvailableProducts(companyId: string) {
    const { data, error } = await supabase
      .from('company_products')
      .select(`id, commercial_name, base_price, product_template_id, product_template:product_templates (name, category, linha)`)
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  },

  async fetchApprovedQuotesFinancial(companyId: string) {
    const { data: financialData, error: financialError } = await supabase
      .from('quote_financial_status')
      .select('*')
      .eq('company_id', companyId)
      .gt('pending_amount', 0)
      .order('created_at', { ascending: false });

    if (financialError) throw financialError;
    if (!financialData?.length) return [];

    const candidateIds = financialData.map(q => q.quote_id);

    // Regra de negócio: só podem ser faturados orçamentos APROVADOS ou que
    // possuam Ordem de Serviço vinculada já CONCLUÍDA. Qualquer outro status
    // (pendente/em negociação/enviado/cancelado/rascunho) é ocultado.
    const { data: completedOs, error: osError } = await supabase
      .from('ordens_servico')
      .select('quote_id')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .in('quote_id', candidateIds);

    if (osError) throw osError;
    const quotesWithCompletedOs = new Set(
      (completedOs || []).map(o => o.quote_id).filter(Boolean) as string[]
    );

    const APPROVED_STATUSES = ['approved', 'aprovado'];
    const quoteIds = financialData
      .filter(
        f =>
          APPROVED_STATUSES.includes(String(f.status || '').toLowerCase()) ||
          quotesWithCompletedOs.has(f.quote_id as string)
      )
      .map(f => f.quote_id);

    if (!quoteIds.length) return [];

    const { data: quotesWithItems, error: itemsError } = await supabase
      .from('quotes')
      .select(`
        id, quote_number, customer_name, total_amount, final_amount, valor_final_aprovado, status, created_at,
        quote_items (id, description, quantity, unit_price, total_price, width, height, company_product_id, product_template_id)
      `)
      .in('id', quoteIds);

    if (itemsError) throw itemsError;


    return (quotesWithItems || []).map(quote => {
      const financial = financialData.find(f => f.quote_id === quote.id);
      // Valor fechado no ato da aprovação (com desconto aplicado conforme forma de pagamento).
      // Se ausente (aprovações antigas), cai no final_amount original.
      const lockedAmount = (quote as any).valor_final_aprovado ?? quote.final_amount;
      return {
        ...quote,
        final_amount: lockedAmount,
        original_final_amount: quote.final_amount,
        total_deposits: financial?.total_deposits || 0,
        total_sold: financial?.total_sold || 0,
        pending_amount: financial?.pending_amount || lockedAmount,
        financial_status: financial?.financial_status || 'pending',
      };
    });
  },

  async processNewSale(params: {
    companyId: string;
    userId: string;
    cashRegisterId: string;
    items: VendaItem[];
    customerName: string;
    paymentConfig: PaymentConfig;
    discountPercent: number;
    discountAmount: number;
    subtotal: number;
    total: number;
    quoteId?: string;
  }) {
    const { companyId, userId, cashRegisterId, items, customerName, paymentConfig, discountPercent, discountAmount, subtotal, total, quoteId } = params;

    let depositsTotalReceived = 0;
    if (quoteId) {
      const { data: deposits } = await supabase
        .from('quote_deposits')
        .select('amount')
        .eq('quote_id', quoteId)
        .eq('status', 'received');
      depositsTotalReceived = (deposits || []).reduce((sum, d) => sum + d.amount, 0);
    }

    const { data: sale, error: saleError } = await supabase.from('sales').insert({ 
      company_id: companyId, 
      cash_register_id: cashRegisterId, 
      customer_name: customerName || null, 
      subtotal: subtotal, 
      discount_percent: discountPercent, 
      discount_amount: discountAmount, 
      total_amount: total, 
      payment_method: paymentConfig.method, 
      payment_status: 'paid',
      paid_amount: total,
      pending_amount: 0,
      sold_by: userId,
      quote_id: quoteId || null
    }).select().single();
    
    if (saleError) {
      if (saleError.message?.includes('uq_sales_quote_type')) {
        throw new Error('Este orçamento já foi faturado. Cancele a venda anterior para faturá-lo novamente.');
      }
      throw saleError;
    }
    
    const saleItemsPayload = items.map((item) => ({ 
      sale_id: sale.id, 
      item_template_id: item.itemTemplateId || null, 
      company_product_id: item.companyProductId || null, 
      item_name: item.name, 
      item_unit: item.unit, 
      quantity: item.quantity, 
      unit_price: item.unitPrice, 
      total_price: item.totalPrice, 
      width: item.width || null, 
      height: item.height || null 
    }));
    
    const { data: insertedItems, error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsPayload)
      .select('id');
    if (itemsError) throw itemsError;

    // Persist manual composition for product items and aggregate stock exits
    const stockExits = new Map<string, { itemTemplateId: string | null; quantity: number; name: string }>();
    const componentRows: any[] = [];

    items.forEach((item, idx) => {
      const saleItemId = insertedItems?.[idx]?.id;
      if (!saleItemId) return;
      if (item.isProduct && item.composition && item.composition.length > 0) {
        for (const c of item.composition) {
          componentRows.push({
            sale_item_id: saleItemId,
            company_id: companyId,
            company_item_id: c.companyItemId,
            item_template_id: c.itemTemplateId,
            item_name: c.itemName,
            unit: c.unit,
            quantity: c.quantity,
            source: c.source,
          });
          const key = c.companyItemId || c.itemTemplateId;
          if (!key) continue;
          const existing = stockExits.get(key);
          if (existing) existing.quantity += c.quantity;
          else stockExits.set(key, { itemTemplateId: c.itemTemplateId, quantity: c.quantity, name: c.itemName });
        }
      } else if (!item.isProduct && item.itemTemplateId) {
        // Avulso: deduct directly
        const key = item.itemTemplateId;
        const existing = stockExits.get(key);
        if (existing) existing.quantity += item.quantity;
        else stockExits.set(key, { itemTemplateId: item.itemTemplateId, quantity: item.quantity, name: item.name });
      }
    });

    if (componentRows.length > 0) {
      const { error: compError } = await supabase.from('sale_item_components').insert(componentRows);
      if (compError) console.error('Falha ao salvar composição:', compError);
    }

    // Register stock exits (failures are logged but don't fail the sale)
    for (const [, exit] of stockExits) {
      if (!exit.itemTemplateId || exit.quantity <= 0) continue;
      try {
        await registerStockExit({
          companyId,
          itemTemplateId: exit.itemTemplateId,
          quantity: exit.quantity,
          category: 'venda',
          description: `Venda PDV — ${exit.name}`,
          referenceId: sale.id,
          referenceType: 'sale',
        });
      } catch (err) {
        console.error(`Falha na baixa de estoque (${exit.name}):`, err);
      }
    }

    return sale;
  }
};
