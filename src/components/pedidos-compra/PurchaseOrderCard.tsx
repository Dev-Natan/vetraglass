import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Calendar, DollarSign, Truck, Eye, MoreVertical, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PurchaseOrder } from '@/hooks/usePurchaseOrders';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  ordered: { label: 'Pedido Enviado', variant: 'default' },
  partial: { label: 'Recebido Parcial', variant: 'outline' },
  received: { label: 'Recebido', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

interface PurchaseOrderCardProps {
  order: PurchaseOrder;
  onView: (order: PurchaseOrder) => void;
  onMarkOrdered?: (order: PurchaseOrder) => void;
  onReceive?: (order: PurchaseOrder) => void;
  onCancel?: (order: PurchaseOrder) => void;
}

export const PurchaseOrderCard = memo(function PurchaseOrderCard({ order, onView, onMarkOrdered, onReceive, onCancel }: PurchaseOrderCardProps) {
  const status = statusConfig[order.status] || statusConfig.pending;
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(order)}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">PC #{order.order_number.toString().padStart(4, '0')}</span>
              <Badge variant={status.variant} className="text-xs">
                {status.label}
              </Badge>
            </div>
            {order.ordens_servico && (
              <p className="text-sm text-muted-foreground mt-1">
                OS #{order.ordens_servico.os_number.toString().padStart(4, '0')} - {order.ordens_servico.customer_name}
              </p>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(order); }}>
                <Eye className="w-4 h-4 mr-2" />
                Ver Detalhes
              </DropdownMenuItem>
              {order.status === 'pending' && onMarkOrdered && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkOrdered(order); }}>
                  <Truck className="w-4 h-4 mr-2" />
                  Marcar como Pedido
                </DropdownMenuItem>
              )}
              {(order.status === 'ordered' || order.status === 'partial') && onReceive && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReceive(order); }}>
                  <Package className="w-4 h-4 mr-2" />
                  Registrar Recebimento
                </DropdownMenuItem>
              )}
              {(order.status === 'pending' || order.status === 'ordered' || order.status === 'partial') && onCancel ? (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancel(order);
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar pedido
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="w-4 h-4" />
            <span>
              {order.total_actual 
                ? formatCurrency(order.total_actual) 
                : formatCurrency(order.total_estimated)}
            </span>
          </div>
          
          {order.supplier_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="w-4 h-4" />
              <span className="truncate">{order.supplier_name}</span>
            </div>
          )}
          
          {order.expected_delivery && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(order.expected_delivery), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="w-4 h-4" />
            <span>
              {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prev, next) => prev.order.id === next.order.id && prev.order.status === next.order.status);
