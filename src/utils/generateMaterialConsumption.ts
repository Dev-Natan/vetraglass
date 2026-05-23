/**
 * Material Consumption Generator
 * 
 * Generates material consumption records when a quote is approved.
 * Reads product composition, evaluates formulas, and creates
 * material_consumption entries with status='pending'.
 * 
 * This implements the "APPROVED generates calculation" part of the flow.
 */

import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula } from './safeFormulaEvaluator';

interface QuoteItemForConsumption {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  width_b?: number | null;
  height_b?: number | null;
  width_c?: number | null;
  height_c?: number | null;
  quantity: number;
  leaves_count?: number;
  glasses_count?: number;
  panels_count?: number;
  sides_count?: number;
  company_product_id?: string | null;
  product_template_id?: string | null;
}

interface ProductCompositionItem {
  id: string;
  company_item_id: string | null;
  item_template_id: string | null;
  quantity_formula: string;
  width_formula: string | null;
  height_formula: string | null;
  pieces_quantity: number | null;
  side?: string | null;
  calculation_type?: string | null;
  applies_to?: string | null;
  company_items?: {
    id: string;
    name: string;
    type: string;
    unit: string;
  } | null;
  item_templates?: {
    id: string;
    name: string;
    type: string;
    unit: string;
  } | null;
}

interface MaterialConsumptionInsert {
  company_id: string;
  ordem_servico_id: string;
  quote_item_id: string;
  company_item_id: string | null;
  item_template_id: string | null;
  item_name: string;
  item_type: string;
  unit: string;
  quantity_calculated: number;
  formula_used: string | null;
  input_width: number | null;
  input_height: number | null;
  input_quantity: number;
  status: 'pending';
  stock_reservation_id?: string | null;
}

/**
 * Generates material consumption records for an approved quote/OS
 * 
 * @param ordemServicoId - The ID of the created ordem de serviço
 * @param companyId - The company ID
 * @param quoteItems - The quote items with dimensions
 * @returns Object with success flag and generated records count
 */
export async function generateMaterialConsumption(
  ordemServicoId: string,
  companyId: string,
  quoteItems: QuoteItemForConsumption[]
): Promise<{ success: boolean; recordsCreated: number; error?: string }> {
  try {
    const consumptionRecords: MaterialConsumptionInsert[] = [];

    for (const quoteItem of quoteItems) {
      // Skip items without a product
      if (!quoteItem.company_product_id && !quoteItem.product_template_id) {
        continue;
      }

      const width = quoteItem.width || 0;
      const height = quoteItem.height || 0;
      const width_b = quoteItem.width_b || 0;
      const height_b = quoteItem.height_b || 0;
      const width_c = quoteItem.width_c || 0;
      const height_c = quoteItem.height_c || 0;
      const qty = quoteItem.quantity || 1;
      
      const sides_count = quoteItem.sides_count || 1;
      const leaves_count = quoteItem.leaves_count || 1;
      const glasses_count = quoteItem.glasses_count || 1;
      const panels_count = quoteItem.panels_count || 1;

      // Fetch product composition and info
      let composition: ProductCompositionItem[] = [];
      let hasMultipleSides = false;

      if (quoteItem.company_product_id) {
        // Get product info
        const { data: productData } = await supabase
          .from('company_products')
          .select('has_multiple_sides')
          .eq('id', quoteItem.company_product_id)
          .maybeSingle();
        hasMultipleSides = !!productData?.has_multiple_sides;

        // Get from company_product_items
        const { data: companyComposition, error: compError } = await supabase
          .from('company_product_items')
          .select(`
            id,
            company_item_id,
            item_template_id,
            quantity_formula,
            width_formula,
            height_formula,
            pieces_quantity,
            side,
            company_items (
              id,
              name,
              type,
              unit
            ),
            item_templates (
              id,
              name,
              type,
              unit
            )
          `)
          .eq('company_product_id', quoteItem.company_product_id);

        if (compError) {
          console.error('Error fetching company product composition:', compError);
          continue;
        }

        composition = (companyComposition || []) as ProductCompositionItem[];
      } else if (quoteItem.product_template_id) {
        // Get template info
        const { data: templateData } = await supabase
          .from('product_templates')
          .select('has_multiple_sides')
          .eq('id', quoteItem.product_template_id)
          .maybeSingle();
        hasMultipleSides = !!templateData?.has_multiple_sides;

        // Fallback to product_template_items
        const { data: templateComposition, error: tempError } = await supabase
          .from('product_template_items')
          .select(`
            id,
            item_template_id,
            quantity_formula,
            width_formula,
            height_formula,
            pieces_quantity,
            side,
            item_templates (
              id,
              name,
              type,
              unit
            )
          `)
          .eq('product_template_id', quoteItem.product_template_id)
          .is('company_id', null);

        if (tempError) {
          console.error('Error fetching template composition:', tempError);
          continue;
        }

        // Map to same structure (no company_item_id)
        composition = (templateComposition || []).map(t => ({
          ...t,
          company_item_id: null,
          company_items: null,
        })) as ProductCompositionItem[];
      }

      // Process each component in the composition
      for (const component of composition) {
        // Get item info (prefer company_items over item_templates)
        const itemInfo = component.company_items || component.item_templates;
        if (!itemInfo) continue;

        // Ensure company_item_id is populated when item_template_id exists
        let resolvedCompanyItemId = component.company_item_id;
        if (!resolvedCompanyItemId && component.item_template_id) {
          const { data: companyItem } = await supabase
            .from('company_items')
            .select('id')
            .eq('company_id', companyId)
            .eq('item_template_id', component.item_template_id)
            .maybeSingle();
          
          if (companyItem) {
            resolvedCompanyItemId = companyItem.id;
          }
        }

        // Determine which sides to process
        const sidesToProcess: (string | null)[] = [];
        if (!hasMultipleSides) {
          sidesToProcess.push(null);
        } else if (component.side === 'A' || component.side === 'B') {
          sidesToProcess.push(component.side);
        } else if (component.side === 'Ambos' || !component.side) {
          // Default: Both sides
          sidesToProcess.push('A', 'B');
        } else if (component.side === 'Todos' || component.side === 'Produto') {
          // "Todos" or "Produto" means only one record (unit for whole product)
          sidesToProcess.push(null);
        } else {
          // Fallback for any other value
          sidesToProcess.push(null);
        }

        for (const currentSide of sidesToProcess) {
          const formulaContext = {
            width,
            height,
            widthB: width_b,
            heightB: height_b
          };

          // Evaluate the quantity formula
          const piecesQty = (component as any).pieces_formula 
            ? evaluateFormula((component as any).pieces_formula, formulaContext, undefined, currentSide)
            : (component.pieces_quantity || 1);
          let calculatedQty = piecesQty * qty;

          // If there's a quantity formula, evaluate it
          if (component.quantity_formula && component.quantity_formula.trim() !== '' && component.quantity_formula !== '1') {
            const formulaResult = evaluateFormula(component.quantity_formula, formulaContext, undefined, currentSide);
            if (formulaResult > 0) {
              // For linear items (profiles), result is in mm, convert to meters
              if (itemInfo.unit === 'm' || itemInfo.unit === 'metro' || itemInfo.unit === 'metros') {
                calculatedQty = (formulaResult / 1000) * piecesQty * qty;
              } else if (itemInfo.unit === 'm²' || itemInfo.unit === 'm2') {
                // For area items (glass), result is in mm², convert to m²
                calculatedQty = (formulaResult / 1000000) * piecesQty * qty;
              } else {
                // For units/pieces, use the formula result directly
                calculatedQty = formulaResult * piecesQty * qty;
              }
            }
          } else if (itemInfo.unit === 'm²' || itemInfo.unit === 'm2') {
            // Fallback: if no formula, calculate area based on dimensions (m²)
            const targetWidth = currentSide === 'B' ? width_b : width;
            const targetHeight = currentSide === 'B' ? height_b : height;
            calculatedQty = ((targetWidth * targetHeight) / 1000000) * piecesQty * qty;
          }

          // Skip zero quantities
          if (calculatedQty <= 0) continue;

          consumptionRecords.push({
            company_id: companyId,
            ordem_servico_id: ordemServicoId,
            quote_item_id: quoteItem.id,
            company_item_id: resolvedCompanyItemId,
            item_template_id: component.item_template_id,
            item_name: itemInfo.name + (currentSide ? ` (Lado ${currentSide})` : ''),
            item_type: itemInfo.type,
            unit: itemInfo.unit,
            quantity_calculated: Math.round(calculatedQty * 1000) / 1000, // Round to 3 decimals
            formula_used: component.quantity_formula || null,
            input_width: currentSide === 'B' ? width_b : width,
            input_height: currentSide === 'B' ? height_b : height,
            input_quantity: qty,
            status: 'pending',
          });
        }
      }
    }

    // Batch insert all consumption records
    if (consumptionRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('material_consumption')
        .insert(consumptionRecords);

      if (insertError) {
        console.error('Error inserting material consumption:', insertError);
        return { success: false, recordsCreated: 0, error: insertError.message };
      }
    }

    return { success: true, recordsCreated: consumptionRecords.length };
  } catch (error) {
    console.error('Error generating material consumption:', error);
    return {
      success: false,
      recordsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Links existing stock reservations to material consumption records
 * Call this after both consumption and reservations are created
 */
export async function linkReservationsToConsumption(
  ordemServicoId: string
): Promise<{ success: boolean; linked: number }> {
  try {
    // Get all reservations for this OS
    const { data: reservations, error: resError } = await supabase
      .from('stock_reservations')
      .select('id, company_item_id')
      .eq('ordem_servico_id', ordemServicoId)
      .eq('status', 'reserved');

    if (resError || !reservations) {
      return { success: false, linked: 0 };
    }

    let linkedCount = 0;

    for (const reservation of reservations) {
      // Find matching consumption record
      const { error: updateError } = await supabase
        .from('material_consumption')
        .update({ stock_reservation_id: reservation.id })
        .eq('ordem_servico_id', ordemServicoId)
        .eq('company_item_id', reservation.company_item_id)
        .is('stock_reservation_id', null);

      if (!updateError) {
        linkedCount++;
      }
    }

    return { success: true, linked: linkedCount };
  } catch (error) {
    console.error('Error linking reservations:', error);
    return { success: false, linked: 0 };
  }
}

/**
 * Releases materials for production when OS status changes to in_progress
 * Updates material_consumption status from 'pending' to 'available'
 */
export async function releaseMaterialsForProduction(
  ordemServicoId: string
): Promise<{ success: boolean; released: number }> {
  try {
    const { data, error } = await supabase.rpc('release_materials_for_production', {
      _ordem_servico_id: ordemServicoId,
    });

    if (error) {
      console.error('Error releasing materials:', error);
      return { success: false, released: 0 };
    }

    return { success: true, released: data || 0 };
  } catch (error) {
    console.error('Error releasing materials:', error);
    return { success: false, released: 0 };
  }
}

/**
 * Cancels material consumption when OS is cancelled
 */
export async function cancelMaterialConsumption(
  ordemServicoId: string
): Promise<{ success: boolean; cancelled: number }> {
  try {
    const { data, error } = await supabase.rpc('cancel_os_materials', {
      _ordem_servico_id: ordemServicoId,
    });

    if (error) {
      console.error('Error cancelling materials:', error);
      return { success: false, cancelled: 0 };
    }

    return { success: true, cancelled: data || 0 };
  } catch (error) {
    console.error('Error cancelling materials:', error);
    return { success: false, cancelled: 0 };
  }
}
