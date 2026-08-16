import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
import { toast } from 'sonner';

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
          id, company_id, ordem_servico_id, order_number, supplier_name, status,
          total_estimated, total_actual, expected_delivery, received_at, notes, created_at,
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
        .select('id, purchase_order_id, item_template_id, os_material_id, os_glass_project_id, description, quantity, unit, width_mm, height_mm, estimated_cost, actual_cost, status, received_at, received_quantity, notes, created_at')
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
        .select('id, company_id, ordem_servico_id, order_number, supplier_name, status, total_estimated, total_actual, expected_delivery, received_at, notes, created_at')
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
    
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();
  
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
      const updateData: Record<string, string> = { status };
      
      if (supplierName) updateData.supplier_name = supplierName;
      if (expectedDelivery) updateData.expected_delivery = expectedDelivery;
      if (status === 'received') updateData.received_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData as never)
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
  const invalidateStock = useInvalidateStock();
  
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
      const { data, error } = await supabase.rpc('receive_purchase_order_items', {
        _purchase_order_id: purchaseOrderId,
        _items: items.map((item) => ({
          id: item.id,
          actual_cost: item.actualCost,
          received_quantity: item.receivedQuantity,
        })),
        _total_actual: totalActual,
      });

      if (error) throw error;

      const result = data as { success?: boolean } | null;
      if (!result?.success) {
        throw new Error('O recebimento transacional não foi confirmado');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['pending-purchases-count'] });
      queryClient.invalidateQueries({ queryKey: ['os-glass-projects'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['material-consumption'] });
      toast.success('Itens recebidos e estoque atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao receber itens: ' + error.message);
    },
  });
}
