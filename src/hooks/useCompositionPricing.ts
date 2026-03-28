import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calculatePricing, DEFAULT_PRICING_POLICY, type CompositionItemInput, type PricingInput } from '@/utils/pricingEngine';

interface UseCompositionPricingOptions {
  companyProductId?: string;
  width: number; // mm
  height: number; // mm
  quantity: number;
  enabled?: boolean;
  excludeOptionalIds?: string[];
}

export function useCompositionPricing({
  companyProductId,
  width,
  height,
  quantity,
  enabled = true,
  excludeOptionalIds = [],
}: UseCompositionPricingOptions) {
  const { currentCompany } = useAuth();

  // 1. Fetch composition items (including is_optional)
  const { data: compositionItems } = useQuery({
    queryKey: ['composition-for-pricing', companyProductId],
    queryFn: async () => {
      if (!companyProductId) return null;
      const { data, error } = await supabase
        .from('company_product_items')
        .select(`
          id, quantity_formula, width_formula, height_formula, pieces_quantity, cut_angle, is_optional, section,
          item_template:item_templates(id, name, type, unit, bar_length_mm, weight_per_bar, weight_per_meter),
          company_item:company_items(id, name, type, unit, cost, cost_per_bar, cost_per_kg, cost_per_meter, bar_length_mm, weight_kg, weight_per_meter)
        `)
        .eq('company_product_id', companyProductId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!companyProductId && enabled,
    staleTime: 60_000,
  });

  // 2. For items that have item_template but no company_item, fetch company_items by template
  const missingTemplateIds = useMemo(() => {
    if (!compositionItems || !currentCompany?.id) return [];
    return compositionItems
      .filter(ci => !ci.company_item && ci.item_template?.id)
      .map(ci => ci.item_template!.id);
  }, [compositionItems, currentCompany?.id]);

  const { data: fallbackCompanyItems } = useQuery({
    queryKey: ['fallback-company-items', currentCompany?.id, missingTemplateIds],
    queryFn: async () => {
      if (!currentCompany?.id || missingTemplateIds.length === 0) return [];
      const { data } = await supabase
        .from('company_items')
        .select('id, item_template_id, cost, cost_per_bar, cost_per_kg, cost_per_meter, bar_length_mm, weight_kg, weight_per_meter')
        .eq('company_id', currentCompany.id)
        .in('item_template_id', missingTemplateIds);
      return data || [];
    },
    enabled: !!currentCompany?.id && missingTemplateIds.length > 0,
    staleTime: 60_000,
  });

  // 3. Identify optional items for UI
  const optionalItems = useMemo(() => {
    if (!compositionItems) return [];
    return compositionItems
      .filter(ci => ci.is_optional)
      .map(ci => {
        const info = ci.company_item || ci.item_template;
        return {
          id: ci.id,
          name: (info as any)?.name || 'Item',
          type: (info as any)?.type || 'component',
        };
      });
  }, [compositionItems]);

  // 4. Calculate pricing (filtering out excluded optional items)
  const result = useMemo(() => {
    if (!compositionItems || compositionItems.length === 0 || !width || !height) return null;

    const filteredItems = compositionItems.filter(ci => {
      if (ci.is_optional && excludeOptionalIds.includes(ci.id)) return false;
      return true;
    });

    const inputs: CompositionItemInput[] = filteredItems.map(ci => {
      const tpl = ci.item_template;
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

    const pricingInput: PricingInput = {
      vaoLargura: width,
      vaoAltura: height,
      quantity: quantity || 1,
    };

    try {
      return calculatePricing(inputs, pricingInput, DEFAULT_PRICING_POLICY, 0);
    } catch {
      return null;
    }
  }, [compositionItems, fallbackCompanyItems, width, height, quantity, excludeOptionalIds]);

  const hasComposition = !!compositionItems && compositionItems.length > 0;
  const compositionCostPerUnit = result ? result.totalCost / (quantity || 1) : 0;
  const compositionCostPerSqm = result?.costPerSqm ?? 0;

  return {
    hasComposition,
    compositionCostPerUnit,
    compositionCostPerSqm,
    totalCost: result?.totalCost ?? 0,
    costByType: result?.costByType ?? {},
    items: result?.items ?? [],
    isReady: hasComposition && !!result,
    optionalItems,
  };
}
