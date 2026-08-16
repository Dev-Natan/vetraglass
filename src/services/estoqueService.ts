import { supabase } from '@/integrations/supabase/client';
import type { StockItem } from '@/types/estoque';

export const estoqueService = {
  async fetchStockItems(companyId: string): Promise<StockItem[]> {
    const { data, error } = await supabase
      .from('company_stock')
      .select('id, item_template_id, company_item_id, company_id, quantity, min_quantity, location, is_active, allow_fractional, updated_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((stock) => ({
      ...stock,
      // Filled with the canonical aggregate by useStockData.
      reserved_quantity: 0,
    }));
  },

  async fetchCompanyItems(companyId: string) {
    const { data, error } = await supabase
      .from('company_items')
      .select('id, name, type, unit, image_url, linha, is_custom, cost, sale_price, bar_length_mm, weight_per_meter, weight_kg')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  },

  async fetchItemTemplates() {
    const { data, error } = await supabase
      .from('item_templates')
      .select('id, name, type, unit, image_url, linha, default_price, default_cost, default_sale_price, bar_length_mm, weight_per_meter, weight_per_bar')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  },

  async fetchItemPrices(companyId: string) {
    const { data, error } = await supabase
      .from('company_item_prices')
      .select('id, item_template_id, cost, price')
      .eq('company_id', companyId);

    if (error) throw error;
    return data || [];
  },

  async toggleActive(stockId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('company_stock')
      .update({ is_active: isActive })
      .eq('id', stockId);

    if (error) throw error;
  }
};

