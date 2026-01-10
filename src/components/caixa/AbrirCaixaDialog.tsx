import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign } from 'lucide-react';

interface AbrirCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (openingAmount: number) => Promise<unknown>;
  
  isLoading?: boolean;
}

export function AbrirCaixaDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: AbrirCaixaDialogProps) {
  const [openingAmount, setOpeningAmount] = useState('');

  const handleConfirm = async () => {
    const amount = parseFloat(openingAmount.replace(',', '.')) || 0;
    await onConfirm(amount);
    setOpeningAmount('');
  };

  const handleClose = () => {
    if (!isLoading) {
      setOpeningAmount('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Abrir Caixa
          </DialogTitle>
          <DialogDescription>
            Informe o valor em dinheiro disponível para iniciar o caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="opening-amount">Valor de Abertura (R$)</Label>
            <Input
              id="opening-amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              disabled={isLoading}
              className="text-lg"
            />
            <p className="text-xs text-muted-foreground">
              Este valor será usado como troco inicial do caixa.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Abrindo...
              </>
            ) : (
              'Confirmar Abertura'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
