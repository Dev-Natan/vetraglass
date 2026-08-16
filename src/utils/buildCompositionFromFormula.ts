/**
 * Build the suggested composition (list of stock items + quantities) for a
 * single product being added to a PDV sale. Reuses the same formula logic
 * used by checkCompositionStockAvailability so what the user sees here
 * matches what the system would have deducted automatically.
 */

import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula } from './safeFormulaEvaluator';
import { createUuid } from './createUuid';

export interface SaleCompositionLine {
  /** Stable client-side id for editing */
  id: string;
  companyItemId: string | null;
  itemTemplateId: string | null;
  itemName: string;
  unit: string;
  itemType?: string;
  quantity: number;
  source: 'formula' | 'manual_add' | 'manual_swap';
  stockAvailable?: number;
}

interface BuildParams {
  companyId: string;
  companyProductId?: string;
  productTemplateId?: string;
  width: number;
  height: number;
  widthB?: number;
  heightB?: number;
  quantity: number;
}

export async function buildCompositionFromFormula(
  params: BuildParams,
): Promise<SaleCompositionLine[]> {
  const {
    companyId,
    companyProductId,
    productTemplateId,
    width,
    height,
    widthB = 0,
    heightB = 0,
    quantity,
  } = params;

  if (!companyProductId && !productTemplateId) return [];

  let composition: any[] = [];
  let hasMultipleSides = false;

  if (companyProductId) {
    const { data: productData } = await supabase
      .from('company_products')
      .select('has_multiple_sides')
      .eq('id', companyProductId)
      .maybeSingle();
    hasMultipleSides = !!productData?.has_multiple_sides;

    const { data } = await supabase
      .from('company_product_items')
      .select(`
        id, company_item_id, item_template_id,
        quantity_formula, pieces_quantity, pieces_formula, side,
        company_items (id, name, type, unit),
        item_templates (id, name, type, unit)
      `)
      .eq('company_product_id', companyProductId);
    composition = data || [];
  } else if (productTemplateId) {
    const { data: tpl } = await supabase
      .from('product_templates')
      .select('has_multiple_sides')
      .eq('id', productTemplateId)
      .maybeSingle();
    hasMultipleSides = !!tpl?.has_multiple_sides;

    const { data } = await supabase
      .from('product_template_items')
      .select(`
        id, item_template_id,
        quantity_formula, pieces_quantity, pieces_formula, side,
        item_templates (id, name, type, unit)
      `)
      .eq('product_template_id', productTemplateId)
      .is('company_id', null);
    composition = (data || []).map((t: any) => ({ ...t, company_item_id: null, company_items: null }));
  }

  const aggregated = new Map<string, SaleCompositionLine>();

  for (const component of composition) {
    const info = component.company_items || component.item_templates;
    if (!info) continue;

    let companyItemId: string | null = component.company_item_id;
    const itemTemplateId: string | null = component.item_template_id;

    if (!companyItemId && itemTemplateId) {
      const { data: ci } = await supabase
        .from('company_items')
        .select('id')
        .eq('company_id', companyId)
        .eq('item_template_id', itemTemplateId)
        .maybeSingle();
      if (ci) companyItemId = ci.id;
    }

    const sidesToProcess: (string | null)[] = [];
    if (!hasMultipleSides) sidesToProcess.push(null);
    else if (component.side === 'A') sidesToProcess.push('A');
    else if (component.side === 'B') sidesToProcess.push('B');
    else sidesToProcess.push('A', 'B');

    for (const currentSide of sidesToProcess) {
      const ctx = { width, height, widthB, heightB };
      const piecesQty = component.pieces_formula
        ? evaluateFormula(component.pieces_formula, ctx, undefined, currentSide)
        : (component.pieces_quantity || 1);
      let calc = piecesQty * quantity;

      if (component.quantity_formula && component.quantity_formula.trim() !== '' && component.quantity_formula !== '1') {
        const r = evaluateFormula(component.quantity_formula, ctx, undefined, currentSide);
        if (r > 0) {
          if (info.unit === 'm' || info.unit === 'metro' || info.unit === 'metros') {
            calc = (r / 1000) * piecesQty * quantity;
          } else if (info.unit === 'm²' || info.unit === 'm2') {
            calc = (r / 1000000) * piecesQty * quantity;
          } else {
            calc = r * piecesQty * quantity;
          }
        }
      } else if (info.unit === 'm²' || info.unit === 'm2') {
        const w = currentSide === 'B' ? widthB : width;
        const h = currentSide === 'B' ? heightB : height;
        calc = ((w * h) / 1000000) * piecesQty * quantity;
      }

      if (calc <= 0) continue;

      const key = companyItemId || itemTemplateId || info.name;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity += calc;
      } else {
        aggregated.set(key, {
          id: createUuid(),
          companyItemId,
          itemTemplateId,
          itemName: info.name,
          unit: info.unit,
          itemType: info.type,
          quantity: calc,
          source: 'formula',
        });
      }
    }
  }

  const lines = Array.from(aggregated.values()).map((l) => ({
    ...l,
    quantity: Math.round(l.quantity * 1000) / 1000,
  }));

  // Attach current stock availability
  const ids = lines.map((l) => l.companyItemId).filter(Boolean) as string[];
  if (ids.length > 0) {
    const { data: stocks } = await supabase
      .from('company_stock')
      .select('company_item_id, quantity')
      .in('company_item_id', ids);
    const map = new Map((stocks || []).map((s: any) => [s.company_item_id, s.quantity]));
    lines.forEach((l) => {
      if (l.companyItemId) l.stockAvailable = Number(map.get(l.companyItemId) || 0);
    });
  }

  return lines;
}
