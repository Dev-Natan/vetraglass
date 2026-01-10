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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Lock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CashSummary {
  openingAmount: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  expectedAmount: number;
}

interface FecharCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (actualAmount: number, notes: string) => Promise<unknown>;
  summary: CashSummary;
  isLoading?: boolean;
}

export function FecharCaixaDialog({
  open,
  onOpenChange,
  onConfirm,
  summary,
  isLoading = false,
}: FecharCaixaDialogProps) {
  const [actualAmount, setActualAmount] = useState('');
  const [notes, setNotes] = useState('');

  const actualValue = parseFloat(actualAmount.replace(',', '.')) || 0;
  const difference = actualValue - summary.expectedAmount;

  const handleConfirm = async () => {
    await onConfirm(actualValue, notes);
    setActualAmount('');
    setNotes('');
  };

  const handleClose = () => {
    if (!isLoading) {
      setActualAmount('');
      setNotes('');
      onOpenChange(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Fechar Caixa
          </DialogTitle>
          <DialogDescription>
            Confira o resumo e informe o valor contado em espécie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo do Caixa */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h4 className="font-medium text-sm">Resumo do Caixa</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Abertura:</span>
              <span className="text-right">{formatCurrency(summary.openingAmount)}</span>
              
              <span className="text-muted-foreground">Vendas em Dinheiro:</span>
              <span className="text-right text-green-600">+{formatCurrency(summary.totalDinheiro)}</span>
              
              <span className="text-muted-foreground">Vendas em Cartão:</span>
              <span className="text-right">{formatCurrency(summary.totalCartao)}</span>
              
              <span className="text-muted-foreground">Vendas em PIX:</span>
              <span className="text-right">{formatCurrency(summary.totalPix)}</span>
              
              <div className="col-span-2 border-t my-2" />
              
              <span className="font-medium">Valor Esperado em Espécie:</span>
              <span className="text-right font-medium">{formatCurrency(summary.expectedAmount)}</span>
            </div>
          </div>

          {/* Valor Contado */}
          <div className="space-y-2">
            <Label htmlFor="actual-amount">Valor Contado em Espécie (R$)</Label>
            <Input
              id="actual-amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={actualAmount}
              onChange={(e) => setActualAmount(e.target.value)}
              disabled={isLoading}
              className="text-lg"
            />
          </div>

          {/* Diferença */}
          {actualAmount && (
            <div className={`rounded-lg border p-3 flex items-center justify-between ${
              difference === 0 
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                : difference > 0 
                  ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}>
              <span className="flex items-center gap-2 text-sm font-medium">
                {difference === 0 ? (
                  <><Minus className="h-4 w-4" /> Caixa conferido</>
                ) : difference > 0 ? (
                  <><TrendingUp className="h-4 w-4" /> Sobra</>
                ) : (
                  <><TrendingDown className="h-4 w-4" /> Falta</>
                )}
              </span>
              <span className={`font-bold ${
                difference === 0 ? 'text-green-600' : difference > 0 ? 'text-blue-600' : 'text-red-600'
              }`}>
                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
              </span>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Anotações sobre o fechamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || !actualAmount}
            variant={difference < 0 ? 'destructive' : 'default'}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fechando...
              </>
            ) : (
              'Confirmar Fechamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
