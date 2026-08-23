// Generate OS Documents - Materials, Cutting Plan, Glass Projects, Purchase Orders
import { supabase } from '@/integrations/supabase/client';
import { optimizeProfiles, CutPiece } from './profileOptimization';
import { evaluateFormula, getFormulaPosition } from './safeFormulaEvaluator';
import { createPurchaseOrderFromOS } from './createPurchaseOrder';
import { checkGlassStockAvailability, createStockReservation } from './checkGlassStock';

interface OSItem {
  id: string;
  os_id: string;
  quote_item_id: string | null;
  product_name: string;
  largura_producao: number;
  altura_producao: number;
  largura_producao_b?: number | null;
  altura_producao_b?: number | null;
  largura_producao_c?: number | null;
  altura_producao_c?: number | null;
  quantity: number;
  product_id: string | null;
  glass_thickness?: string | null;
  glass_color?: string | null;
  include_contramarco?: boolean | null;
  width_sold?: number | null;
  height_sold?: number | null;
}

interface ProductCompositionItem {
  id: string;
  item_template_id: string;
  quantity_formula: string;
  width_formula: string | null;
  height_formula: string | null;
  cut_angle: number;
  pieces_quantity: number;
  pieces_formula: string | null;
  is_optional: boolean;
  section: string | null;
  side: string | null;
  item_template: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    bar_length_mm: number | null;
  };
}


interface GlassFormula {
  id: string;
  formula_name: string;
  width_formula: string;
  height_formula: string;
  panel_index: number | null;
  description: string | null;
  is_movable: boolean | null;
  side: string | null;
}

interface ProductTemplate {
  id: string;
  name: string;
  linha: string | null;
  category: string | null;
  has_multiple_sides: boolean | null;
}

/**
 * Fetch product composition from database
 */
async function getProductComposition(
  productTemplateId: string,
  companyId?: string
): Promise<ProductCompositionItem[]> {
  // Prefer company-specific composition when the company has customized this product
  if (companyId) {
    const { data: companyProduct } = await supabase
      .from('company_products')
      .select('id')
      .eq('company_id', companyId)
      .eq('product_template_id', productTemplateId)
      .maybeSingle();

    if (companyProduct?.id) {
      const { data: companyItems, error: ciError } = await supabase
        .from('company_product_items')
        .select(`
          id,
          item_template_id,
          quantity_formula,
          width_formula,
          height_formula,
          cut_angle,
          pieces_quantity,
          pieces_formula,
          is_optional,
          section,
          side,
          item_template:item_templates!inner(
            id,
            name,
            type,
            unit,
            image_url,
            bar_length_mm
          )
        `)
        .eq('company_product_id', companyProduct.id);

      if (ciError) throw ciError;
      if (companyItems && companyItems.length > 0) {
        return companyItems as unknown as ProductCompositionItem[];
      }
    }
  }

  const { data, error } = await supabase
    .from('product_template_items')
    .select(`
      id,
      item_template_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      pieces_formula,
      is_optional,
      section,
      side,
      item_template:item_templates!inner(
        id,
        name,
        type,
        unit,
        image_url,
        bar_length_mm
      )
    `)
    .eq('product_template_id', productTemplateId)
    .is('company_id', null);

  if (error) throw error;
  return (data || []) as unknown as ProductCompositionItem[];
}


/**
 * Fetch glass formulas for a product
 */
async function getGlassFormulas(productTemplateId: string, linha: string): Promise<GlassFormula[]> {
  const { data, error } = await supabase
    .from('glass_line_formulas')
    .select('*')
    .eq('is_active', true)
    .or(`product_template_id.eq.${productTemplateId},and(linha.eq.${linha},product_template_id.is.null)`)
    .order('panel_index', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as GlassFormula[];
}

/**
 * Get product template details
 */
async function getProductTemplate(productTemplateId: string): Promise<ProductTemplate | null> {
  const { data, error } = await supabase
    .from('product_templates')
    .select('id, name, linha, category, has_multiple_sides')
    .eq('id', productTemplateId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generate all OS documents using production dimensions from os_items
 */
export async function generateOSDocuments(
  ordemServicoId: string,
  osItems: OSItem[],
  companyId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const allCuts: (CutPiece & { os_item_id: string })[] = [];
    const glassProjectsToProcess: Array<{
      id: string;
      os_item_id: string;
      product_name: string;
      glass_type?: string;
      glass_color?: string;
      quantity: number;
      panels_data: any[];
      total_area_m2: number;
      stockCheck?: {
        origin: 'stock' | 'purchase' | 'mixed';
        stockItemId: string | null;
        useFromStock: number;
        needToPurchase: number;
        unitCost: number;
      };
    }> = [];
    
    // Process each OS item
    for (const item of osItems) {
      if (!item.product_id || !item.largura_producao || !item.altura_producao) continue;
      
      const width = Number(item.largura_producao || 0);
      const height = Number(item.altura_producao || 0);
      const width_b = Number(item.largura_producao_b || width);
      const height_b = Number(item.altura_producao_b || height);
      const width_c = Number(item.largura_producao_c || width);
      const height_c = Number(item.altura_producao_c || height);
      const quantity = item.quantity;

      // Get product template details
      const product = await getProductTemplate(item.product_id);
      if (!product) continue;

      // Get composition and glass formulas
      const [allComposition, glassFormulas] = await Promise.all([
        getProductComposition(item.product_id, companyId),
        getGlassFormulas(item.product_id, product.linha || '')
      ]);


      const includeContramarco = item.include_contramarco !== false;
      const composition = allComposition.filter(comp => {
        if (comp.section === 'contramarco' && !includeContramarco) return false;
        return true;
      });
      
      // Calculate profile cuts
      const profileCuts: Array<{
        profileName: string;
        formula: string;
        calculatedLength: number;
        quantity: number;
        cutAngle: number;
        position: string;
        side?: string;
      }> = [];

      for (const comp of composition) {
        if (comp.item_template.type !== 'profile') continue;
        
        // Define which formula to use and determine position
        let formula = '';
        let position = 'Largura';

        if (comp.width_formula && comp.width_formula.trim() !== '') {
          formula = comp.width_formula;
          position = 'Largura';
        } else if (comp.height_formula && comp.height_formula.trim() !== '') {
          formula = comp.height_formula;
          position = 'Altura';
        } else {
          formula = comp.quantity_formula || '';
          position = getFormulaPosition(formula);
        }

        // Evaluate pieces from formula (with parentheses / division supported),
        // rounded up per Math.ceil. Falls back to pieces_quantity or 1.
        const evalCtx = {
          width, height,
          widthB: width_b, heightB: height_b,
          widthC: width_c, heightC: height_c,
        };
        let piecesQty = comp.pieces_quantity || 1;
        if (comp.pieces_formula && comp.pieces_formula.trim() !== '') {
          const raw = evaluateFormula(comp.pieces_formula, evalCtx, undefined, comp.side as any, 'ceil');
          if (raw > 0) piecesQty = raw;
        }

        const totalPieces = piecesQty * quantity;


        const sidesToCalculate = [];
        if (!product.has_multiple_sides) {
          sidesToCalculate.push({ label: undefined, w: width, h: height, s: null });
        } else if (comp.side === 'A') {
          sidesToCalculate.push({ label: 'A', w: width, h: height, s: 'A' });
        } else if (comp.side === 'B') {
          sidesToCalculate.push({ label: 'B', w: width_b, h: height_b, s: 'B' });
        } else {
          sidesToCalculate.push({ label: 'A', w: width, h: height, s: 'A' });
          sidesToCalculate.push({ label: 'B', w: width_b, h: height_b, s: 'B' });
        }

        for (const sideData of sidesToCalculate) {
          const calculatedLength = evaluateFormula(formula, {
            width,
            height,
            widthB: width_b,
            heightB: height_b,
            widthC: width_c,
            heightC: height_c
          }, undefined, sideData.s as any);
          
          if (calculatedLength <= 0) continue;

          profileCuts.push({
            profileName: comp.item_template.name,
            formula,
            calculatedLength,
            quantity: totalPieces,
            cutAngle: comp.cut_angle,
            position,
            side: sideData.label
          });

          allCuts.push({
            os_item_id: item.id,
            itemTemplateId: comp.item_template_id,
            itemName: comp.item_template.name,
            cutLength: calculatedLength,
            quantity: totalPieces,
            barLengthMm: comp.item_template.bar_length_mm || 6000,
            unit: comp.item_template.unit,
          });
        }
      }

      // Calculate glass cuts
      const glassCuts: Array<{
        glassName: string;
        widthFormula: string;
        heightFormula: string;
        calculatedWidth: number;
        calculatedHeight: number;
        areaM2: number;
        quantity: number;
        isMovable: boolean;
        side?: string;
      }> = [];

      // Source 1: glasses defined in product composition (product_template_items with type='glass')
      const glassComposition = allComposition.filter(c => c.item_template.type === 'glass');

      for (const comp of glassComposition) {
        if (!comp.width_formula || !comp.height_formula) continue;

        const sidesToCalculate: Array<{ label?: string; s: 'A' | 'B' | null }> = [];
        if (!product.has_multiple_sides) {
          sidesToCalculate.push({ label: undefined, s: null });
        } else if (comp.side === 'A') {
          sidesToCalculate.push({ label: 'A', s: 'A' });
        } else if (comp.side === 'B') {
          sidesToCalculate.push({ label: 'B', s: 'B' });
        } else {
          sidesToCalculate.push({ label: 'A', s: 'A' });
          sidesToCalculate.push({ label: 'B', s: 'B' });
        }

        const formulaCtx = {
          width, height,
          widthB: width_b, heightB: height_b,
          widthC: width_c, heightC: height_c,
        };

        const piecesQty = comp.pieces_quantity || 1;
        const nameLower = (comp.item_template.name || '').toLowerCase();
        const isMovable = !nameLower.includes('fixo');

        for (const sideData of sidesToCalculate) {
          const calcWidth = evaluateFormula(comp.width_formula, formulaCtx, undefined, sideData.s as any);
          const calcHeight = evaluateFormula(comp.height_formula, formulaCtx, undefined, sideData.s as any);
          if (calcWidth <= 0 || calcHeight <= 0) continue;

          const totalQty = piecesQty * quantity;
          const areaM2 = (calcWidth / 1000) * (calcHeight / 1000) * totalQty;

          glassCuts.push({
            glassName: comp.item_template.name,
            widthFormula: comp.width_formula,
            heightFormula: comp.height_formula,
            calculatedWidth: calcWidth,
            calculatedHeight: calcHeight,
            areaM2,
            quantity: totalQty,
            isMovable,
            side: sideData.label,
          });
        }
      }

      // Source 2 (legacy): glass_line_formulas
      for (const formula of glassFormulas) {
        const sidesToCalculate = [];
        if (!product.has_multiple_sides) {
          sidesToCalculate.push({ label: undefined, w: width, h: height, s: null });
        } else if (formula.side === 'A') {
          sidesToCalculate.push({ label: 'A', w: width, h: height, s: 'A' });
        } else if (formula.side === 'B') {
          sidesToCalculate.push({ label: 'B', w: width_b, h: height_b, s: 'B' });
        } else {
          const nameLower = formula.formula_name.toLowerCase();
          if (nameLower.includes('lado a') || nameLower.includes('side a')) {
            sidesToCalculate.push({ label: 'A', w: width, h: height, s: 'A' });
          } else if (nameLower.includes('lado b') || nameLower.includes('side b')) {
            sidesToCalculate.push({ label: 'B', w: width_b, h: height_b, s: 'B' });
          } else {
            sidesToCalculate.push({ label: 'A', w: width, h: height, s: 'A' });
            sidesToCalculate.push({ label: 'B', w: width_b, h: height_b, s: 'B' });
          }
        }

        for (const sideData of sidesToCalculate) {
          const calcWidth = evaluateFormula(formula.width_formula, {
            width,
            height,
            widthB: width_b,
            heightB: height_b,
            widthC: width_c,
            heightC: height_c
          }, undefined, sideData.s as any);
          const calcHeight = evaluateFormula(formula.height_formula, {
            width,
            height,
            widthB: width_b,
            heightB: height_b,
            widthC: width_c,
            heightC: height_c
          }, undefined, sideData.s as any);
          
          if (calcWidth <= 0 || calcHeight <= 0) continue;

          const areaM2 = (calcWidth / 1000) * (calcHeight / 1000);
          const totalQty = quantity;

          glassCuts.push({
            glassName: formula.formula_name,
            widthFormula: formula.width_formula,
            heightFormula: formula.height_formula,
            calculatedWidth: calcWidth,
            calculatedHeight: calcHeight,
            areaM2: areaM2 * totalQty,
            quantity: totalQty,
            isMovable: formula.is_movable ?? true,
            side: sideData.label
          });
        }
      }


      // Insert cutting plan for this OS item
      await supabase.from('os_cutting_plan').insert({
        ordem_servico_id: ordemServicoId,
        os_item_id: item.id,
        quote_item_id: item.quote_item_id,
        product_name: item.product_name,
        product_template_id: item.product_id,
        vao_width: width,
        vao_height: height,
        vao_width_b: product.has_multiple_sides ? width_b : null,
        vao_height_b: product.has_multiple_sides ? height_b : null,
        quantity,
        cuts_data: profileCuts,
        glass_cuts_data: glassCuts,
      } as never);

      // Insert glass project
      if (glassCuts.length > 0) {
        const panels = glassCuts.map((glass, index) => ({
          index: index + 1,
          name: glass.side ? `${glass.glassName} (Lado ${glass.side})` : glass.glassName,
          width: glass.calculatedWidth,
          height: glass.calculatedHeight,
          areaM2: glass.areaM2 / quantity,
          quantity: glass.quantity,
          isMovable: glass.isMovable,
          side: glass.side
        }));

        const totalArea = glassCuts.reduce((sum, g) => sum + g.areaM2, 0);

        let stockCheck = null;
        let materialOrigin: 'stock' | 'purchase' | 'mixed' | 'pending' = 'pending';
        let procurementStatus = 'pending_purchase';
        
        if (companyId) {
          stockCheck = await checkGlassStockAvailability(
            companyId,
            item.glass_thickness || null,
            item.glass_color || null,
            totalArea
          );

          materialOrigin = stockCheck.origin;
          procurementStatus = stockCheck.origin === 'stock' ? 'in_stock' : stockCheck.origin === 'mixed' ? 'partial_stock' : 'pending_purchase';
        }

        const { data: glassProject } = await supabase.from('os_glass_projects').insert({
          ordem_servico_id: ordemServicoId,
          os_item_id: item.id,
          quote_item_id: item.quote_item_id,
          product_name: item.product_name,
          product_template_id: item.product_id,
          vao_width: width,
          vao_height: height,
          vao_width_b: product.has_multiple_sides ? width_b : null,
          vao_height_b: product.has_multiple_sides ? height_b : null,
          quantity,
          panels_data: panels,
          total_area_m2: totalArea,
          glass_type: item.glass_thickness,
          glass_color: item.glass_color,
          procurement_status: procurementStatus,
          material_origin: materialOrigin,
          stock_item_id: stockCheck?.stockItemId || null,
          stock_quantity_used: stockCheck?.useFromStock || 0,
          stock_unit_cost: stockCheck?.unitCost || 0,
          purchase_quantity_needed: stockCheck?.needToPurchase || totalArea,
        } as never).select().single();

        if (glassProject) {
          if (stockCheck && stockCheck.useFromStock > 0 && stockCheck.stockItemId && companyId) {
            await createStockReservation(
              companyId,
              stockCheck.stockItemId,
              ordemServicoId,
              glassProject.id,
              stockCheck.useFromStock,
              stockCheck.unitCost
            );
          }

          glassProjectsToProcess.push({
            id: glassProject.id,
            os_item_id: item.id,
            product_name: item.product_name,
            glass_type: item.glass_thickness || undefined,
            glass_color: item.glass_color || undefined,
            quantity,
            panels_data: panels,
            total_area_m2: totalArea,
            stockCheck: stockCheck ? {
              origin: stockCheck.origin,
              stockItemId: stockCheck.stockItemId,
              useFromStock: stockCheck.useFromStock,
              needToPurchase: stockCheck.needToPurchase,
              unitCost: stockCheck.unitCost,
            } : undefined,
          });
        }
      }
      
      // Update recalculated status
      await supabase.from('os_items')
        .update({ recalculation_required: false, last_recalculated_at: new Date().toISOString() })
        .eq('id', item.id);
    }

    // Optimize profiles and insert materials list
    if (allCuts.length > 0) {
      const optimized = optimizeProfiles(allCuts);

      const materialsToInsert = optimized.profiles.map(profile => {
        const matchingCut = allCuts.find(c => c.itemTemplateId === profile.itemTemplateId);
        return {
          ordem_servico_id: ordemServicoId,
          item_template_id: profile.itemTemplateId,
          item_name: profile.itemName,
          item_type: 'profile',
          cut_length_mm: profile.cuts.length > 0 ? profile.cuts[0].length : 0,
          pieces_count: profile.cuts.reduce((sum, c) => sum + c.qty, 0),
          total_length_mm: profile.totalLengthMm,
          bar_length_mm: profile.barLengthMm,
          bars_needed: profile.barsNeeded,
          waste_mm: profile.wasteMm,
          waste_percent: profile.wastePercent,
          unit: profile.unit,
          notes: profile.cuts.map(c => `${c.qty}x ${c.length}mm`).join(', '),
          os_item_id: matchingCut?.os_item_id
        };
      });

      await supabase.from('os_materials').insert(materialsToInsert as never);
    }

    // Now handle accessories (non-profile items)
    for (const item of osItems) {
      if (!item.product_id) continue;
      
      const [allComposition] = await Promise.all([
        getProductComposition(item.product_id, companyId)
      ]);


      const accessories = allComposition.filter(comp => 
        comp.item_template.type !== 'profile' && comp.item_template.type !== 'glass'
      );

      if (accessories.length > 0) {
        const accessoryMaterials = [];
        const width = item.largura_producao || 0;
        const height = item.altura_producao || 0;
        const width_b = item.largura_producao_b || width;
        const height_b = item.altura_producao_b || height;
        const width_c = item.largura_producao_c || width;
        const height_c = item.altura_producao_c || height;
        const formulaContext = { width, height, widthB: width_b, heightB: height_b, widthC: width_c, heightC: height_c };

        for (const comp of accessories) {
          let piecesQty = comp.pieces_quantity || 1;
          if (comp.pieces_formula && comp.pieces_formula.trim() !== '') {
            const raw = evaluateFormula(comp.pieces_formula, formulaContext, undefined, comp.side as any, 'ceil');
            if (raw > 0) piecesQty = raw;
          }

          const qty = item.quantity || 1;
          
          let calculatedQty = piecesQty * qty;
          if (comp.quantity_formula && comp.quantity_formula !== '1') {
            const formulaResult = evaluateFormula(comp.quantity_formula, formulaContext);
            if (formulaResult > 0) {
              calculatedQty = formulaResult * piecesQty * qty;
            }
          }

          if (calculatedQty <= 0) continue;

          accessoryMaterials.push({
            ordem_servico_id: ordemServicoId,
            os_item_id: item.id,
            item_template_id: comp.item_template_id,
            item_name: comp.item_template.name,
            item_type: comp.item_template.type,
            unit: comp.item_template.unit,
            pieces_count: calculatedQty,
            total_length_mm: 0,
            notes: `Componente do produto: ${item.product_name}`
          });
        }

        if (accessoryMaterials.length > 0) {
          await supabase.from('os_materials').insert(accessoryMaterials);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error generating OS documents:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Regenerate OS documents for a specific item or all items in an OS
 */
export async function regenerateOSDocuments(
  ordemServicoId: string,
  osItemId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('rebuild_os_documents_from_snapshot', {
      _ordem_servico_id: ordemServicoId,
      _os_item_id: osItemId ?? null,
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error regenerating OS documents:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
