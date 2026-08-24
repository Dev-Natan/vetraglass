import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCancelPurchaseOrder, type PurchaseOrder } from '@/hooks/usePurchaseOrders';

interface CancelPurchaseOrderDialogProps {
  order: PurchaseOrder | null;
  onOpenChange: (open: boolean) => void;
}

export function CancelPurchaseOrderDialog({
  order,
  onOpenChange,
}: CancelPurchaseOrderDialogProps) {
  const cancelOrder = useCancelPurchaseOrder();

  const handleCancel = async () => {
    if (!order) return;
    await cancelOrder.mutateAsync(order.id);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={!!order} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar pedido de compra?</AlertDialogTitle>
          <AlertDialogDescription>
            O pedido será cancelado transacionalmente e as quantidades ainda não recebidas
            voltarão a aparecer como necessidades pendentes. Estoque já recebido não será revertido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelOrder.isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleCancel();
            }}
            disabled={cancelOrder.isPending}
          >
            Confirmar cancelamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
