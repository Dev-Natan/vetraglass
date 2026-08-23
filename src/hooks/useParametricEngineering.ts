import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import {
  calculateParametricEngineering,
  type ParametricEngineInputs,
  type ParametricMaterialType,
  type ResolvedParametricRule,
} from '@/utils/parametricEngineeringEngine';

type RuleRow = Tables<'product_parametric_rules'>;
type OverrideRow = Tables<'company_parametric_rule_overrides'>;
type CompanyItemRow = Tables<'company_items'>;
type ItemTemplateRow = Tables<'item_templates'>;
type CompanyItemPriceRow = Tables<'company_item_prices'>;

interface UseParametricEngineeringOptions extends ParametricEngineInputs {
  companyId?: string;
  productTemplateId?: string | null;
  enabled?: boolean;
}

const positive = (...values: Array<number | null | undefined>): number | null => {
  const match = values.find((value) => typeof value === 'number' && value > 0);
  return match ?? null;
};

function resolveUnitPrices(
  type: ParametricMaterialType,
  item: CompanyItemRow | undefined,
  price: CompanyItemPriceRow | undefined,
): { cost: number | null; salePrice: number | null } {
  if (type === 'profile') {
    const barMeters = Number(item?.bar_length_mm ?? 0) / 1000;
    return {
      cost: positive(
        price?.cost,
        item?.cost_per_meter,
        barMeters > 0 ? Number(item?.cost_per_bar ?? 0) / barMeters : null,
        item?.cost,
      ),
      salePrice: positive(
        price?.price,
        item?.sale_price_per_meter,
        barMeters > 0 ? Number(item?.sale_price_per_bar ?? 0) / barMeters : null,
        item?.sale_price,
      ),
    };
  }
  return {
    cost: positive(price?.cost, item?.cost, item?.cost_per_meter, item?.preco_unitario),
    salePrice: positive(price?.price, item?.sale_price, item?.preco_unitario, item?.sale_price_per_meter),
  };
}

function applyOverride(rule: RuleRow, override: OverrideRow | undefined) {
  return {
    formula: override?.formula_override ?? rule.formula,
    widthFormula: override?.width_formula_override ?? rule.width_formula,
    heightFormula: override?.height_formula_override ?? rule.height_formula,
    quantityFormula: override?.quantity_formula_override ?? rule.quantity_formula,
    piecesFormula: override?.pieces_formula_override ?? rule.pieces_formula,
    piecesQuantity: override?.pieces_quantity_override ?? rule.pieces_quantity,
    condition: override?.condition_override ?? rule.condition_expression,
    lossPercent: override?.loss_percent_override ?? rule.loss_percent,
  };
}

async function loadResolvedRules(
  companyId: string | undefined,
  productTemplateId: string,
): Promise<ResolvedParametricRule[]> {
  const { data: rules, error: rulesError } = await supabase
    .from('product_parametric_rules')
    .select('*')
    .eq('product_template_id', productTemplateId)
    .eq('is_active', true)
    .order('sort_order')
    .order('rule_key');
  if (rulesError) throw rulesError;
  if (!rules?.length) return [];

  const ruleIds = rules.map((rule) => rule.id);
  const templateIds = [...new Set(rules.map((rule) => rule.item_template_id).filter(Boolean))] as string[];
  const [overridesResult, companyItemsResult, templatesResult, pricesResult] = await Promise.all([
    companyId
      ? supabase
          .from('company_parametric_rule_overrides')
          .select('*')
          .eq('company_id', companyId)
          .in('rule_id', ruleIds)
      : Promise.resolve({ data: [] as OverrideRow[], error: null }),
    companyId
      ? supabase
          .from('company_items')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as CompanyItemRow[], error: null }),
    templateIds.length
      ? supabase.from('item_templates').select('*').in('id', templateIds)
      : Promise.resolve({ data: [] as ItemTemplateRow[], error: null }),
    companyId && templateIds.length
      ? supabase
          .from('company_item_prices')
          .select('*')
          .eq('company_id', companyId)
          .in('item_template_id', templateIds)
      : Promise.resolve({ data: [] as CompanyItemPriceRow[], error: null }),
  ]);
  const firstError = overridesResult.error || companyItemsResult.error || templatesResult.error || pricesResult.error;
  if (firstError) throw firstError;

  const overrides = new Map((overridesResult.data ?? []).map((row) => [row.rule_id, row]));
  const companyItems = companyItemsResult.data ?? [];
  const companyItemsById = new Map(companyItems.map((row) => [row.id, row]));
  const companyItemsByTemplate = new Map(
    companyItems.filter((row) => row.item_template_id).map((row) => [row.item_template_id as string, row]),
  );
  const templates = new Map((templatesResult.data ?? []).map((row) => [row.id, row]));
  const prices = new Map((pricesResult.data ?? []).map((row) => [row.item_template_id, row]));

  return rules.flatMap((rule) => {
    const override = overrides.get(rule.id);
    if (override?.is_disabled) return [];
    const resolved = applyOverride(rule, override);
    const companyItem = override?.company_item_id
      ? companyItemsById.get(override.company_item_id)
      : rule.item_template_id
        ? companyItemsByTemplate.get(rule.item_template_id)
        : undefined;
    const template = rule.item_template_id ? templates.get(rule.item_template_id) : undefined;
    const itemPrice = rule.item_template_id ? prices.get(rule.item_template_id) : undefined;
    const unitPrices = resolveUnitPrices(rule.material_type as ParametricMaterialType, companyItem, itemPrice);

    return [{
      id: rule.id,
      rule_key: rule.rule_key,
      material_type: rule.material_type as ParametricMaterialType,
      item_template_id: rule.item_template_id,
      company_item_id: companyItem?.id ?? null,
      item_name: companyItem?.name ?? template?.name ?? 'Item não configurado',
      group_name: rule.group_name,
      formula: resolved.formula,
      width_formula: resolved.widthFormula,
      height_formula: resolved.heightFormula,
      quantity_formula: resolved.quantityFormula,
      pieces_formula: resolved.piecesFormula,
      pieces_quantity: resolved.piecesQuantity,
      condition_expression: resolved.condition,
      unit: companyItem?.unit ?? template?.unit ?? rule.unit,
      cut_orientation: rule.cut_orientation,
      cut_angle: rule.cut_angle,
      side: rule.side,
      calculation_type: rule.calculation_type,
      applies_to: rule.applies_to,
      loss_percent: resolved.lossPercent,
      version: rule.version,
      is_validated: rule.is_validated,
      validation_source: rule.validation_source,
      source: override ? 'company_override' : 'global',
      cost_per_unit: unitPrices.cost,
      sale_price_per_unit: unitPrices.salePrice,
    } satisfies ResolvedParametricRule];
  });
}

export function useParametricEngineering(options: UseParametricEngineeringOptions) {
  const query = useQuery({
    queryKey: [
      'parametric-engineering',
      options.companyId,
      options.productTemplateId,
    ],
    queryFn: () => loadResolvedRules(options.companyId, options.productTemplateId!),
    enabled: Boolean(options.enabled && options.productTemplateId),
    staleTime: 30_000,
  });

  const calculation = useMemo(() => {
    if (!query.data || options.width_mm <= 0 || options.height_mm <= 0 || options.quantity <= 0) {
      return { result: null, calculationError: null };
    }
    try {
      return {
        result: calculateParametricEngineering({
          width_mm: options.width_mm,
          height_mm: options.height_mm,
          quantity: options.quantity,
          line: options.line,
          glass: options.glass,
          profile_color: options.profile_color,
          glass_color: options.glass_color,
          variants: options.variants,
        }, query.data),
        calculationError: null,
      };
    } catch (error) {
      return {
        result: null,
        calculationError: error instanceof Error ? error : new Error('Falha no cálculo paramétrico.'),
      };
    }
  }, [
    query.data,
    options.width_mm,
    options.height_mm,
    options.quantity,
    options.line,
    options.glass,
    options.profile_color,
    options.glass_color,
    options.variants,
  ]);

  return { ...query, ...calculation, rules: query.data ?? [] };
}
