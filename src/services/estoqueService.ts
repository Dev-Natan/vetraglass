import { supabase } from '@/integrations/supabase/client';
import type { StockItem } from '@/types/estoque';

function canonicalToDisplay(quantity: number, unit: string | null): number {
  if (unit === 'MM') return quantity / 1000;
  if (unit === 'MM2') return quantity / 1_000_000;
  if (unit === 'G') return quantity / 1000;
  return quantity;
}

export const estoqueService = {
  async fetchStockItems(companyId: string): Promise<StockItem[]> {
    const { data, error } = await supabase
      .from('inventory_variant_summary')
      .select('*')
      .eq('company_id', companyId)
      .order('category_name')
      .order('line_name')
      .order('item_name')
      .order('variant_name');
    if (error) throw error;

    return (data || []).map((row) => {
      const onHandCanonical = Number(row.on_hand_canonical || 0);
      const reservedCanonical = Number(row.reserved_canonical || 0);
      const canonicalUnit = row.canonical_unit as StockItem['canonical_unit'];
      return {
        id: `${row.company_item_id}:${row.variant_id || 'legacy'}`,
        item_template_id: row.item_template_id,
        company_item_id: row.company_item_id,
        company_id: row.company_id,
        category_id: row.category_id,
        category_code: row.category_code,
        category_name: row.category_name,
        line_id: row.line_id,
        line_code: row.line_code,
        line_name: row.line_name,
        variant_id: row.variant_id,
        variant_name: row.variant_name,
        aluminum_color_id: row.aluminum_color_id,
        color_code: row.color_code,
        quantity: canonicalToDisplay(onHandCanonical, canonicalUnit),
        canonical_quantity: onHandCanonical,
        canonical_unit: canonicalUnit,
        package_quantity: Number(row.on_hand_bars || 0),
        purchase_unit: row.purchase_unit,
        stock_unit: row.stock_unit,
        consumption_unit: row.consumption_unit,
        sale_unit: row.sale_unit,
        nominal_length_mm: row.nominal_length_mm,
        weight_per_meter_kg: row.weight_per_meter_kg,
        weight_per_bar_kg: row.weight_per_bar_kg,
        on_hand_bars: row.on_hand_bars,
        on_hand_meters: row.on_hand_meters,
        on_hand_kg: row.on_hand_kg,
        average_unit_cost: row.average_cost_per_canonical,
        inventory_value: row.inventory_value,
        unit_status: row.legacy_status as StockItem['unit_status'],
        reserved_quantity: canonicalToDisplay(reservedCanonical, canonicalUnit),
        reserved_canonical: reservedCanonical,
        available_canonical: Number(row.available_canonical || 0),
        min_quantity: 0,
        location: null,
        is_active: row.item_active,
        allow_fractional: row.physical_dimension !== 'COUNT',
        updated_at: new Date().toISOString(),
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
      .select('id, name, type, unit, image_url, linha, category_id, line_id, default_price, default_cost, default_sale_price, bar_length_mm, weight_per_meter, weight_per_bar')
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

  async toggleActive(companyItemId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('company_items')
      .update({ is_active: isActive })
      .eq('id', companyItemId);

    if (error) throw error;
  },

  async fetchAluminumColors() {
    const { data, error } = await supabase
      .from('admin_aluminum_colors')
      .select('id, name, slug, hex_color, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data || [];
  },

  async setProfileVariantActive(params: {
    companyId: string;
    companyItemId: string;
    colorId: string;
    active: boolean;
    cost?: number;
    salePrice?: number;
  }) {
    const { data, error } = await supabase.rpc('set_company_profile_variant_active', {
      _company_id: params.companyId,
      _company_item_id: params.companyItemId,
      _aluminum_color_id: params.colorId,
      _is_active: params.active,
      _cost: params.cost,
      _sale_price: params.salePrice,
    });
    if (error) throw error;
    return data;
  }
};

