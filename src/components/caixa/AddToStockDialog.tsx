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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package } from 'lucide-react';

interface AddToStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemUnit: string;
  itemType?: string;
  onConfirm: (quantity: number) => Promise<void>;
  onSkip: () => void;
  isLoading?: boolean;
}

export function AddToStockDialog({
  open,
  onOpenChange,
  itemName,
  itemUnit,
  itemType,
  onConfirm,
  onSkip,
  isLoading = false,
}: AddToStockDialogProps) {
  const [quantity, setQuantity] = useState('1');
  
  const isProfile = itemType === 'profile';
  const unitLabel = isProfile ? 'barras' : itemUnit;

  const handleConfirm = async () => {
    const qty = parseFloat(quantity) || 1;
    await onConfirm(qty);
    setQuantity('1');
  };

  const handleSkip = () => {
    onSkip();
    setQuantity('1');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" />
            Item não está no estoque
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              O item <strong>{itemName}</strong> não está cadastrado no estoque da empresa.
            </p>
            <p>
              Deseja adicionar este item ao estoque agora?
            </p>
            
            <div className="pt-2 space-y-2">
              <Label htmlFor="stock-quantity">
                Quantidade inicial ({unitLabel})
              </Label>
              <Input
                id="stock-quantity"
                type="number"
                min="0"
                step={isProfile ? '1' : '0.01'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
              {isProfile && parseFloat(quantity) > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {(parseFloat(quantity) * 6).toFixed(1)} metros lineares
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleSkip} disabled={isLoading}>
            Pular e Continuar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Adicionando...' : 'Adicionar ao Estoque'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
