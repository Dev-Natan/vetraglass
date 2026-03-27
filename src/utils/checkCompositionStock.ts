/**
 * Check stock availability for ALL composition items of products in a quote.
 * Evaluates formulas to calculate needed quantities, then compares with current stock.
 */

import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula } from './safeFormulaEvaluator';

export interface CompositionStockItem {
  id: string;
  itemName: string;
  itemType: string; // profile, glass, component, accessory, etc.
  unit: string;
  quantityNeeded: number;
  quantityInStock: number;
  quantityReserved: number;
  quantityAvailable: number;
  origin: 'stock' | 'purchase' | 'mixed';
  shortfall: number; // how much is missing
  companyItemId: string | null;
  itemTemplateId: string | null;
  quoteItemDescription: string;
}

export interface CompositionStockResult {
  items: CompositionStockItem[];
  hasShortage: boolean;
  shortageCount: number;
  totalItems: number;
}

interface QuoteItemInput {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  company_product_id?: string | null;
  product_template_id?: string | null;
}

/**
 * Check stock availability for all composition items across all quote items
 */
export async function checkCompositionStockAvailability(
  companyId: string,
  quoteItems: QuoteItemInput[]
): Promise<CompositionStockResult> {
  const aggregatedNeeds = new Map<string, {
    itemName: string;
    itemType: string;
    unit: string;
    quantityNeeded: number;
    companyItemId: string | null;
    itemTemplateId: string | null;
    quoteItemDescriptions: string[];
  }>();

  for (const quoteItem of quoteItems) {
    if (!quoteItem.company_product_id && !quoteItem.product_template_id) continue;

    const width = quoteItem.width || 0;
    const height = quoteItem.height || 0;
    const qty = quoteItem.quantity || 1;

    // Fetch composition
    let composition: any[] = [];

    if (quoteItem.company_product_id) {
      const { data } = await supabase
        .from('company_product_items')
        .select(`
          id,
          company_item_id,
          item_template_id,
          quantity_formula,
          width_formula,
          height_formula,
          pieces_quantity,
          company_items (id, name, type, unit),
          item_templates (id, name, type, unit)
        `)
        .eq('company_product_id', quoteItem.company_product_id);
      composition = data || [];
    } else if (quoteItem.product_template_id) {
      const { data } = await supabase
        .from('product_template_items')
        .select(`
          id,
          item_template_id,
          quantity_formula,
          width_formula,
          height_formula,
          pieces_quantity,
          item_templates (id, name, type, unit)
        `)
        .eq('product_template_id', quoteItem.product_template_id)
        .is('company_id', null);
      composition = (data || []).map(t => ({ ...t, company_item_id: null, company_items: null }));
    }

    for (const component of composition) {
      const itemInfo = component.company_items || component.item_templates;
      if (!itemInfo) continue;

      // Resolve company_item_id
      let companyItemId = component.company_item_id;
      let itemTemplateId = component.item_template_id;

      if (!companyItemId && itemTemplateId) {
        const { data: ci } = await supabase
          .from('company_items')
          .select('id')
          .eq('company_id', companyId)
          .eq('item_template_id', itemTemplateId)
          .maybeSingle();
        if (ci) companyItemId = ci.id;
      }

      // Calculate quantity needed
      const piecesQty = component.pieces_quantity || 1;
      let calculatedQty = piecesQty * qty;

      if (component.quantity_formula && component.quantity_formula.trim() !== '' && component.quantity_formula !== '1') {
        const formulaResult = evaluateFormula(component.quantity_formula, width, height);
        if (formulaResult > 0) {
          if (itemInfo.unit === 'm' || itemInfo.unit === 'metro' || itemInfo.unit === 'metros') {
            calculatedQty = (formulaResult / 1000) * piecesQty * qty;
          } else if (itemInfo.unit === 'm²' || itemInfo.unit === 'm2') {
            calculatedQty = ((width * height) / 1000000) * piecesQty * qty;
          } else {
            calculatedQty = formulaResult * piecesQty * qty;
          }
        }
      }

      if (calculatedQty <= 0) continue;

      // Aggregate by item key
      const key = companyItemId || itemTemplateId || itemInfo.name;
      const existing = aggregatedNeeds.get(key);
      if (existing) {
        existing.quantityNeeded += calculatedQty;
        if (!existing.quoteItemDescriptions.includes(quoteItem.description)) {
          existing.quoteItemDescriptions.push(quoteItem.description);
        }
      } else {
        aggregatedNeeds.set(key, {
          itemName: itemInfo.name,
          itemType: itemInfo.type,
          unit: itemInfo.unit,
          quantityNeeded: calculatedQty,
          companyItemId,
          itemTemplateId,
          quoteItemDescriptions: [quoteItem.description],
        });
      }
    }
  }

  // Now check stock for each aggregated need
  const items: CompositionStockItem[] = [];

  for (const [key, need] of aggregatedNeeds) {
    let stockQty = 0;
    let reservedQty = 0;

    if (need.companyItemId) {
      const { data: stock } = await supabase
        .from('company_stock')
        .select('quantity')
        .eq('company_item_id', need.companyItemId)
        .maybeSingle();
      stockQty = stock?.quantity || 0;

      // Check active reservations
      const { data: reservations } = await supabase
        .from('stock_reservations')
        .select('quantity_reserved')
        .eq('company_item_id', need.companyItemId)
        .eq('status', 'reserved');
      reservedQty = reservations?.reduce((sum, r) => sum + (r.quantity_reserved || 0), 0) || 0;
    } else if (need.itemTemplateId) {
      const { data: stock } = await supabase
        .from('company_stock')
        .select('quantity')
        .eq('company_id', companyId)
        .eq('item_template_id', need.itemTemplateId)
        .maybeSingle();
      stockQty = stock?.quantity || 0;
    }

    const available = Math.max(0, stockQty - reservedQty);
    const shortfall = Math.max(0, need.quantityNeeded - available);
    const useFromStock = Math.min(available, need.quantityNeeded);

    let origin: 'stock' | 'purchase' | 'mixed';
    if (shortfall === 0) origin = 'stock';
    else if (useFromStock === 0) origin = 'purchase';
    else origin = 'mixed';

    items.push({
      id: key,
      itemName: need.itemName,
      itemType: need.itemType,
      unit: need.unit,
      quantityNeeded: Math.round(need.quantityNeeded * 1000) / 1000,
      quantityInStock: stockQty,
      quantityReserved: reservedQty,
      quantityAvailable: available,
      origin,
      shortfall: Math.round(shortfall * 1000) / 1000,
      companyItemId: need.companyItemId,
      itemTemplateId: need.itemTemplateId,
      quoteItemDescription: need.quoteItemDescriptions.join(', '),
    });
  }

  // Sort: shortages first, then by type
  items.sort((a, b) => {
    if (a.shortfall > 0 && b.shortfall === 0) return -1;
    if (a.shortfall === 0 && b.shortfall > 0) return 1;
    return a.itemType.localeCompare(b.itemType) || a.itemName.localeCompare(b.itemName);
  });

  const shortageCount = items.filter(i => i.shortfall > 0).length;

  return {
    items,
    hasShortage: shortageCount > 0,
    shortageCount,
    totalItems: items.length,
  };
}
