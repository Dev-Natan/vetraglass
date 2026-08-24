import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
import { operationalErrorMessage } from '@/utils/operationalError';
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
  ordens_servico?: {
    os_number: number;
    customer_name: string;
  } | null;
}

export interface PurchaseRequirementAllocation {
  id: string;
  material_requirement_id: string;
  allocated_canonical_quantity: number;
  received_canonical_quantity: number;
  status: string;
  material_purchase_requirements?: {
    ordem_servico_id: string;
    ordens_servico?: {
      os_number: number;
      customer_name: string;
    } | null;
  } | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  company_item_id: string | null;
  variant_id: string | null;
  item_template_id: string | null;
  os_material_id: string | null;
  os_glass_project_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  purchase_unit: string | null;
  purchase_to_canonical_factor: number | null;
  ordered_canonical_quantity: number | null;
  purchase_allows_fractional: boolean;
  width_mm: number | null;
  height_mm: number | null;
  estimated_cost: number;
  actual_cost: number | null;
  status: 'pending' | 'ordered' | 'partial' | 'received' | 'cancelled';
  received_at: string | null;
  received_quantity: number;
  received_canonical_quantity: number;
  notes: string | null;
  created_at: string;
  allocations?: PurchaseRequirementAllocation[];
}

export interface MaterialPurchaseRequirement {
  id: string;
  company_id: string;
  ordem_servico_id: string;
  os_number: number;
  company_item_id: string;
  variant_id: string | null;
  item_name: string;
  item_code: string | null;
  canonical_unit: string;
  purchase_unit: string;
  purchase_to_canonical_factor: number;
  purchase_allows_fractional: boolean;
  required_canonical_quantity: number;
  reserved_canonical_quantity: number;
  shortage_canonical_quantity: number;
  open_order_canonical_quantity: number;
  purchase_required_canonical_quantity: number;
  suggested_purchase_quantity: number;
  status: string;
  priority: string;
}

export interface StockLocation {
  id: string;
  code: string;
  name: string;
  kind: string;
  needs_review: boolean;
}

export interface PurchaseRequirementLine {
  companyItemId: string;
  variantId: string | null;
  description: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  estimatedCost: number;
  allocations: Array<{
    requirementId: string;
    canonicalQuantity: number;
  }>;
}

function invalidatePurchases(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
  queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
  queryClient.invalidateQueries({ queryKey: ['purchase-order-items'] });
  queryClient.invalidateQueries({ queryKey: ['pending-purchases-count'] });
  queryClient.invalidateQueries({ queryKey: ['material-purchase-requirements'] });
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
          total_estimated, total_actual, expected_delivery, received_at, notes,
          created_at, updated_at,
          ordens_servico:ordens_servico(os_number, customer_name)
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);

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
        .select(`*, ordens_servico:ordens_servico(os_number, customer_name)`)
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
        .select(`
          id, purchase_order_id, company_item_id, variant_id, item_template_id,
          os_material_id, os_glass_project_id, description, quantity, unit,
          purchase_unit, purchase_to_canonical_factor, ordered_canonical_quantity,
          purchase_allows_fractional,
          width_mm, height_mm, estimated_cost, actual_cost, status, received_at,
          received_quantity, received_canonical_quantity, notes, created_at,
          allocations:purchase_order_item_requirement_allocations(
            id, material_requirement_id, allocated_canonical_quantity,
            received_canonical_quantity, status,
            material_purchase_requirements(
              ordem_servico_id,
              ordens_servico(os_number, customer_name)
            )
          )
        `)
        .eq('purchase_order_id', purchaseOrderId)
        .order('created_at');

      if (error) throw error;
      return data as unknown as PurchaseOrderItem[];
    },
    enabled: !!purchaseOrderId,
  });
}

export function useMaterialPurchaseRequirements() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['material-purchase-requirements', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('material_purchase_requirements_summary')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('lifecycle_status', 'ACTIVE')
        .gt('purchase_required_canonical_quantity', 0)
        .order('priority')
        .order('created_at');

      if (error) throw error;
      return (data || []).flatMap((row) => {
        if (!row.id || !row.company_id || !row.ordem_servico_id || row.os_number == null ||
            !row.company_item_id || !row.item_name || !row.canonical_unit ||
            !row.purchase_unit || !row.purchase_to_canonical_factor) return [];
        return [{
          ...row,
          id: row.id,
          company_id: row.company_id,
          ordem_servico_id: row.ordem_servico_id,
          os_number: row.os_number,
          company_item_id: row.company_item_id,
          item_name: row.item_name,
          canonical_unit: row.canonical_unit,
          purchase_unit: row.purchase_unit,
          purchase_to_canonical_factor: Number(row.purchase_to_canonical_factor),
          purchase_allows_fractional: row.purchase_allows_fractional === true,
          required_canonical_quantity: Number(row.required_canonical_quantity || 0),
          reserved_canonical_quantity: Number(row.reserved_canonical_quantity || 0),
          shortage_canonical_quantity: Number(row.shortage_canonical_quantity || 0),
          open_order_canonical_quantity: Number(row.open_order_canonical_quantity || 0),
          purchase_required_canonical_quantity: Number(row.purchase_required_canonical_quantity || 0),
          suggested_purchase_quantity: Number(row.suggested_purchase_quantity || 0),
          status: row.status || 'PURCHASE_REQUIRED',
          priority: row.priority || 'NORMAL',
        } satisfies MaterialPurchaseRequirement];
      });
    },
    enabled: !!currentCompany?.id,
  });
}

export function useStockLocations() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['stock-locations', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('stock_locations')
        .select('id, code, name, kind, needs_review')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .eq('needs_review', false)
        .order('name');
      if (error) throw error;
      return data as StockLocation[];
    },
    enabled: !!currentCompany?.id,
  });
}

export function usePhase3GCapabilities() {
  const { user, currentCompany } = useAuth();

  return useQuery({
    queryKey: ['phase3g-capabilities', currentCompany?.id, user?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !user?.id) {
        return { canCreatePurchase: false, canApprove: false, canReceive: false, canManageRequirements: false };
      }
      const checks = [
        ['purchases', 'create'],
        ['purchase-approval', 'edit'],
        ['purchase-receiving', 'create'],
        ['material-requirements', 'edit'],
      ] as const;
      const results = await Promise.all(checks.map(async ([module, action]) => {
        const { data, error } = await supabase.rpc('phase3g_user_can', {
          _user_id: user.id,
          _company_id: currentCompany.id,
          _module: module,
          _action: action,
        });
        if (error) throw error;
        return data;
      }));
      return {
        canCreatePurchase: results[0],
        canApprove: results[1],
        canReceive: results[2],
        canManageRequirements: results[3],
      };
    },
    enabled: !!currentCompany?.id && !!user?.id,
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
        .in('status', ['pending', 'ordered', 'partial']);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentCompany?.id,
  });
}

export function useCreatePurchaseOrderFromRequirements() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      supplierName,
      expectedDelivery,
      notes,
      idempotencyKey,
      lines,
    }: {
      supplierName: string;
      expectedDelivery?: string;
      notes?: string;
      idempotencyKey: string;
      lines: PurchaseRequirementLine[];
    }) => {
      if (!currentCompany?.id) throw new Error('Empresa ativa não encontrada.');
      const { data, error } = await supabase.rpc('create_purchase_order_from_requirements', {
        _company_id: currentCompany.id,
        _supplier_name: supplierName,
        _expected_delivery: expectedDelivery || undefined,
        _notes: notes || undefined,
        _idempotency_key: idempotencyKey,
        _items: lines.map((line) => ({
          company_item_id: line.companyItemId,
          variant_id: line.variantId,
          description: line.description,
          purchase_quantity: line.purchaseQuantity,
          purchase_unit: line.purchaseUnit,
          estimated_cost: line.estimatedCost,
          allocations: line.allocations.map((allocation) => ({
            requirement_id: allocation.requirementId,
            canonical_quantity: allocation.canonicalQuantity,
          })),
        })),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidatePurchases(queryClient);
      toast.success('Pedido criado a partir das necessidades selecionadas.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Erro ao criar pedido de compra.')),
  });
}

export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchaseOrderId: string) => {
      const { data, error } = await supabase.rpc('approve_purchase_order', {
        _purchase_order_id: purchaseOrderId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidatePurchases(queryClient);
      toast.success('Pedido aprovado e enviado ao fornecedor.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Erro ao aprovar pedido.')),
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchaseOrderId: string) => {
      const { data, error } = await supabase.rpc('cancel_purchase_order', {
        _purchase_order_id: purchaseOrderId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidatePurchases(queryClient);
      toast.success('Pedido cancelado; necessidades foram reconciliadas.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Erro ao cancelar pedido.')),
  });
}

export function useReceivePurchaseOrderItems() {
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();

  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      locationId,
      receiptKey,
      documentReference,
      items,
    }: {
      purchaseOrderId: string;
      locationId: string;
      receiptKey: string;
      documentReference?: string;
      items: Array<{
        id: string;
        variantId: string | null;
        receivedQuantity: number;
        totalCost: number;
      }>;
    }) => {
      const { data, error } = await supabase.rpc('receive_purchase_order_items', {
        _purchase_order_id: purchaseOrderId,
        _location_id: locationId,
        _receipt_key: receiptKey,
        _document_reference: documentReference || undefined,
        _items: items.map((item) => ({
          purchase_order_item_id: item.id,
          variant_id: item.variantId,
          received_quantity: item.receivedQuantity,
          total_cost: item.totalCost,
        })),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidatePurchases(queryClient);
      queryClient.invalidateQueries({ queryKey: ['stock-locations'] });
      queryClient.invalidateQueries({ queryKey: ['physical-inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['os-material-availability'] });
      invalidateStock();
      toast.success('Recebimento físico registrado e necessidades reconciliadas.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Erro ao receber itens.')),
  });
}
