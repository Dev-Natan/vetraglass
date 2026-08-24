import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useApprovePurchaseOrder } from '@/hooks/usePurchaseOrders';
import type { PurchaseOrder } from '@/hooks/usePurchaseOrders';

interface MarkAsOrderedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder | null;
}

export function MarkAsOrderedDialog({ open, onOpenChange, order }: MarkAsOrderedDialogProps) {
  const approveOrder = useApprovePurchaseOrder();
  
  const handleSubmit = async () => {
    if (!order) return;
    
    await approveOrder.mutateAsync(order.id);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="mark-ordered-description">
        <DialogHeader>
          <DialogTitle>Marcar Pedido como Enviado</DialogTitle>
          <p id="mark-ordered-description" className="text-sm text-muted-foreground">
            A aprovação confirma o pedido para o fornecedor. Os dados informados na
            criação serão preservados.
          </p>
        </DialogHeader>
        
        <div className="py-4 text-sm">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p><strong>Fornecedor:</strong> {order?.supplier_name || 'Não informado'}</p>
            <p><strong>Previsão:</strong> {order?.expected_delivery || 'Não informada'}</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={approveOrder.isPending}>
            {approveOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Aprovar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
