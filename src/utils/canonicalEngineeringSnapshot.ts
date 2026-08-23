import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

export type FulfillmentMode = 'IMMEDIATE' | 'PRODUCTION' | 'SERVICE';

export interface CanonicalEngineeringSnapshot {
  composition_mode: 'fixed' | 'parametric';
  fulfillment_mode: FulfillmentMode;
  engine_version: number;
  snapshot_version: number;
  inputs: Record<string, Json | undefined>;
  variants: Record<string, Json | undefined>;
  materials: Json[];
  glass_pieces: Json[];
  cuts: Json[];
  rules: Json[];
  rule_versions: Json[];
  items: Json[];
  totals: Record<string, Json | undefined>;
  warnings: Json[];
  frozen_at: string;
}
const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export async function buildImmediateItemSnapshot(params: {
  companyId: string;
  itemTemplateId: string;
  quantity: number;
  width?: number;
  height?: number;
}): Promise<CanonicalEngineeringSnapshot> {
  const [{ data: companyItem, error: itemError }, { data: price, error: priceError }] = await Promise.all([
    supabase
      .from('company_items')
      .select('id, item_template_id, name, type, unit')
      .eq('company_id', params.companyId)
      .eq('item_template_id', params.itemTemplateId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('company_item_prices')
      .select('price, cost')
      .eq('company_id', params.companyId)
      .eq('item_template_id', params.itemTemplateId)
      .maybeSingle(),
  ]);
  if (itemError) throw itemError;
  if (priceError) throw priceError;
  if (!companyItem) throw new Error('MISSING_COMPANY_ITEM');
  if (!price) throw new Error('MISSING_PRICE');

  const width = Number(params.width || 0);
  const height = Number(params.height || 0);
  let stockQuantity = params.quantity;
  if (companyItem.unit === 'm²' || companyItem.unit === 'm2') {
    if (width <= 0 || height <= 0) throw new Error('INVALID_ENGINEERING_RULE');
    stockQuantity = (width * height * params.quantity) / 1_000_000;
  } else if (['m', 'ml', 'metro', 'metros'].includes(companyItem.unit)) {
    if (Math.max(width, height) <= 0) throw new Error('INVALID_ENGINEERING_RULE');
    stockQuantity = (Math.max(width, height) * params.quantity) / 1000;
  }
  stockQuantity = roundQuantity(stockQuantity);
  const cost = roundQuantity(stockQuantity * Number(price.cost ?? 0));
  const salePrice = roundQuantity(stockQuantity * Number(price.price));
  const fulfillmentMode: FulfillmentMode = companyItem.type === 'service' ? 'SERVICE' : 'IMMEDIATE';

  return {
    composition_mode: 'fixed',
    fulfillment_mode: fulfillmentMode,
    engine_version: 2,
    snapshot_version: 2,
    inputs: {
      VW: width || null,
      VH: height || null,
      L: width || null,
      A: height || null,
      width_mm: width || null,
      height_mm: height || null,
      quantity: params.quantity,
      variants: {},
    },
    variants: {},
    materials: fulfillmentMode === 'SERVICE' ? [] : [{
      key: companyItem.id,
      item_template_id: companyItem.item_template_id,
      company_item_id: companyItem.id,
      item_name: companyItem.name,
      material_type: companyItem.type,
      unit: companyItem.unit,
      quantity: stockQuantity,
      cost,
      sale_price: salePrice,
      supply_mode: 'INTERNAL_STOCK',
    }],
    glass_pieces: [],
    cuts: [],
    rules: [],
    rule_versions: [],
    items: [],
    totals: {
      cost,
      sale_price: salePrice,
      margin: roundQuantity(salePrice - cost),
      missing_cost_items: 0,
      missing_price_items: 0,
    },
    warnings: [],
    frozen_at: new Date().toISOString(),
  };
}

export const snapshotMaterials = (snapshot: Json | undefined): Json[] => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
  const materials = (snapshot as Record<string, Json>).materials;
  return Array.isArray(materials) ? materials : [];
};
