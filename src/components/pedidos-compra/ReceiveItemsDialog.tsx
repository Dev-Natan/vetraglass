import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package } from 'lucide-react';
import {
  usePurchaseOrderItems,
  useReceivePurchaseOrderItems,
  useStockLocations,
} from '@/hooks/usePurchaseOrders';
import type { PurchaseOrder } from '@/hooks/usePurchaseOrders';
import { createUuid } from '@/utils/createUuid';

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
  const { data: locations = [], isLoading: locationsLoading } = useStockLocations();
  const receiveItems = useReceivePurchaseOrderItems();
  const receiptKey = useRef(createUuid());
  const [itemStates, setItemStates] = useState<ItemReceiveState[]>([]);
  const [locationId, setLocationId] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  
  // Initialize item states when items load
  useEffect(() => {
    if (items) {
      setItemStates(
        items
          .filter(item => item.status === 'ordered' || item.status === 'partial')
          .map(item => ({
            id: item.id,
            selected: true,
            actualCost: 0,
            receivedQuantity: Math.max(0, item.quantity - Number(item.received_quantity || 0)),
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
  
  const handleItemChange = (
    itemId: string,
    patch: Partial<Pick<ItemReceiveState, 'selected' | 'actualCost' | 'receivedQuantity'>>,
  ) => {
    setItemStates(prev => prev.map(state => 
      state.id === itemId ? { ...state, ...patch } : state
    ));
  };
  
  const handleSubmit = async () => {
    if (!order || !locationId) return;
    
    const selectedItems = itemStates
      .filter(s => s.selected)
      .map(s => ({
        id: s.id,
        variantId: items?.find((item) => item.id === s.id)?.variant_id || null,
        totalCost: s.actualCost,
        receivedQuantity: s.receivedQuantity,
      }));
    
    if (selectedItems.length === 0) return;
    
    await receiveItems.mutateAsync({
      purchaseOrderId: order.id,
      locationId,
      receiptKey: receiptKey.current,
      documentReference: documentReference || undefined,
      items: selectedItems,
    });
    
    receiptKey.current = createUuid();
    onOpenChange(false);
  };
  
  const pendingItems = items?.filter(item => item.status === 'ordered' || item.status === 'partial') || [];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Registrar Recebimento
          </DialogTitle>
        </DialogHeader>
        
        {isLoading || locationsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Todos os itens já foram recebidos.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="receipt-location">Localização física</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger id="receipt-location">
                    <SelectValue placeholder="Selecione a localização" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.code} — {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-reference">Documento / nota</Label>
                <Input
                  id="document-reference"
                  value={documentReference}
                  onChange={(event) => setDocumentReference(event.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
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
                            handleItemChange(item.id, { selected: !!checked })
                          }
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.width_mm && item.height_mm
                              ? `${item.width_mm} x ${item.height_mm} mm`
                              : `${item.quantity - Number(item.received_quantity || 0)} ${item.purchase_unit || item.unit} pendentes`
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
                              min={0.000001}
                              max={item.quantity - Number(item.received_quantity || 0)}
                              step={item.purchase_allows_fractional ? 'any' : 1}
                              value={state.receivedQuantity}
                              onChange={(e) => 
                                handleItemChange(item.id, { receivedQuantity: Number(e.target.value) })
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
                                handleItemChange(item.id, { actualCost: Number(e.target.value) })
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
            disabled={
              receiveItems.isPending ||
              !locationId ||
              itemStates.filter(s => s.selected && s.receivedQuantity > 0).length === 0
            }
          >
            {receiveItems.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
