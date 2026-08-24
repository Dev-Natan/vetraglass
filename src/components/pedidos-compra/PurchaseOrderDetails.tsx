import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  Truck, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Clock,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePurchaseOrder, usePurchaseOrderItems } from '@/hooks/usePurchaseOrders';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  ordered: { label: 'Pedido Enviado', variant: 'default' },
  partial: { label: 'Recebido Parcial', variant: 'outline' },
  received: { label: 'Recebido', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

interface PurchaseOrderDetailsProps {
  purchaseOrderId: string;
  onBack: () => void;
  onMarkOrdered?: () => void;
  onReceive?: () => void;
  onCancel?: () => void;
}

export function PurchaseOrderDetails({ 
  purchaseOrderId, 
  onBack,
  onMarkOrdered,
  onReceive,
  onCancel,
}: PurchaseOrderDetailsProps) {
  const { data: order, isLoading: orderLoading } = usePurchaseOrder(purchaseOrderId);
  const { data: items, isLoading: itemsLoading } = usePurchaseOrderItems(purchaseOrderId);
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  
  if (orderLoading || itemsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  
  if (!order) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Pedido não encontrado.
      </div>
    );
  }
  
  const status = statusConfig[order.status] || statusConfig.pending;
  const pendingItems = items?.filter(i => ['pending', 'ordered', 'partial'].includes(i.status)) || [];
  const receivedItems = items?.filter(i => i.status === 'received') || [];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">
                PC #{order.order_number.toString().padStart(4, '0')}
              </h2>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            {order.ordens_servico && (
              <p className="text-sm text-muted-foreground">
                OS #{order.ordens_servico.os_number.toString().padStart(4, '0')} - {order.ordens_servico.customer_name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {order.status === 'pending' && onMarkOrdered ? (
            <Button onClick={onMarkOrdered}>
              <Truck className="w-4 h-4 mr-2" />
              Marcar como Pedido
            </Button>
          ) : null}
          {(order.status === 'ordered' || order.status === 'partial') && onReceive ? (
            <Button onClick={onReceive}>
              <Package className="w-4 h-4 mr-2" />
              Registrar Recebimento
            </Button>
          ) : null}
          {(order.status === 'pending' || order.status === 'ordered' || order.status === 'partial') && onCancel ? (
            <Button variant="destructive" onClick={onCancel}>
              Cancelar pedido
            </Button>
          ) : null}
        </div>
      </div>
      
      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Valor Estimado</div>
                <div className="font-medium">{formatCurrency(order.total_estimated)}</div>
              </div>
            </div>
            
            {order.total_actual && (
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Valor Real</div>
                  <div className="font-medium text-primary">{formatCurrency(order.total_actual)}</div>
                </div>
              </div>
            )}
            
            {order.supplier_name && (
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Fornecedor</div>
                  <div className="font-medium">{order.supplier_name}</div>
                </div>
              </div>
            )}
            
            {order.expected_delivery && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Previsão</div>
                  <div className="font-medium">
                    {format(new Date(order.expected_delivery), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Itens do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingItems.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pendentes ({pendingItems.length})
              </h4>
              <div className="space-y-2">
                {pendingItems.map(item => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.width_mm && item.height_mm 
                          ? `${item.width_mm} x ${item.height_mm} mm`
                          : ''
                        }
                        {' • '}{item.quantity} {item.unit}
                      </p>
                      {item.received_quantity > 0 ? (
                        <p className="text-xs text-primary">
                          Recebido: {item.received_quantity} · Pendente: {item.quantity - item.received_quantity}
                        </p>
                      ) : null}
                      {item.allocations && item.allocations.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.allocations.map((allocation) => (
                            <Badge key={allocation.id} variant="outline" className="text-[10px]">
                              OS #{allocation.material_purchase_requirements?.ordens_servico?.os_number ?? '—'}:{' '}
                              {allocation.allocated_canonical_quantity}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.estimated_cost)}</p>
                      <Badge variant="secondary" className="text-xs">Pendente</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {receivedItems.length > 0 && (
            <>
              {pendingItems.length > 0 && <Separator />}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Recebidos ({receivedItems.length})
                </h4>
                <div className="space-y-2">
                  {receivedItems.map(item => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.width_mm && item.height_mm 
                            ? `${item.width_mm} x ${item.height_mm} mm`
                            : ''
                          }
                          {' • '}{item.received_quantity} {item.unit} recebidos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-primary">{formatCurrency(item.actual_cost || 0)}</p>
                        <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                          Recebido
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
