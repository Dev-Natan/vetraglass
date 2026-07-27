import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';

/**
 * Unified dynamic composition for an Ordem de Serviço.
 *
 * Resolves each os_items row -> effective product composition, honoring:
 *   1. Company override composition (company_product_items)
 *   2. Admin default template composition (product_template_items)
 * (fallback handled server-side by RPC `get_cutting_plan_items`)
 *
 * Then evaluates all formulas (width/height/quantity) against the production
 * dimensions stored on the OS item, so tabs Materiais / Corte / Vidros /
 * Acessórios stay in sync with the current vão measurements.
 */

export interface OSComposedRow {
  osItemId: string;
  productName: string;
  productQty: number;
  itemTemplateId: string | null;
  itemName: string;
  itemType: 'profile' | 'glass' | 'accessory' | 'component' | string;
  unit: string | null;
  imageUrl: string | null;
  section: string | null;
  side: string | null;
  cutAngle: number | null;
  barLengthMm: number | null;
  widthFormula: string | null;
  heightFormula: string | null;
  quantityFormula: string | null;
  calculatedWidth: number;
  calculatedHeight: number;
  /** For profiles = cut length (mm). For glass = width×height (m²). For accessories = final qty in `unit`. */
  calculatedQty: number;
  /** Length in mm when applicable (profiles); undefined for accessories/glass. */
  calculatedLengthMm?: number;
  source: 'company' | 'template' | string;
}

export interface OSComposedItem {
  osItemId: string;
  productName: string;
  productQty: number;
  width: number;
  height: number;
  widthB: number;
  heightB: number;
  aluminumColor?: string | null;
  glassColor?: string | null;
  glassThickness?: number | null;
  productImageUrl?: string | null;
  rows: OSComposedRow[];
}

export interface UseOSCompositionResult {
  items: OSComposedItem[];
  profiles: OSComposedRow[];
  glasses: OSComposedRow[];
  accessories: OSComposedRow[];
  isLoading: boolean;
}

async function fetchOSComposition(ordemServicoId: string): Promise<{
  items: OSComposedItem[];
}> {
  // 1. OS -> company_id
  const { data: os, error: osErr } = await supabase
    .from('ordens_servico')
    .select('id, company_id')
    .eq('id', ordemServicoId)
    .maybeSingle();
  if (osErr) throw osErr;
  if (!os) return { items: [] };

  // 2. OS items (with basic quote joins for glass/aluminum context)
  const { data: osItems, error: itemsErr } = await supabase
    .from('os_items')
    .select('*, quote_items(glass_color, glass_thickness, aluminum_color)')
    .eq('os_id', ordemServicoId);
  if (itemsErr) throw itemsErr;
  if (!osItems?.length) return { items: [] };

  // 3. For each OS item resolve template id + product metadata (has_multiple_sides)
  const composed: OSComposedItem[] = [];

  for (const item of osItems as any[]) {
    // Reference id points to either an admin template or a company product.
    // Priority: explicit product_template_id -> generic product_id -> company_product_id
    const referenceId: string | null =
      item.product_template_id || item.product_id || item.company_product_id || null;
    if (!referenceId) continue;

    let templateId: string = referenceId;
    let hasMultipleSides = false;
    let productImageUrl: string | null = null;

    // If it's a company_product row, dereference to its underlying template
    if (item.company_product_id) {
      const { data: cp } = await supabase
        .from('company_products')
        .select('id, product_template_id, has_multiple_sides, image_url')
        .eq('id', item.company_product_id)
        .maybeSingle();
      if (cp) {
        templateId = cp.product_template_id || cp.id;
        hasMultipleSides = !!cp.has_multiple_sides;
        productImageUrl = cp.image_url || null;
      }
    }
    {
      const { data: pt } = await supabase
        .from('product_templates')
        .select('has_multiple_sides, image_url')
        .eq('id', templateId)
        .maybeSingle();
      if (pt) {
        if (!hasMultipleSides) hasMultipleSides = !!pt.has_multiple_sides;
        if (!productImageUrl) productImageUrl = pt.image_url || null;
      }
    }

    // 4. Effective composition via RPC (handles company override + admin fallback)
    const { data: composition, error: rpcErr } = await supabase.rpc(
      'get_cutting_plan_items',
      { _template_id: templateId, _company_id: os.company_id },
    );
    if (rpcErr) {
      // Non-fatal; skip this item but keep processing others
      // eslint-disable-next-line no-console
      console.warn('[useOSComposition] RPC failed for', templateId, rpcErr.message);
      continue;
    }

    const width = Number(item.largura_producao || 0);
    const height = Number(item.altura_producao || 0);
    const widthB = Number(item.largura_producao_b || width);
    const heightB = Number(item.altura_producao_b || height);
    const productQty = Number(item.quantity || 1);

    const rows: OSComposedRow[] = [];
    for (const c of (composition || []) as any[]) {
      // Which side(s) does this piece apply to?
      const sides: Array<{ label: string | null; s: string | null }> = [];
      if (!hasMultipleSides) sides.push({ label: null, s: null });
      else if (c.side === 'A') sides.push({ label: 'A', s: 'A' });
      else if (c.side === 'B') sides.push({ label: 'B', s: 'B' });
      else if (c.side === 'Ambos' || c.side === 'AB') {
        sides.push({ label: 'A', s: 'A' });
        sides.push({ label: 'B', s: 'B' });
      } else sides.push({ label: null, s: null });

      for (const sd of sides) {
        const ctx = { width, height, widthB, heightB };
        const cw = c.width_formula
          ? evaluateFormula(c.width_formula, ctx, undefined, sd.s, 'ceil')
          : 0;
        const ch = c.height_formula
          ? evaluateFormula(c.height_formula, ctx, undefined, sd.s, 'ceil')
          : 0;

        const piecesQty = Number(c.pieces_quantity ?? 1);
        let calc: number;
        let calcLengthMm: number | undefined;

        const unit = (c.unit || '').toLowerCase();
        const type = c.item_template_type as string;

        if (type === 'profile') {
          // profile: length = width_formula || height_formula, qty = pieces_quantity * productQty
          const lengthMm = cw > 0 ? cw : ch;
          calcLengthMm = lengthMm;
          const perProduct = piecesQty;
          calc = Math.max(0, Math.ceil(perProduct)) * productQty;
        } else if (type === 'glass') {
          // glass: qty = pieces_quantity * productQty (each panel is cw × ch)
          const perProduct = Math.max(1, Math.ceil(piecesQty));
          calc = perProduct * productQty;
        } else {
          // accessory / component: qty from quantity_formula in mm converted by unit
          const rawQty = c.quantity_formula
            ? evaluateFormula(c.quantity_formula, ctx, undefined, sd.s, 'none')
            : piecesQty;
          let perProduct = rawQty > 0 ? rawQty : piecesQty;
          if (c.quantity_formula) {
            if (unit === 'm' || unit === 'metros') perProduct = (rawQty / 1000) * piecesQty;
            else if (unit === 'm²' || unit === 'm2') perProduct = (rawQty / 1000000) * piecesQty;
            else perProduct = rawQty * piecesQty;
          }
          calc = Math.round(perProduct * productQty * 1000) / 1000;
          if (calc <= 0) continue;
        }

        rows.push({
          osItemId: item.id,
          productName: item.product_name,
          productQty,
          itemTemplateId: c.item_template_id || null,
          itemName: c.item_template_name || 'Item',
          itemType: type,
          unit: c.unit || null,
          imageUrl: c.item_template_image_url || null,
          section: c.section || null,
          side: sd.label,
          cutAngle: c.cut_angle ?? null,
          barLengthMm: c.bar_length_mm ?? null,
          widthFormula: c.width_formula || null,
          heightFormula: c.height_formula || null,
          quantityFormula: c.quantity_formula || null,
          calculatedWidth: cw,
          calculatedHeight: ch,
          calculatedQty: calc,
          calculatedLengthMm: calcLengthMm,
          source: c.source || 'template',
        });
      }
    }

    composed.push({
      osItemId: item.id,
      productName: item.product_name,
      productQty,
      width,
      height,
      widthB,
      heightB,
      aluminumColor: item.quote_items?.aluminum_color ?? item.aluminum_color ?? null,
      glassColor: item.quote_items?.glass_color ?? item.glass_color ?? null,
      glassThickness: item.quote_items?.glass_thickness ?? item.glass_thickness ?? null,
      rows,
    });
  }

  return { items: composed };
}

export function useOSComposition(ordemServicoId: string): UseOSCompositionResult {
  const { data, isLoading } = useQuery({
    queryKey: ['os-composition-dynamic', ordemServicoId],
    queryFn: () => fetchOSComposition(ordemServicoId),
    staleTime: 0,
    gcTime: 0,
    enabled: !!ordemServicoId,
  });

  const items = data?.items || [];
  const allRows = items.flatMap((i) => i.rows);
  return {
    items,
    profiles: allRows.filter((r) => r.itemType === 'profile'),
    glasses: allRows.filter((r) => r.itemType === 'glass'),
    accessories: allRows.filter((r) => r.itemType === 'accessory' || r.itemType === 'component'),
    isLoading,
  };
}
