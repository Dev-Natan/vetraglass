import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, CheckCircle2, Truck, ExternalLink, Warehouse, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseOrdersByOS } from '@/hooks/usePurchaseOrders';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OSMaterialsStatusProps {
  ordemServicoId: string;
}

export function OSMaterialsStatus({ ordemServicoId }: OSMaterialsStatusProps) {
  const navigate = useNavigate();
  const { data: purchaseOrders, isLoading: loadingPO } = usePurchaseOrdersByOS(ordemServicoId);
  
  // Fetch glass projects with material origin info
  const { data: glassProjects, isLoading: loadingGlass } = useQuery({
    queryKey: ['os-glass-projects-status', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_glass_projects')
        .select('id, product_name, material_origin, stock_quantity_used, purchase_quantity_needed, total_area_m2, procurement_status, glass_type, glass_color')
        .eq('ordem_servico_id', ordemServicoId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!ordemServicoId,
  });

  // Fetch stock reservations for this OS
  const { data: reservations } = useQuery({
    queryKey: ['stock-reservations', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_reservations')
        .select('*, company_items:company_item_id(name)')
        .eq('ordem_servico_id', ordemServicoId)
        .eq('status', 'reserved');
      if (error) throw error;
      return data || [];
    },
    enabled: !!ordemServicoId,
  });
  
  if (loadingPO || loadingGlass) {
    return null;
  }
  
  // Calculate summary
  const stockItems = glassProjects?.filter(g => g.material_origin === 'stock') || [];
  const purchaseItems = glassProjects?.filter(g => g.material_origin === 'purchase') || [];
  const mixedItems = glassProjects?.filter(g => g.material_origin === 'mixed') || [];
  
  const pendingOrders = purchaseOrders?.filter(po => po.status === 'pending') || [];
  const orderedOrders = purchaseOrders?.filter(po => po.status === 'ordered') || [];
  const partialOrders = purchaseOrders?.filter(po => po.status === 'partial') || [];
  const receivedOrders = purchaseOrders?.filter(po => po.status === 'received') || [];
  
  const hasPendingPurchase = pendingOrders.length > 0 || orderedOrders.length > 0 || partialOrders.length > 0;
  const allPurchaseReceived = purchaseItems.length === 0 || receivedOrders.length === (purchaseOrders?.length || 0);
  const hasStockReservations = (reservations?.length || 0) > 0;
  
  // If no glass projects at all, don't show
  if (!glassProjects || glassProjects.length === 0) {
    return null;
  }
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatArea = (value: number) => `${value.toFixed(2)} m²`;
  
  const totalPending = [...pendingOrders, ...orderedOrders, ...partialOrders].reduce(
    (sum, po) => sum + po.total_estimated,
    0
  );

  const allMaterialsReady = !hasPendingPurchase && (stockItems.length > 0 || allPurchaseReceived);
  
  return (
    <Card className={hasPendingPurchase ? 'border-warning' : allMaterialsReady ? 'border-primary/30' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {hasPendingPurchase ? (
              <div className="p-2 bg-warning/10 rounded-full">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
            ) : (
              <div className="p-2 bg-primary/10 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
            )}
            
            <div className="space-y-2">
              <h4 className="font-medium">
                {allMaterialsReady 
                  ? 'Materiais Disponíveis'
                  : 'Materiais para Produção'
                }
              </h4>
              
              {/* Material Details */}
              <div className="space-y-1">
                {glassProjects?.map(glass => (
                  <div key={glass.id} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {glass.product_name}
                    </span>
                    <MaterialOriginBadge 
                      origin={glass.material_origin as 'stock' | 'purchase' | 'mixed' | 'pending'}
                      stockQty={glass.stock_quantity_used}
                      purchaseQty={glass.purchase_quantity_needed}
                      procurementStatus={glass.procurement_status}
                    />
                  </div>
                ))}
              </div>
              
              {/* Stock Reservations Summary */}
              {hasStockReservations && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                    <Warehouse className="w-3 h-3 mr-1" />
                    {reservations?.reduce((sum, r) => sum + r.quantity_reserved, 0).toFixed(2)} m² reservado
                  </Badge>
                </div>
              )}
              
              {/* Purchase Order Status */}
              {purchaseOrders && purchaseOrders.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {pendingOrders.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Package className="w-3 h-3 mr-1" />
                      {pendingOrders.length} aguardando pedido
                    </Badge>
                  )}
                  {orderedOrders.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Truck className="w-3 h-3 mr-1" />
                      {orderedOrders.length} em transporte
                    </Badge>
                  )}
                  {partialOrders.length > 0 && (
                    <Badge variant="outline" className="text-xs border-warning text-warning">
                      {partialOrders.length} recebido parcial
                    </Badge>
                  )}
                  {allPurchaseReceived && purchaseItems.length > 0 && (
                    <Badge variant="outline" className="text-xs border-primary text-primary">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Compras recebidas
                    </Badge>
                  )}
                </div>
              )}
              
              {hasPendingPurchase && (
                <p className="text-sm text-muted-foreground mt-2">
                  Valor estimado: {formatCurrency(totalPending)}
                </p>
              )}
            </div>
          </div>
          
          {purchaseOrders && purchaseOrders.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2"
              onClick={() => navigate('/pedidos-compra')}
            >
              <ExternalLink className="w-4 h-4" />
              Ver Pedidos
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MaterialOriginBadge({ 
  origin, 
  stockQty, 
  purchaseQty,
  procurementStatus 
}: { 
  origin: 'stock' | 'purchase' | 'mixed' | 'pending';
  stockQty?: number;
  purchaseQty?: number;
  procurementStatus?: string;
}) {
  // Show status-specific badges for purchase items
  if (origin === 'purchase' || origin === 'pending') {
    if (procurementStatus === 'received') {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1.5">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Recebido
        </Badge>
      );
    }
    if (procurementStatus === 'ordered') {
      return (
        <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5">
          <Truck className="w-3 h-3 mr-1" />
          Em transporte
        </Badge>
      );
    }
    return (
      <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5">
        <ShoppingCart className="w-3 h-3 mr-1" />
        A comprar
      </Badge>
    );
  }

  if (origin === 'stock') {
    return (
      <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1.5">
        <Warehouse className="w-3 h-3 mr-1" />
        {stockQty ? `${stockQty.toFixed(2)} m² estoque` : 'Estoque'}
      </Badge>
    );
  }

  if (origin === 'mixed') {
    return (
      <div className="flex gap-1">
        {stockQty && stockQty > 0 && (
          <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1.5">
            <Warehouse className="w-3 h-3 mr-0.5" />
            {stockQty.toFixed(1)} m²
          </Badge>
        )}
        {purchaseQty && purchaseQty > 0 && (
          <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5">
            <ShoppingCart className="w-3 h-3 mr-0.5" />
            {purchaseQty.toFixed(1)} m²
          </Badge>
        )}
      </div>
    );
  }

  return null;
}
