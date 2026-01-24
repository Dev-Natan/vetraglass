// Create Purchase Order for On-Demand Materials (Glass)

import { supabase } from '@/integrations/supabase/client';

interface GlassPanel {
  name: string;
  width: number;
  height: number;
  areaM2: number;
  quantity: number;
  isMovable?: boolean;
}

interface GlassProject {
  id: string;
  product_name: string;
  glass_type?: string;
  glass_color?: string;
  quantity: number;
  panels_data: GlassPanel[];
  total_area_m2: number;
}

interface PurchaseOrderResult {
  success: boolean;
  purchaseOrderId?: string;
  error?: string;
}

/**
 * Create a purchase order for on-demand materials from an OS
 */
export async function createPurchaseOrderFromOS(
  ordemServicoId: string,
  companyId: string,
  glassProjects: GlassProject[]
): Promise<PurchaseOrderResult> {
  try {
    if (glassProjects.length === 0) {
      return { success: true }; // No glass to purchase
    }

    // Calculate estimated total (basic estimation - can be improved with price tables)
    const estimatedTotal = glassProjects.reduce((sum, project) => {
      // Basic estimation: R$150/m² for glass (can be configured)
      return sum + (project.total_area_m2 * 150);
    }, 0);

    // Create purchase order
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        company_id: companyId,
        ordem_servico_id: ordemServicoId,
        supplier_name: null, // To be filled by user
        status: 'pending',
        total_estimated: estimatedTotal,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (poError) throw poError;

    // Create purchase order items for each glass panel
    const purchaseItems = [];
    
    for (const project of glassProjects) {
      const panels = Array.isArray(project.panels_data) ? project.panels_data : [];
      
      for (const panel of panels) {
        const description = `${panel.name} - ${project.glass_type || 'Vidro'} ${project.glass_color || ''} - ${panel.width}x${panel.height}mm`;
        const estimatedCost = (panel.areaM2 || 0) * 150 * (project.quantity || 1);
        
        purchaseItems.push({
          purchase_order_id: purchaseOrder.id,
          os_glass_project_id: project.id,
          description: description.trim(),
          quantity: project.quantity || 1,
          unit: 'pç',
          width_mm: panel.width,
          height_mm: panel.height,
          estimated_cost: estimatedCost,
          status: 'pending',
        });
      }
    }

    if (purchaseItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Update glass projects with procurement status
      const projectIds = glassProjects.map(p => p.id);
      await supabase
        .from('os_glass_projects')
        .update({ procurement_status: 'pending_purchase' })
        .in('id', projectIds);
    }

    return { success: true, purchaseOrderId: purchaseOrder.id };
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar pedido de compra',
    };
  }
}

/**
 * Update purchase order item as received
 */
export async function receivePurchaseOrderItem(
  itemId: string,
  actualCost: number,
  receivedQuantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('purchase_order_items')
      .update({
        status: 'received',
        actual_cost: actualCost,
        received_quantity: receivedQuantity,
        received_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) throw error;

    // Update parent purchase order status
    await updatePurchaseOrderStatus(itemId);

    return { success: true };
  } catch (error) {
    console.error('Error receiving purchase order item:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao receber item',
    };
  }
}

/**
 * Update purchase order status based on items
 */
async function updatePurchaseOrderStatus(itemId: string): Promise<void> {
  // Get the purchase order ID
  const { data: item } = await supabase
    .from('purchase_order_items')
    .select('purchase_order_id')
    .eq('id', itemId)
    .single();

  if (!item) return;

  // Get all items for this purchase order
  const { data: allItems } = await supabase
    .from('purchase_order_items')
    .select('status')
    .eq('purchase_order_id', item.purchase_order_id);

  if (!allItems) return;

  const totalItems = allItems.length;
  const receivedItems = allItems.filter(i => i.status === 'received').length;

  let newStatus = 'pending';
  if (receivedItems === totalItems) {
    newStatus = 'received';
  } else if (receivedItems > 0) {
    newStatus = 'partial';
  }

  await supabase
    .from('purchase_orders')
    .update({
      status: newStatus,
      received_at: newStatus === 'received' ? new Date().toISOString() : null,
      total_actual: allItems
        .filter(i => i.status === 'received')
        .reduce((sum, i: any) => sum + (i.actual_cost || 0), 0),
    })
    .eq('id', item.purchase_order_id);
}

/**
 * Mark purchase order as sent to supplier
 */
export async function markPurchaseOrderAsOrdered(
  purchaseOrderId: string,
  supplierName: string,
  expectedDelivery?: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'ordered',
        supplier_name: supplierName,
        expected_delivery: expectedDelivery?.toISOString().split('T')[0],
      })
      .eq('id', purchaseOrderId);

    if (error) throw error;

    // Update all glass projects linked to this PO
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('os_glass_project_id')
      .eq('purchase_order_id', purchaseOrderId)
      .not('os_glass_project_id', 'is', null);

    if (items && items.length > 0) {
      const glassProjectIds = items.map(i => i.os_glass_project_id).filter(Boolean);
      await supabase
        .from('os_glass_projects')
        .update({ procurement_status: 'ordered' })
        .in('id', glassProjectIds);
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking purchase order as ordered:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar pedido',
    };
  }
}

/**
 * Receive all items in a purchase order
 */
export async function receiveEntirePurchaseOrder(
  purchaseOrderId: string,
  items: Array<{ id: string; actualCost: number; receivedQuantity: number }>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update all items
    for (const item of items) {
      await supabase
        .from('purchase_order_items')
        .update({
          status: 'received',
          actual_cost: item.actualCost,
          received_quantity: item.receivedQuantity,
          received_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    }

    // Calculate total actual cost
    const totalActual = items.reduce((sum, i) => sum + i.actualCost, 0);

    // Update purchase order
    await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        received_at: new Date().toISOString(),
        total_actual: totalActual,
      })
      .eq('id', purchaseOrderId);

    // Update all glass projects linked to this PO
    const { data: poItems } = await supabase
      .from('purchase_order_items')
      .select('os_glass_project_id')
      .eq('purchase_order_id', purchaseOrderId)
      .not('os_glass_project_id', 'is', null);

    if (poItems && poItems.length > 0) {
      const glassProjectIds = poItems.map(i => i.os_glass_project_id).filter(Boolean);
      await supabase
        .from('os_glass_projects')
        .update({ procurement_status: 'received' })
        .in('id', glassProjectIds);
    }

    return { success: true };
  } catch (error) {
    console.error('Error receiving purchase order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao receber pedido',
    };
  }
}
