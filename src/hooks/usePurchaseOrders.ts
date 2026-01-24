import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CACHE_TIMES } from '@/lib/queryConfig';

export interface PurchaseOrder {
  id: string;
  company_id: string;
  ordem_servico_id: string | null;
  order_number: number;
  supplier_name: string | null;
  status: 'pending' | 'ordered' | 'partial' | 'received' | 'cancelled';
  total_estimated: number;
  total_actual: number | null;
  expected_delivery: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  ordens_servico?: {
    os_number: number;
    customer_name: string;
  } | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  item_template_id: string | null;
  os_material_id: string | null;
  os_glass_project_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  width_mm: number | null;
  height_mm: number | null;
  estimated_cost: number;
  actual_cost: number | null;
  status: 'pending' | 'received';
  received_at: string | null;
  received_quantity: number;
  notes: string | null;
  created_at: string;
}

export function usePurchaseOrders(statusFilter?: string) {
  const { currentCompany } = useAuth();
  
  return useQuery({
    queryKey: ['purchase-orders', currentCompany?.id, statusFilter],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          ordens_servico:ordens_servico(os_number, customer_name)
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });
}

export function usePurchaseOrder(purchaseOrderId: string) {
  return useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          ordens_servico:ordens_servico(os_number, customer_name, customer_phone)
        `)
        .eq('id', purchaseOrderId)
        .single();
      
      if (error) throw error;
      return data as PurchaseOrder;
    },
    enabled: !!purchaseOrderId,
  });
}

export function usePurchaseOrderItems(purchaseOrderId: string) {
  return useQuery({
    queryKey: ['purchase-order-items', purchaseOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', purchaseOrderId)
        .order('created_at');
      
      if (error) throw error;
      return data as PurchaseOrderItem[];
    },
    enabled: !!purchaseOrderId,
  });
}

export function usePurchaseOrdersByOS(ordemServicoId: string) {
  return useQuery({
    queryKey: ['purchase-orders-os', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!ordemServicoId,
  });
}

export function usePendingPurchasesCount() {
  const { currentCompany } = useAuth();
  
  return useQuery({
    queryKey: ['pending-purchases-count', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return 0;
      
      const { count, error } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'ordered']);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      supplierName, 
      expectedDelivery 
    }: { 
      id: string; 
      status: string; 
      supplierName?: string;
      expectedDelivery?: string;
    }) => {
      const updateData: Record<string, any> = { status };
      
      if (supplierName) updateData.supplier_name = supplierName;
      if (expectedDelivery) updateData.expected_delivery = expectedDelivery;
      if (status === 'received') updateData.received_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
      queryClient.invalidateQueries({ queryKey: ['pending-purchases-count'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

export function useReceivePurchaseOrderItems() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      purchaseOrderId, 
      items,
      totalActual,
    }: { 
      purchaseOrderId: string; 
      items: Array<{ id: string; actualCost: number; receivedQuantity: number }>;
      totalActual: number;
    }) => {
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
      
      // Check if all items are received
      const { data: allItems } = await supabase
        .from('purchase_order_items')
        .select('status')
        .eq('purchase_order_id', purchaseOrderId);
      
      const allReceived = allItems?.every(i => i.status === 'received');
      const someReceived = allItems?.some(i => i.status === 'received');
      
      // Update purchase order status
      await supabase
        .from('purchase_orders')
        .update({
          status: allReceived ? 'received' : someReceived ? 'partial' : 'ordered',
          total_actual: totalActual,
          received_at: allReceived ? new Date().toISOString() : null,
        })
        .eq('id', purchaseOrderId);
      
      // Update glass projects procurement status
      const receivedItemIds = items.map(i => i.id);
      const { data: itemsWithGlass } = await supabase
        .from('purchase_order_items')
        .select('os_glass_project_id')
        .in('id', receivedItemIds)
        .not('os_glass_project_id', 'is', null);
      
      if (itemsWithGlass && itemsWithGlass.length > 0) {
        const glassIds = itemsWithGlass.map(i => i.os_glass_project_id).filter(Boolean);
        await supabase
          .from('os_glass_projects')
          .update({ procurement_status: 'received' })
          .in('id', glassIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['pending-purchases-count'] });
      queryClient.invalidateQueries({ queryKey: ['os-glass-projects'] });
      toast.success('Itens recebidos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao receber itens: ' + error.message);
    },
  });
}
