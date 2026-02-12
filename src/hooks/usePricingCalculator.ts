import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// Templates-based pricing - no auth required
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';

export interface PricingProduct {
  id: string;
  commercial_name: string;
  category: string | null;
  linha: string | null;
  image_url: string | null;
  price_per_sqm: number | null;
  cost_per_sqm: number | null;
  base_price: number | null;
  pricing_type: string;
  uses_glass: boolean | null;
  product_template_id: string | null;
}

export interface PricingComponent {
  id: string;
  itemName: string;
  itemType: string;
  unit: string;
  quantityFormula: string;
  widthFormula: string | null;
  heightFormula: string | null;
  piecesQuantity: number;
  cutAngle: number | null;
  notes: string | null;
  unitCost: number;
  unitPrice: number;
  // Calculated
  calculatedQuantity: number;
  calculatedLength: number;
  totalCost: number;
  totalPrice: number;
}

export interface PricingSummary {
  components: PricingComponent[];
  totalComponentCost: number;
  totalComponentPrice: number;
  areaM2: number;
  costPerSqm: number;
  pricePerSqm: number;
  margin: number;
  marginPercent: number;
}

export function usePricingProducts() {
  return useQuery({
    queryKey: ['pricing-template-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('id, name, category, linha, image_url, base_price, is_active')
        .eq('is_active', true)
        .order('linha')
        .order('name');
      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        commercial_name: t.name,
        category: t.category,
        linha: t.linha,
        image_url: t.image_url,
        price_per_sqm: null,
        cost_per_sqm: null,
        base_price: t.base_price,
        pricing_type: 'sqm',
        uses_glass: true,
        product_template_id: t.id,
      })) as PricingProduct[];
    },
  });
}

export function usePricingComponents(templateProductId: string | null) {
  return useQuery({
    queryKey: ['pricing-template-components', templateProductId],
    queryFn: async () => {
      if (!templateProductId) return [];
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          id,
          quantity_formula,
          width_formula,
          height_formula,
          pieces_quantity,
          cut_angle,
          notes,
          item_template:item_templates(id, name, type, unit, default_price)
        `)
        .eq('product_template_id', templateProductId)
        .is('company_id', null);
      if (error) throw error;
      // Map to expected format for useCalculatePricing
      return (data || []).map(d => ({
        ...d,
        sort_order: 0,
        company_item: null,
      }));
    },
    enabled: !!templateProductId,
  });
}

/** costOverrides: Record<componentId, overriddenUnitCost> */
export function useCalculatePricing(
  components: any[] | undefined,
  width: number,
  height: number,
  quantity: number,
  costOverrides?: Record<string, number>
): PricingSummary {
  return useMemo(() => {
    if (!components || components.length === 0) {
      return {
        components: [],
        totalComponentCost: 0,
        totalComponentPrice: 0,
        areaM2: 0,
        costPerSqm: 0,
        pricePerSqm: 0,
        margin: 0,
        marginPercent: 0,
      };
    }

    const areaM2 = (width * height) / 1_000_000;

    const calculated: PricingComponent[] = components.map(comp => {
      const item = comp.company_item || comp.item_template;
      const itemName = item?.name || 'Item desconhecido';
      const itemType = item?.type || 'accessory';
      const unit = item?.unit || 'un';
      
      // Use override if provided, otherwise use original cost
      const originalCost = comp.company_item?.cost ?? 0;
      const unitCost = costOverrides && costOverrides[comp.id] !== undefined
        ? costOverrides[comp.id]
        : originalCost;
      const unitPrice = comp.company_item?.sale_price ?? comp.item_template?.default_price ?? 0;

      const piecesQty = comp.pieces_quantity || 1;
      const quantityFormula = comp.quantity_formula || '1';
      const widthF = comp.width_formula;
      const heightF = comp.height_formula;

      let calculatedLength = 0;
      let calculatedQuantity = piecesQty * quantity;

      if (itemType === 'glass') {
        const calcW = evaluateFormula(widthF || 'Largura', width, height);
        const calcH = evaluateFormula(heightF || 'Altura', width, height);
        const glassAreaM2 = (calcW * calcH) / 1_000_000;
        calculatedLength = calcW;
        const totalCost = unitCost * glassAreaM2 * calculatedQuantity;
        const totalPrice = unitPrice * glassAreaM2 * calculatedQuantity;

        return {
          id: comp.id,
          itemName,
          itemType,
          unit: 'm²',
          quantityFormula,
          widthFormula: widthF,
          heightFormula: heightF,
          piecesQuantity: piecesQty,
          cutAngle: comp.cut_angle,
          notes: comp.notes,
          unitCost,
          unitPrice,
          calculatedQuantity,
          calculatedLength: glassAreaM2,
          totalCost,
          totalPrice,
        };
      } else if (itemType === 'profile') {
        if (heightF) {
          calculatedLength = evaluateFormula(heightF, width, height);
        } else if (widthF) {
          calculatedLength = evaluateFormula(widthF, width, height);
        } else {
          calculatedLength = evaluateFormula(quantityFormula, width, height);
        }
        
        const lengthM = calculatedLength / 1000;
        const totalCost = unitCost * lengthM * calculatedQuantity;
        const totalPrice = unitPrice * lengthM * calculatedQuantity;

        return {
          id: comp.id,
          itemName,
          itemType,
          unit: 'm',
          quantityFormula,
          widthFormula: widthF,
          heightFormula: heightF,
          piecesQuantity: piecesQty,
          cutAngle: comp.cut_angle,
          notes: comp.notes,
          unitCost,
          unitPrice,
          calculatedQuantity,
          calculatedLength,
          totalCost,
          totalPrice,
        };
      } else {
        const totalCost = unitCost * calculatedQuantity;
        const totalPrice = unitPrice * calculatedQuantity;

        return {
          id: comp.id,
          itemName,
          itemType,
          unit,
          quantityFormula,
          widthFormula: widthF,
          heightFormula: heightF,
          piecesQuantity: piecesQty,
          cutAngle: comp.cut_angle,
          notes: comp.notes,
          unitCost,
          unitPrice,
          calculatedQuantity,
          calculatedLength: 0,
          totalCost,
          totalPrice,
        };
      }
    });

    const totalComponentCost = calculated.reduce((sum, c) => sum + c.totalCost, 0);
    const totalComponentPrice = calculated.reduce((sum, c) => sum + c.totalPrice, 0);
    const costPerSqm = areaM2 > 0 ? totalComponentCost / (areaM2 * quantity) : 0;
    const pricePerSqm = areaM2 > 0 ? totalComponentPrice / (areaM2 * quantity) : 0;
    const margin = totalComponentPrice - totalComponentCost;
    const marginPercent = totalComponentCost > 0 ? (margin / totalComponentCost) * 100 : 0;

    return {
      components: calculated,
      totalComponentCost,
      totalComponentPrice,
      areaM2,
      costPerSqm,
      pricePerSqm,
      margin,
      marginPercent,
    };
  }, [components, width, height, quantity, costOverrides]);
}
