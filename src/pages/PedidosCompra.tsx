import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Truck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { usePurchaseOrders, type PurchaseOrder } from '@/hooks/usePurchaseOrders';
import { PurchaseOrderCard } from '@/components/pedidos-compra/PurchaseOrderCard';
import { PurchaseOrderDetails } from '@/components/pedidos-compra/PurchaseOrderDetails';
import { MarkAsOrderedDialog } from '@/components/pedidos-compra/MarkAsOrderedDialog';
import { ReceiveItemsDialog } from '@/components/pedidos-compra/ReceiveItemsDialog';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';

type StatusTab = 'all' | 'pending' | 'ordered' | 'partial' | 'received';

const statusTabs = [
  { value: 'all', label: 'Todos', icon: Package },
  { value: 'pending', label: 'Pendentes', icon: Clock },
  { value: 'ordered', label: 'Pedidos', icon: Truck },
  { value: 'partial', label: 'Parciais', icon: Package },
  { value: 'received', label: 'Recebidos', icon: CheckCircle2 },
];

export default function PedidosCompra() {
  const [statusFilter, setStatusFilter] = useState<StatusTab>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderToMark, setOrderToMark] = useState<PurchaseOrder | null>(null);
  const [orderToReceive, setOrderToReceive] = useState<PurchaseOrder | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
  
  const { data: orders, isLoading } = usePurchaseOrders(
    statusFilter === 'all' ? undefined : statusFilter
  );
  
  // Filter by search term
  const filteredOrders = orders?.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.order_number.toString().includes(searchLower) ||
      order.supplier_name?.toLowerCase().includes(searchLower) ||
      order.ordens_servico?.customer_name?.toLowerCase().includes(searchLower) ||
      order.ordens_servico?.os_number.toString().includes(searchLower)
    );
  }) || [];
  
  // Pagination
  const pagination = usePagination(filteredOrders, { initialPageSize: 12 });
  const paginatedItems = pagination.paginatedData;
  
  // Calculate counts per status
  const allOrders = orders || [];
  const counts = {
    all: allOrders.length,
    pending: allOrders.filter(o => o.status === 'pending').length,
    ordered: allOrders.filter(o => o.status === 'ordered').length,
    partial: allOrders.filter(o => o.status === 'partial').length,
    received: allOrders.filter(o => o.status === 'received').length,
  };
  
  const handleView = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setViewMode('details');
  };
  
  const handleBackToList = () => {
    setSelectedOrder(null);
    setViewMode('list');
  };
  
  if (viewMode === 'details' && selectedOrder) {
    return (
      <MainLayout>
        <PurchaseOrderDetails
          purchaseOrderId={selectedOrder.id}
          onBack={handleBackToList}
          onMarkOrdered={() => setOrderToMark(selectedOrder)}
          onReceive={() => setOrderToReceive(selectedOrder)}
        />
        
        <MarkAsOrderedDialog
          open={!!orderToMark}
          onOpenChange={(open) => !open && setOrderToMark(null)}
          order={orderToMark}
        />
        
        <ReceiveItemsDialog
          open={!!orderToReceive}
          onOpenChange={(open) => !open && setOrderToReceive(null)}
          order={orderToReceive}
        />
      </MainLayout>
    );
  }
  
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Compra</h1>
          <p className="text-muted-foreground">
            Gerencie os pedidos de materiais para suas ordens de serviço
          </p>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statusTabs.map(tab => {
            const Icon = tab.icon;
            const count = counts[tab.value as keyof typeof counts];
            return (
              <Card 
                key={tab.value}
                className={`cursor-pointer transition-colors ${
                  statusFilter === tab.value ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => setStatusFilter(tab.value as StatusTab)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </div>
                    <Badge variant={statusFilter === tab.value ? 'default' : 'secondary'}>
                      {count}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, fornecedor, cliente..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {/* Orders Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Nenhum pedido encontrado</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm 
                  ? 'Tente ajustar sua busca'
                  : 'Os pedidos de compra serão criados automaticamente ao aprovar orçamentos com vidros'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedItems.map(order => (
                <PurchaseOrderCard
                  key={order.id}
                  order={order}
                  onView={handleView}
                  onMarkOrdered={() => setOrderToMark(order)}
                  onReceive={() => setOrderToReceive(order)}
                />
              ))}
            </div>
            
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={[12, 24, 48]}
            />
          </>
        )}
      </div>
      
      <MarkAsOrderedDialog
        open={!!orderToMark}
        onOpenChange={(open) => !open && setOrderToMark(null)}
        order={orderToMark}
      />
      
      <ReceiveItemsDialog
        open={!!orderToReceive}
        onOpenChange={(open) => !open && setOrderToReceive(null)}
        order={orderToReceive}
      />
    </MainLayout>
  );
}
