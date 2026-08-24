import { supabase } from '@/integrations/supabase/client';
import type { StockItem } from '@/types/estoque';
import type { Json } from '@/integrations/supabase/types';

function parseLocations(value: Json | null): NonNullable<StockItem['locations']> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') return [];
    const id = typeof entry.id === 'string' ? entry.id : '';
    const code = typeof entry.code === 'string' ? entry.code : '';
    const name = typeof entry.name === 'string' ? entry.name : '';
    if (!id || !code || !name) return [];
    return [{
      id,
      code,
      name,
      canonical_quantity: Number(entry.canonical_quantity || 0),
      package_quantity: Number(entry.package_quantity || 0),
      needs_review: entry.needs_review === true,
    }];
  });
}

export const estoqueService = {
  async fetchStockItems(companyId: string): Promise<StockItem[]> {
    const [stockResult, physicalResult] = await Promise.all([
      supabase
        .from('company_stock')
        .select('id, item_template_id, company_item_id, company_id, quantity, canonical_quantity, canonical_unit, average_unit_cost, inventory_value, unit_status, min_quantity, location, is_active, allow_fractional, updated_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('physical_inventory_summary')
        .select('*')
        .eq('company_id', companyId),
    ]);

    if (stockResult.error) throw stockResult.error;
    if (physicalResult.error) throw physicalResult.error;
    const physicalByItem = new Map(
      (physicalResult.data || []).flatMap((row) => row.company_item_id ? [[row.company_item_id, row] as const] : []),
    );
    return (stockResult.data || []).map((stock) => {
      const physical = stock.company_item_id ? physicalByItem.get(stock.company_item_id) : undefined;
      return {
      ...stock,
      quantity: Number(physical?.canonical_quantity || 0) /
        Number(physical?.consumption_to_canonical_factor || 1),
      canonical_quantity: Number(physical?.canonical_quantity || stock.canonical_quantity || 0),
      canonical_unit: (physical?.canonical_unit || stock.canonical_unit) as StockItem['canonical_unit'],
      package_quantity: Number(physical?.package_quantity || 0),
      purchase_unit: physical?.purchase_unit,
      stock_unit: physical?.stock_unit,
      consumption_unit: physical?.consumption_unit,
      purchase_to_canonical_factor: physical?.purchase_to_canonical_factor,
      consumption_to_canonical_factor: physical?.consumption_to_canonical_factor,
      nominal_length_mm: physical?.nominal_length_mm,
      average_unit_cost: physical?.average_cost_per_consumption_unit,
      inventory_value: physical?.inventory_value,
      unit_status: physical?.legacy_status as StockItem['unit_status'],
      location_count: Number(physical?.location_count || 0),
      locations: parseLocations(physical?.locations || null),
      reserved_quantity: 0,
    };
    });
  },

  async fetchLocations(companyId: string) {
    const { data, error } = await supabase
      .from('stock_locations')
      .select('id, code, name, kind, parent_id, needs_review')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
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
      .from('company_items')
      .select('id, item_template_id, cost, sale_price')
      .eq('company_id', companyId);

    if (error) throw error;
    return (data || []).map(item => ({ ...item, price: item.sale_price }));
  },

  async toggleActive(stockId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('company_stock')
      .update({ is_active: isActive })
      .eq('id', stockId);

    if (error) throw error;
  }
};

