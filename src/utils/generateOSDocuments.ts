// Generate OS Documents - Materials, Cutting Plan, Glass Projects

import { supabase } from '@/integrations/supabase/client';
import { Parser } from 'expr-eval';
import { optimizeProfiles, CutPiece } from './profileOptimization';

interface QuoteItem {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  product_template_id?: string | null;
  glass_thickness?: string | null;
  glass_color?: string | null;
}

interface ProductCompositionItem {
  id: string;
  item_template_id: string;
  quantity_formula: string;
  width_formula: string | null;
  height_formula: string | null;
  cut_angle: number;
  pieces_quantity: number;
  is_optional: boolean;
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
}

// Evaluate a formula with width/height variables
function evaluateFormula(formula: string, width: number, height: number): number {
  try {
    if (!formula || formula.trim() === '') return 0;
    
    const parser = new Parser();
    
    let normalized = formula
      .replace(/Largura/gi, 'W')
      .replace(/Altura/gi, 'H')
      .replace(/\bL\b/gi, 'W')
      .replace(/\bA\b/gi, 'H');
    
    const expr = parser.parse(normalized);
    const result = expr.evaluate({ W: width, H: height });
    
    if (isNaN(result) || !isFinite(result)) return 0;
    
    return Math.round(result);
  } catch (error) {
    console.warn('Error evaluating formula:', formula, error);
    return 0;
  }
}

// Get formula position (Altura or Largura)
function getFormulaPosition(formula: string | null): 'Altura' | 'Largura' {
  if (!formula) return 'Largura';
  const lower = formula.toLowerCase();
  if (lower.includes('altura') || lower.includes('a')) return 'Altura';
  return 'Largura';
}

/**
 * Fetch product composition from database
 */
async function getProductComposition(productTemplateId: string): Promise<ProductCompositionItem[]> {
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
      is_optional,
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
  return (data || []) as ProductCompositionItem[];
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
  return data || [];
}

/**
 * Get product template details
 */
async function getProductTemplate(productTemplateId: string) {
  const { data, error } = await supabase
    .from('product_templates')
    .select('id, name, linha, category')
    .eq('id', productTemplateId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generate all OS documents after quote approval
 */
export async function generateOSDocuments(
  ordemServicoId: string,
  quoteItems: QuoteItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const allCuts: CutPiece[] = [];
    
    // Process each quote item
    for (const item of quoteItems) {
      if (!item.product_template_id || !item.width || !item.height) continue;
      
      const width = item.width;
      const height = item.height;
      const quantity = item.quantity;

      // Get product template details
      const product = await getProductTemplate(item.product_template_id);
      if (!product) continue;

      // Get composition
      const composition = await getProductComposition(item.product_template_id);
      
      // Get glass formulas
      const glassFormulas = await getGlassFormulas(
        item.product_template_id,
        product.linha || ''
      );

      // Calculate profile cuts
      const profileCuts: Array<{
        profileName: string;
        formula: string;
        calculatedLength: number;
        quantity: number;
        cutAngle: number;
        position: string;
      }> = [];

      for (const comp of composition) {
        if (comp.item_template.type !== 'profile') continue;
        
        // The formula is in quantity_formula (e.g., "A - 20", "L - 31", "L / 2 - 91")
        // width_formula and height_formula are usually null
        const formula = comp.quantity_formula || comp.width_formula || comp.height_formula || '';
        const calculatedLength = evaluateFormula(formula, width, height);
        
        if (calculatedLength <= 0) continue;

        const piecesQty = comp.pieces_quantity || 1;
        const totalPieces = piecesQty * quantity;

        profileCuts.push({
          profileName: comp.item_template.name,
          formula,
          calculatedLength,
          quantity: totalPieces,
          cutAngle: comp.cut_angle,
          position: getFormulaPosition(formula),
        });

        // Add to optimization array
        allCuts.push({
          itemTemplateId: comp.item_template_id,
          itemName: comp.item_template.name,
          cutLength: calculatedLength,
          quantity: totalPieces,
          barLengthMm: comp.item_template.bar_length_mm || 6000,
          unit: comp.item_template.unit,
        });
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
      }> = [];

      for (const formula of glassFormulas) {
        const calcWidth = evaluateFormula(formula.width_formula, width, height);
        const calcHeight = evaluateFormula(formula.height_formula, width, height);
        
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
        });
      }

      // Insert cutting plan
      await supabase.from('os_cutting_plan').insert({
        ordem_servico_id: ordemServicoId,
        quote_item_id: item.id,
        product_name: item.description,
        product_template_id: item.product_template_id,
        vao_width: width,
        vao_height: height,
        quantity,
        cuts_data: profileCuts,
        glass_cuts_data: glassCuts,
      });

      // Insert glass project
      if (glassCuts.length > 0) {
        const panels = glassCuts.map((glass, index) => ({
          index: index + 1,
          name: glass.glassName,
          width: glass.calculatedWidth,
          height: glass.calculatedHeight,
          areaM2: glass.areaM2 / quantity,
          quantity: glass.quantity,
        }));

        const totalArea = glassCuts.reduce((sum, g) => sum + g.areaM2, 0);

        await supabase.from('os_glass_projects').insert({
          ordem_servico_id: ordemServicoId,
          quote_item_id: item.id,
          product_name: item.description,
          product_template_id: item.product_template_id,
          vao_width: width,
          vao_height: height,
          quantity,
          panels_data: panels,
          total_area_m2: totalArea,
          glass_type: item.glass_thickness,
          glass_color: item.glass_color,
        });
      }
    }

    // Optimize profiles and insert materials list
    if (allCuts.length > 0) {
      const optimized = optimizeProfiles(allCuts);

      const materialsToInsert = optimized.profiles.map(profile => ({
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
      }));

      await supabase.from('os_materials').insert(materialsToInsert);
    }

    return { success: true };
  } catch (error) {
    console.error('Error generating OS documents:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Regenerate OS documents (delete existing and recreate)
 */
export async function regenerateOSDocuments(
  ordemServicoId: string,
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete existing documents
    await Promise.all([
      supabase.from('os_materials').delete().eq('ordem_servico_id', ordemServicoId),
      supabase.from('os_cutting_plan').delete().eq('ordem_servico_id', ordemServicoId),
      supabase.from('os_glass_projects').delete().eq('ordem_servico_id', ordemServicoId),
    ]);

    // Fetch quote items
    const { data: quoteItems, error } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId);

    if (error) throw error;

    // Regenerate
    return generateOSDocuments(ordemServicoId, quoteItems || []);
  } catch (error) {
    console.error('Error regenerating OS documents:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
