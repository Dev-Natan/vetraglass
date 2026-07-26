// Check Glass Stock Availability and Create Reservations

import { supabase } from '@/integrations/supabase/client';

export interface GlassStockCheck {
  hasStock: boolean;
  stockItemId: string | null;
  stockItemName: string | null;
  availableQty: number;
  unitCost: number;
  neededQty: number;
  useFromStock: number;
  needToPurchase: number;
  origin: 'stock' | 'purchase' | 'mixed';
}

export interface MaterialAvailability {
  id: string;
  description: string;
  glassType: string | null;
  glassColor: string | null;
  needed: number;
  available: number;
  useFromStock: number;
  needToPurchase: number;
  origin: 'stock' | 'purchase' | 'mixed';
  stockItemId: string | null;
  stockItemName: string | null;
  unitCost: number;
}

/**
 * Check glass stock availability for a specific glass type
 * Matches based on glass_thickness and glass_color fields in company_items
 * Falls back to name-based matching if specific fields aren't populated
 */
export async function checkGlassStockAvailability(
  companyId: string,
  glassThickness: string | null,
  glassColor: string | null,
  neededAreaM2: number
): Promise<GlassStockCheck> {
  try {
    // Build matching conditions
    // Try to find matching glass in company_items with stock
    let query = supabase
      .from('company_items')
      .select(`
        id,
        name,
        cost,
        glass_thickness,
        glass_color,
        company_stock!inner(
          id,
          quantity,
          company_item_id
        )
      `)
      .eq('company_id', companyId)
      .eq('type', 'glass')
      .eq('is_active', true);

    const { data: glassItems, error } = await query;

    if (error) {
      console.error('Error fetching glass items:', error);
      return createEmptyResult(neededAreaM2);
    }

    if (!glassItems || glassItems.length === 0) {
      return createEmptyResult(neededAreaM2);
    }

    // Find matching glass item
    // Priority: 1. Exact match on glass_thickness + glass_color fields
    //           2. Name contains thickness pattern
    let matchedItem = null;
    
    for (const item of glassItems) {
      // Check exact field match first
      if (glassThickness && glassColor) {
        const thicknessMatch = String(item.glass_thickness ?? '').toLowerCase() === glassThickness.toLowerCase() ||
                               String(item.glass_thickness ?? '').includes(glassThickness.replace('mm', ''));
        const colorMatch = item.glass_color?.toLowerCase() === glassColor.toLowerCase() ||
                           item.name.toLowerCase().includes(glassColor.toLowerCase());
        
        if (thicknessMatch && colorMatch) {
          matchedItem = item;
          break;
        }
      }
      
      // Fallback: name-based matching
      const thicknessInName = glassThickness && item.name.toLowerCase().includes(glassThickness.toLowerCase());
      const colorInName = glassColor && item.name.toLowerCase().includes(glassColor.toLowerCase());
      
      if (thicknessInName && colorInName) {
        matchedItem = item;
        break;
      }
      
      // If only thickness, match on that
      if (thicknessInName && !matchedItem) {
        matchedItem = item;
        // Continue looking for better match
      }
    }

    if (!matchedItem) {
      return createEmptyResult(neededAreaM2);
    }

    // Get stock with active reservations subtracted
    const stockData = Array.isArray(matchedItem.company_stock) 
      ? matchedItem.company_stock[0] 
      : matchedItem.company_stock;
    
    const currentStock = stockData?.quantity || 0;
    
    // Get active reservations for this item
    const { data: reservations } = await supabase
      .from('stock_reservations')
      .select('quantity_reserved')
      .eq('company_item_id', matchedItem.id)
      .eq('status', 'reserved');

    const totalReserved = reservations?.reduce((sum, r) => sum + (r.quantity_reserved || 0), 0) || 0;
    const availableQty = Math.max(0, currentStock - totalReserved);

    // Calculate how much to use from stock vs purchase
    const useFromStock = Math.min(availableQty, neededAreaM2);
    const needToPurchase = Math.max(0, neededAreaM2 - useFromStock);

    // Determine origin
    let origin: 'stock' | 'purchase' | 'mixed';
    if (needToPurchase === 0) {
      origin = 'stock';
    } else if (useFromStock === 0) {
      origin = 'purchase';
    } else {
      origin = 'mixed';
    }

    return {
      hasStock: availableQty > 0,
      stockItemId: matchedItem.id,
      stockItemName: matchedItem.name,
      availableQty,
      unitCost: matchedItem.cost || 0,
      neededQty: neededAreaM2,
      useFromStock,
      needToPurchase,
      origin,
    };
  } catch (error) {
    console.error('Error checking glass stock:', error);
    return createEmptyResult(neededAreaM2);
  }
}

function createEmptyResult(neededQty: number): GlassStockCheck {
  return {
    hasStock: false,
    stockItemId: null,
    stockItemName: null,
    availableQty: 0,
    unitCost: 0,
    neededQty: neededQty,
    useFromStock: 0,
    needToPurchase: neededQty,
    origin: 'purchase',
  };
}

/**
 * Check availability for all materials in a quote
 */
export async function checkAllMaterialsAvailability(
  quoteItems: Array<{
    id: string;
    description: string;
    glass_thickness?: string | null;
    glass_color?: string | null;
    width?: number | null;
    height?: number | null;
    quantity: number;
    has_glass?: boolean | null;
    product_template_id?: string | null;
  }>,
  companyId: string
): Promise<MaterialAvailability[]> {
  const results: MaterialAvailability[] = [];

  for (const item of quoteItems) {
    // Only check items that have glass
    if (!item.product_template_id) continue;
    
    // Calculate area in m²
    const width = item.width || 0;
    const height = item.height || 0;
    const areaPerPiece = (width / 1000) * (height / 1000);
    const totalArea = areaPerPiece * item.quantity;

    if (totalArea <= 0) continue;

    const stockCheck = await checkGlassStockAvailability(
      companyId,
      item.glass_thickness || null,
      item.glass_color || null,
      totalArea
    );

    results.push({
      id: item.id,
      description: item.description,
      glassType: item.glass_thickness || null,
      glassColor: item.glass_color || null,
      needed: totalArea,
      available: stockCheck.availableQty,
      useFromStock: stockCheck.useFromStock,
      needToPurchase: stockCheck.needToPurchase,
      origin: stockCheck.origin,
      stockItemId: stockCheck.stockItemId,
      stockItemName: stockCheck.stockItemName,
      unitCost: stockCheck.unitCost,
    });
  }

  return results;
}

/**
 * Create a stock reservation for an OS
 */
export async function createStockReservation(
  companyId: string,
  companyItemId: string,
  ordemServicoId: string,
  osGlassProjectId: string | null,
  quantityM2: number,
  unitCost: number
): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('stock_reservations')
      .insert({
        company_id: companyId,
        company_item_id: companyItemId,
        ordem_servico_id: ordemServicoId,
        os_glass_project_id: osGlassProjectId,
        quantity_reserved: quantityM2,
        unit: 'm²',
        unit_cost: unitCost,
        status: 'reserved',
        created_by: user?.user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, reservationId: data.id };
  } catch (error) {
    console.error('Error creating stock reservation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar reserva',
    };
  }
}

/**
 * Cancel a stock reservation (e.g., when cancelling an OS)
 */
export async function cancelStockReservation(
  reservationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('stock_reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', reservationId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error cancelling stock reservation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao cancelar reserva',
    };
  }
}

// NOTE: A função consumeOSMaterials() foi removida.
// A baixa de estoque ao concluir uma OS agora é feita via
// RomaneioReviewDialog → applyRomaneioBaixa() (revisão manual).
