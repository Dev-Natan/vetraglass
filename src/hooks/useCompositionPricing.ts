import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calculatePricing, DEFAULT_PRICING_POLICY, type CompositionItemInput, type PricingInput } from '@/utils/pricingEngine';

interface UseCompositionPricingOptions {
  companyProductId?: string;
  width: number; // mm
  height: number; // mm
  widthB?: number;
  heightB?: number;
  leaves_count?: number;
  glasses_count?: number;
  panels_count?: number;
  sides_count?: number;
  quantity: number;
  enabled?: boolean;
  excludeOptionalIds?: string[];
}

export function useCompositionPricing({
  companyProductId,
  width,
  height,
  quantity,
  widthB,
  heightB,
  leaves_count = 1,
  glasses_count = 1,
  panels_count = 1,
  sides_count = 1,
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
          id, quantity_formula, width_formula, height_formula, pieces_quantity, cut_angle, is_optional, section, side, calculation_type, applies_to,
          item_template:item_templates(id, name, type, unit, bar_length_mm, weight_per_bar, weight_per_meter),
          company_item:company_items(id, name, type, unit, cost, cost_per_bar, cost_per_kg, cost_per_meter, bar_length_mm, weight_kg, weight_per_meter, altura_mm, largura_mm, comprimento_linear_mm, preco_unitario)
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
        side: ci.side,
        calculation_type: ci.calculation_type as any,
        applies_to: ci.applies_to as any,
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
      vaoLarguraB: widthB,
      vaoAlturaB: heightB,
      quantity: quantity || 1,
      leaves_count,
      glasses_count,
      panels_count,
      sides_count,
    };

    try {
      return calculatePricing(inputs, pricingInput, DEFAULT_PRICING_POLICY, 0);
    } catch {
      return null;
    }
  }, [compositionItems, fallbackCompanyItems, width, height, widthB, heightB, quantity, excludeOptionalIds]);

  const hasComposition = !!compositionItems && compositionItems.length > 0;

  // ── Cálculo SIMPLES e auditável por TIPO DE UNIDADE do insumo ──
  // m²  → área do projeto (L×A) × preço/m² × qtd
  // ml  → metros lineares (maior dimensão / 1000) × preço/m × qtd peças
  // un / kit → quantidade fixa × preço unitário
  const simpleBreakdown = useMemo(() => {
    if (!compositionItems) return { rows: [] as Array<{ nome: string; qtd: number; unidade: string; custo_estoque: number; subtotal: number; detalhe: string }>, total: 0 };

    const areaM2Local = (width * height) / 1_000_000;
    const linearM = Math.max(width, height) / 1000;

    const rows = compositionItems
      .filter(ci => !(ci.is_optional && excludeOptionalIds.includes(ci.id)))
      .map(ci => {
        const tpl = ci.item_template as any;
        const compItem: any = ci.company_item || fallbackCompanyItems?.find(f => f.item_template_id === tpl?.id);

        const qtd = parseFloat(String(ci.pieces_quantity ?? 1).replace(',', '.')) || 1;
        const rawUnit = String(tpl?.unit || compItem?.unit || 'un').toLowerCase().trim();
        const type = String(tpl?.type || compItem?.type || '').toLowerCase();

        const num = (v: any) => parseFloat(String(v ?? 0).replace(',', '.')) || 0;

        let unidade: 'm²' | 'ml' | 'un' | 'kit' = 'un';
        if (rawUnit === 'm2' || rawUnit === 'm²' || type === 'glass') unidade = 'm²';
        else if (rawUnit === 'ml' || rawUnit === 'm' || type === 'profile') unidade = 'ml';
        else if (rawUnit === 'kit') unidade = 'kit';

        let custoEstoque = 0;
        let subtotal = 0;
        let detalhe = '';

        if (unidade === 'm²') {
          custoEstoque = num(compItem?.cost_per_meter) || num(compItem?.cost);
          subtotal = areaM2Local * custoEstoque * qtd;
          detalhe = `${areaM2Local.toFixed(2)} m² × R$ ${custoEstoque.toFixed(2)} × ${qtd}`;
        } else if (unidade === 'ml') {
          custoEstoque = num(compItem?.cost_per_meter) ||
            (num(compItem?.cost_per_bar) && num(compItem?.bar_length_mm) ? num(compItem.cost_per_bar) / (num(compItem.bar_length_mm) / 1000) : 0);
          subtotal = linearM * custoEstoque * qtd;
          detalhe = `${linearM.toFixed(2)} m × R$ ${custoEstoque.toFixed(2)} × ${qtd}`;
        } else {
          custoEstoque = num(compItem?.cost) || num(compItem?.cost_per_bar);
          subtotal = qtd * custoEstoque;
          detalhe = `${qtd} ${unidade} × R$ ${custoEstoque.toFixed(2)}`;
        }

        return {
          nome: tpl?.name || compItem?.name || 'Item',
          qtd,
          unidade,
          custo_estoque: custoEstoque,
          subtotal,
          detalhe,
        };
      });

    const total = rows.reduce((s, r) => s + r.subtotal, 0);
    // eslint-disable-next-line no-console
    console.log('[useCompositionPricing] Breakdown por unidade:', rows, '→ total:', total);
    return { rows, total };
  }, [compositionItems, fallbackCompanyItems, excludeOptionalIds, width, height]);

  const areaM2 = (width * height) / 1_000_000 || 1;
  const compositionCostSimpleTotal = simpleBreakdown.total;
  const compositionCostSimplePerSqm = compositionCostSimpleTotal / areaM2;

  // Mantém compatibilidade: usa engine se disponível, senão cai para soma simples
  const compositionCostPerUnit = result
    ? result.totalCost / (quantity || 1)
    : compositionCostSimpleTotal;
  const compositionCostPerSqm = result?.costPerSqm || compositionCostSimplePerSqm;

  return {
    hasComposition,
    compositionCostPerUnit,
    compositionCostPerSqm,
    compositionCostSimpleTotal,
    compositionCostSimplePerSqm,
    simpleBreakdown: simpleBreakdown.rows,
    totalCost: result?.totalCost ?? compositionCostSimpleTotal,
    costByType: result?.costByType ?? {},
    items: result?.items ?? [],
    isReady: hasComposition,
    optionalItems,
  };
}
