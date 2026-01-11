import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface CancelarVendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onConfirm: (saleId: string, reason: string) => Promise<unknown>;
  isLoading?: boolean;
}

export function CancelarVendaDialog({
  open,
  onOpenChange,
  sale,
  onConfirm,
  isLoading,
}: CancelarVendaDialogProps) {
  const [reason, setReason] = useState('');

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleConfirm = async () => {
    if (!sale) return;
    await onConfirm(sale.id, reason);
    setReason('');
  };

  if (!sale) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Cancelar Venda #{String(sale.sale_number).padStart(4, '0')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Você está prestes a cancelar a venda no valor de{' '}
              <strong>{formatCurrency(sale.total_amount)}</strong>
              {sale.customer_name && (
                <> para o cliente <strong>{sale.customer_name}</strong></>
              )}
              .
            </p>
            <p>
              O estoque dos itens será restaurado automaticamente.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Descreva o motivo do cancelamento..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
