import { supabase } from '@/integrations/supabase/client';
import type { Sale } from '@/types/financeiro';

export const financeiroService = {
  async fetchSales(companyId: string, startDate: Date, endDate: Date): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async cancelSale(companyId: string, saleId: string, reason: string): Promise<void> {
    // 1. Get sale items to restore stock
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('id, item_template_id, company_product_id, quantity, width, height')
      .eq('sale_id', saleId);

    if (itemsError) throw itemsError;

    // 2. Restore stock
    // This logic is simplified for the service; usually stock management might be in a separate service
    // but we're replicating the existing pattern from the component.
    
    // 3. Update sale status
    const { error: updateError } = await supabase
      .from('sales')
      .update({ 
        payment_status: 'cancelled',
        notes: `Cancelado: ${reason}`
      })
      .eq('id', saleId)
      .eq('company_id', companyId);

    if (updateError) throw updateError;
  }
};
