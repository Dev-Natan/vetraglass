import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package } from 'lucide-react';
import { usePurchaseOrderItems, useReceivePurchaseOrderItems } from '@/hooks/usePurchaseOrders';
import type { PurchaseOrder } from '@/hooks/usePurchaseOrders';

interface ReceiveItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder | null;
}

interface ItemReceiveState {
  id: string;
  selected: boolean;
  actualCost: number;
  receivedQuantity: number;
}

export function ReceiveItemsDialog({ open, onOpenChange, order }: ReceiveItemsDialogProps) {
  const { data: items, isLoading } = usePurchaseOrderItems(order?.id || '');
  const receiveItems = useReceivePurchaseOrderItems();
  
  const [itemStates, setItemStates] = useState<ItemReceiveState[]>([]);
  
  // Initialize item states when items load
  useEffect(() => {
    if (items) {
      setItemStates(
        items
          .filter(item => item.status === 'pending')
          .map(item => ({
            id: item.id,
            selected: true,
            actualCost: item.estimated_cost,
            receivedQuantity: item.quantity,
          }))
      );
    }
  }, [items]);
  
  const totalActual = useMemo(() => {
    return itemStates
      .filter(s => s.selected)
      .reduce((sum, s) => sum + s.actualCost, 0);
  }, [itemStates]);
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  
  const handleItemChange = (itemId: string, field: keyof ItemReceiveState, value: any) => {
    setItemStates(prev => prev.map(state => 
      state.id === itemId ? { ...state, [field]: value } : state
    ));
  };
  
  const handleSubmit = async () => {
    if (!order) return;
    
    const selectedItems = itemStates
      .filter(s => s.selected)
      .map(s => ({
        id: s.id,
        actualCost: s.actualCost,
        receivedQuantity: s.receivedQuantity,
      }));
    
    if (selectedItems.length === 0) return;
    
    await receiveItems.mutateAsync({
      purchaseOrderId: order.id,
      items: selectedItems,
      totalActual,
    });
    
    onOpenChange(false);
  };
  
  const pendingItems = items?.filter(item => item.status === 'pending') || [];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Registrar Recebimento
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Todos os itens já foram recebidos.
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 p-1">
                {pendingItems.map(item => {
                  const state = itemStates.find(s => s.id === item.id);
                  if (!state) return null;
                  
                  return (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={state.selected}
                          onCheckedChange={(checked) => 
                            handleItemChange(item.id, 'selected', !!checked)
                          }
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.width_mm && item.height_mm 
                              ? `${item.width_mm} x ${item.height_mm} mm`
                              : `${item.quantity} ${item.unit}`
                            }
                          </p>
                        </div>
                      </div>
                      
                      {state.selected && (
                        <div className="grid grid-cols-2 gap-4 pl-7">
                          <div className="space-y-1">
                            <Label className="text-xs">Qtd Recebida</Label>
                            <Input
                              type="number"
                              min={0}
                              value={state.receivedQuantity}
                              onChange={(e) => 
                                handleItemChange(item.id, 'receivedQuantity', Number(e.target.value))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Custo Real (R$)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={state.actualCost}
                              onChange={(e) => 
                                handleItemChange(item.id, 'actualCost', Number(e.target.value))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total a pagar:</span>
                <span className="text-lg font-bold">{formatCurrency(totalActual)}</span>
              </div>
            </div>
          </>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={receiveItems.isPending || itemStates.filter(s => s.selected).length === 0}
          >
            {receiveItems.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
