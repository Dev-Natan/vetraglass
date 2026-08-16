import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula } from './safeFormulaEvaluator';

interface OSItemForConsumption {
  id: string;
  os_id: string;
  product_name: string;
  largura_producao: number;
  altura_producao: number;
  width_production_b?: number | null;
  height_production_b?: number | null;
  quantity: number;
  product_id?: string | null;
  quote_item_id?: string | null;
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
  quote_item_id: string | null;
  os_item_id?: string | null;
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
 * Generates material consumption records for an OS using production dimensions from os_items
 */
export async function generateMaterialConsumption(
  ordemServicoId: string,
  companyId: string,
  osItems: OSItemForConsumption[]
): Promise<{ success: boolean; recordsCreated: number; error?: string }> {
  try {
    const consumptionRecords: MaterialConsumptionInsert[] = [];

    for (const item of osItems) {
      if (!item.product_id) continue;

      const width = item.largura_producao || 0;
      const height = item.altura_producao || 0;
      const width_b = item.width_production_b || width;
      const height_b = item.height_production_b || height;
      const qty = item.quantity || 1;
      
      const { data: templateData } = await supabase
        .from('product_templates')
        .select('has_multiple_sides')
        .eq('id', item.product_id)
        .maybeSingle();
      const hasMultipleSides = !!templateData?.has_multiple_sides;

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
          calculation_type,
          applies_to,
          item_templates (
            id,
            name,
            type,
            unit
          )
        `)
        .eq('product_template_id', item.product_id)
        .is('company_id', null);

      if (tempError) continue;

      const composition = (templateComposition || []).map(t => ({
        ...(t as object),
        company_item_id: null,
        company_items: null,
      })) as unknown as ProductCompositionItem[];

      for (const component of composition) {
        const itemInfo = component.company_items || component.item_templates;
        if (!itemInfo) continue;

        let resolvedCompanyItemId = component.company_item_id;
        if (!resolvedCompanyItemId && component.item_template_id) {
          const { data: companyItem } = await supabase
            .from('company_items')
            .select('id')
            .eq('company_id', companyId)
            .eq('item_template_id', component.item_template_id)
            .maybeSingle();
          if (companyItem) resolvedCompanyItemId = companyItem.id;
        }

        const contextsToProcess: { side: string | null }[] = [];
        const appliesTo = component.applies_to || 'side';

        if (appliesTo === 'side' && hasMultipleSides) {
          if (component.side === 'B') contextsToProcess.push({ side: 'B' });
          else if (component.side === 'Ambos') contextsToProcess.push({ side: 'A' }, { side: 'B' });
          else if (!component.side || component.side === 'A') contextsToProcess.push({ side: 'A' });
        } else {
          contextsToProcess.push({ side: null });
        }

        for (const context of contextsToProcess) {
          const currentSide = context.side;
          const formulaContext = { width, height, widthB: width_b, heightB: height_b };

          let multiplier = 1;
          const calcType = component.calculation_type || 'formula';
          if (calcType === 'fixed') multiplier = 1;

          const piecesQty = component.pieces_quantity || 1;
          let calculatedQty = piecesQty * qty * multiplier;

          if (component.quantity_formula && component.quantity_formula !== '1') {
            const formulaResult = evaluateFormula(component.quantity_formula, formulaContext, undefined, currentSide as any);
            if (formulaResult > 0) {
              if (itemInfo.unit === 'm' || itemInfo.unit === 'metro' || itemInfo.unit === 'metros') {
                calculatedQty = (formulaResult / 1000) * piecesQty * qty * multiplier;
              } else if (itemInfo.unit === 'm²' || itemInfo.unit === 'm2') {
                calculatedQty = (formulaResult / 1000000) * piecesQty * qty * multiplier;
              } else {
                calculatedQty = formulaResult * piecesQty * qty * multiplier;
              }
            }
          }

          if (calculatedQty <= 0) continue;

          consumptionRecords.push({
            company_id: companyId,
            ordem_servico_id: ordemServicoId,
            quote_item_id: item.quote_item_id || null,
            os_item_id: item.id,
            company_item_id: resolvedCompanyItemId,
            item_template_id: component.item_template_id,
            item_name: itemInfo.name + (currentSide ? ` (Lado ${currentSide})` : ''),
            item_type: itemInfo.type,
            unit: itemInfo.unit,
            quantity_calculated: Math.round(calculatedQty * 1000) / 1000,
            formula_used: component.quantity_formula || null,
            input_width: currentSide === 'B' ? width_b : width,
            input_height: currentSide === 'B' ? height_b : height,
            input_quantity: qty,
            status: 'pending',
          });
        }
      }
    }

    if (consumptionRecords.length > 0) {
      await supabase.from('material_consumption').insert(consumptionRecords);
    }

    return { success: true, recordsCreated: consumptionRecords.length };
  } catch (error) {
    console.error('Error generating material consumption:', error);
    return { success: false, recordsCreated: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function linkReservationsToConsumption(ordemServicoId: string): Promise<{ success: boolean; linked: number }> {
  try {
    const { data: reservations } = await supabase.from('stock_reservations').select('id, company_item_id').eq('ordem_servico_id', ordemServicoId).eq('status', 'reserved');
    if (!reservations) return { success: false, linked: 0 };
    let linkedCount = 0;
    for (const reservation of reservations) {
      const { error } = await supabase.from('material_consumption').update({ stock_reservation_id: reservation.id }).eq('ordem_servico_id', ordemServicoId).eq('company_item_id', reservation.company_item_id).is('stock_reservation_id', null);
      if (!error) linkedCount++;
    }
    return { success: true, linked: linkedCount };
  } catch (error) {
    return { success: false, linked: 0 };
  }
}

export async function releaseMaterialsForProduction(ordemServicoId: string): Promise<{ success: boolean; released: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('release_materials_for_production', { _ordem_servico_id: ordemServicoId });
    if (error) return { success: false, released: 0, error: error.message };
    const payload = (data ?? {}) as { consumed?: number };
    return { success: true, released: Number(payload.consumed) || 0 };
  } catch (error) {
    return { success: false, released: 0, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Reserva materiais no estoque quando um orçamento vira OS.
 * Não baixa o estoque físico. A reserva é persistida somente em stock_reservations.
 */
export async function reserveMaterialsForOS(ordemServicoId: string): Promise<{ success: boolean; reserved: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('reserve_os_materials', { _ordem_servico_id: ordemServicoId });
    if (error) return { success: false, reserved: 0, error: error.message };
    const payload = (data ?? {}) as { reserved?: number };
    return { success: true, reserved: Number(payload.reserved) || 0 };
  } catch (error) {
    return { success: false, reserved: 0, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

export async function cancelMaterialConsumption(ordemServicoId: string): Promise<{ success: boolean; cancelled: number }> {
  try {
    const { data, error } = await supabase.rpc('cancel_os_materials', { _ordem_servico_id: ordemServicoId });
    if (error) return { success: false, cancelled: 0 };
    return { success: true, cancelled: Number(data) || 0 };
  } catch (error) {
    return { success: false, cancelled: 0 };
  }
}
