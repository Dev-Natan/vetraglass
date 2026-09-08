import { parseCurrencyBRL } from '@/utils/currencyMask';
import { useState, useEffect } from 'react';
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
import { Loader2, DollarSign, AlertCircle, History } from 'lucide-react';

interface CompanyCash {
  current_balance: number;
  fixed_fund: number;
}

interface AbrirCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (openingAmount: number) => Promise<unknown>;
  companyCash?: CompanyCash | null;
  suggestedAmount?: number | null;
  isLoading?: boolean;
}

export function AbrirCaixaDialog({
  open,
  onOpenChange,
  onConfirm,
  companyCash,
  suggestedAmount,
  isLoading = false,
}: AbrirCaixaDialogProps) {
  const fallback = suggestedAmount ?? companyCash?.fixed_fund ?? 0;
  const [amountStr, setAmountStr] = useState<string>(fallback.toString());

  useEffect(() => {
    if (open) {
      setAmountStr(fallback.toFixed(2).replace('.', ','));
    }
  }, [open, fallback]);

  const parsedAmount = parseCurrencyBRL(amountStr);

  const handleConfirm = async () => {
    await onConfirm(parsedAmount);
  };

  const handleClose = () => {
    if (!isLoading) onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const hasSuggestion = (suggestedAmount ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Abrir Caixa do Dia
          </DialogTitle>
          <DialogDescription>
            Você pode iniciar o dia com saldo zero ou informar um aporte opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {hasSuggestion && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
              <div className="flex items-start gap-2 text-sm">
                <History className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-400">
                    Sugestão baseada no fechamento anterior
                  </p>
                  <p className="text-blue-600 dark:text-blue-500 text-xs mt-0.5">
                    O valor final do último fechamento foi {formatCurrency(suggestedAmount!)}.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="opening-amount">Saldo inicial (opcional)</Label>
            <Input
              id="opening-amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="text-lg font-semibold h-11"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {hasSuggestion
                ? 'Você pode ajustar se recolheu ou reforçou algo entre o fechamento e agora.'
                : 'Deixe em zero para abrir sem aporte ou informe quanto será transferido para o caixa.'}
            </p>
          </div>

          {parsedAmount < 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2 text-xs">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-400">
                O saldo inicial não pode ser negativo.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || parsedAmount < 0}>
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Abrindo...</>
            ) : (
              'Confirmar Abertura'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
