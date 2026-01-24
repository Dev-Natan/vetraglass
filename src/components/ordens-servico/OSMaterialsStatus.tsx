import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, CheckCircle2, Truck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseOrdersByOS } from '@/hooks/usePurchaseOrders';

interface OSMaterialsStatusProps {
  ordemServicoId: string;
}

export function OSMaterialsStatus({ ordemServicoId }: OSMaterialsStatusProps) {
  const navigate = useNavigate();
  const { data: purchaseOrders, isLoading } = usePurchaseOrdersByOS(ordemServicoId);
  
  if (isLoading) {
    return null;
  }
  
  if (!purchaseOrders || purchaseOrders.length === 0) {
    return null;
  }
  
  const pendingOrders = purchaseOrders.filter(po => po.status === 'pending');
  const orderedOrders = purchaseOrders.filter(po => po.status === 'ordered');
  const partialOrders = purchaseOrders.filter(po => po.status === 'partial');
  const receivedOrders = purchaseOrders.filter(po => po.status === 'received');
  
  const hasPendingMaterials = pendingOrders.length > 0 || orderedOrders.length > 0 || partialOrders.length > 0;
  const allReceived = receivedOrders.length === purchaseOrders.length;
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  
  const totalPending = [...pendingOrders, ...orderedOrders, ...partialOrders].reduce(
    (sum, po) => sum + po.total_estimated,
    0
  );
  
  return (
    <Card className={hasPendingMaterials ? 'border-warning' : 'border-primary/30'}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {hasPendingMaterials ? (
              <div className="p-2 bg-warning/10 rounded-full">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
            ) : (
              <div className="p-2 bg-primary/10 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
            )}
            
            <div>
              <h4 className="font-medium">
                {allReceived 
                  ? 'Materiais Disponíveis'
                  : 'Materiais Pendentes'
                }
              </h4>
              
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
                {allReceived && (
                  <Badge variant="outline" className="text-xs border-primary text-primary">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Todos recebidos
                  </Badge>
                )}
              </div>
              
              {hasPendingMaterials && (
                <p className="text-sm text-muted-foreground mt-2">
                  Valor estimado: {formatCurrency(totalPending)}
                </p>
              )}
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
            onClick={() => navigate('/pedidos-compra')}
          >
            <ExternalLink className="w-4 h-4" />
            Ver Pedidos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
