import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';
import { useUpdatePurchaseOrderStatus } from '@/hooks/usePurchaseOrders';
import type { PurchaseOrder } from '@/hooks/usePurchaseOrders';

interface MarkAsOrderedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder | null;
}

export function MarkAsOrderedDialog({ open, onOpenChange, order }: MarkAsOrderedDialogProps) {
  const [supplierName, setSupplierName] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  
  const updateStatus = useUpdatePurchaseOrderStatus();
  
  const handleSubmit = async () => {
    if (!order) return;
    
    await updateStatus.mutateAsync({
      id: order.id,
      status: 'ordered',
      supplierName: supplierName || undefined,
      expectedDelivery: expectedDelivery || undefined,
    });
    
    onOpenChange(false);
    setSupplierName('');
    setExpectedDelivery('');
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar Pedido como Enviado</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="supplier">Nome do Fornecedor</Label>
            <Input
              id="supplier"
              placeholder="Ex: Vidraria São Paulo"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="delivery">Previsão de Entrega</Label>
            <Input
              id="delivery"
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={updateStatus.isPending}>
            {updateStatus.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
