import { supabase } from '@/integrations/supabase/client';
import { calculatePricing, DEFAULT_PRICING_POLICY, type CompositionItemInput, type PricingInput } from '@/utils/pricingEngine';

/**
 * Recalculates and updates the price of a single product based on its composition and current item prices.
 */
export async function recalculateProductPrice(productId: string) {
  // 1. Fetch product basic info
  const { data: product, error: productError } = await supabase
    .from('company_products')
    .select('id, margin_percent, company_id')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    console.error('Error fetching product for recalculation:', productError);
    return;
  }

  // 2. Fetch composition items
  const { data: compositionItems, error: itemsError } = await supabase
    .from('company_product_items')
    .select(`
      id, quantity_formula, width_formula, height_formula, pieces_quantity, cut_angle, is_optional, section,
      item_template:item_templates(id, name, type, unit, bar_length_mm, weight_per_bar, weight_per_meter),
      company_item:company_items(id, name, type, unit, cost, cost_per_bar, cost_per_kg, cost_per_meter, bar_length_mm, weight_kg, weight_per_meter)
    `)
    .eq('company_product_id', productId);

  if (itemsError || !compositionItems) {
    console.error('Error fetching composition items:', itemsError);
    return;
  }

  if (compositionItems.length === 0) return;

  // 3. For items missing company_item info, fetch from the company's shared stock items
  const missingTemplateIds = compositionItems
    .filter(ci => !ci.company_item && ci.item_template?.id)
    .map(ci => ci.item_template!.id);

  let fallbackCompanyItems: any[] = [];
  if (missingTemplateIds.length > 0) {
    const { data } = await supabase
      .from('company_items')
      .select('id, item_template_id, cost, cost_per_bar, cost_per_kg, cost_per_meter, bar_length_mm, weight_kg, weight_per_meter')
      .eq('company_id', product.company_id)
      .in('item_template_id', missingTemplateIds);
    fallbackCompanyItems = data || [];
  }

  // 4. Prepare inputs for pricing engine
  const compositionInputs: CompositionItemInput[] = compositionItems.map(ci => {
    const tpl = ci.item_template as any;
    const compItem = ci.company_item || fallbackCompanyItems?.find(f => f.item_template_id === tpl?.id);
    const itemType = (tpl?.type || (compItem as any)?.type || 'accessory') as CompositionItemInput['itemType'];

    return {
      id: ci.id,
      itemName: tpl?.name || (compItem as any)?.name || 'Item',
      itemType,
      unit: tpl?.unit || (compItem as any)?.unit || 'un',
      imageUrl: null,
      widthFormula: ci.width_formula,
      heightFormula: ci.quantity_formula,
      quantityFormula: ci.quantity_formula,
      piecesQuantity: ci.pieces_quantity || 1,
      cutAngle: ci.cut_angle,
      lossPercent: 0,
      barLengthMm: compItem?.bar_length_mm || tpl?.bar_length_mm || 6000,
      weightPerMeter: compItem?.weight_per_meter || tpl?.weight_per_meter || (tpl as any)?.weight_per_bar ? ((tpl as any).weight_per_bar / ((tpl?.bar_length_mm || 6000) / 1000)) : 0,
      costPerBar: compItem?.cost_per_bar || 0,
      costPerKg: compItem?.cost_per_kg || 0,
      costPerMeter: compItem?.cost_per_meter || 0,
      costPerUnit: compItem?.cost || 0,
    };
  });

  // Reference size for m² price calculation: 1000x1000mm
  const pricingInput: PricingInput = {
    vaoLargura: 1000,
    vaoAltura: 1000,
    quantity: 1,
  };

  const margin = product.margin_percent ?? 30;

  try {
    const result = calculatePricing(compositionInputs, pricingInput, DEFAULT_PRICING_POLICY, margin);
    
    // 5. Update company_products with new costs/prices
    const { error: updateError } = await supabase
      .from('company_products')
      .update({
        cost_per_sqm: result.costPerSqm,
        price_per_sqm: result.pricePerSqm,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId);

    if (updateError) {
      console.error('Error updating product price:', updateError);
    }
  } catch (e) {
    console.error('Recalculation error for product', productId, e);
  }
}

/**
 * Recalculates prices for all products that use a specific item.
 */
export async function recalculatePricesForProductsWithItem(itemTemplateId: string | null, companyItemId: string | null) {
  if (!itemTemplateId && !companyItemId) return;

  // 1. Get all products that use this item
  let query = supabase
    .from('company_product_items')
    .select('company_product_id');
  
  if (companyItemId) {
    query = query.eq('company_item_id', companyItemId);
  } else if (itemTemplateId) {
    query = query.eq('item_template_id', itemTemplateId);
  }

  const { data: productRefs, error: refError } = await query;
  if (refError || !productRefs) {
    console.error('Error finding products using item:', refError);
    return;
  }

  const productIds = Array.from(new Set(productRefs.map(r => r.company_product_id)));
  if (productIds.length === 0) return;

  console.log(`Recalculating prices for ${productIds.length} products...`);

  // 2. Recalculate each product (chunked to avoid hitting rate limits or blocking)
  const CHUNK_SIZE = 5;
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(pid => recalculateProductPrice(pid)));
  }
}
