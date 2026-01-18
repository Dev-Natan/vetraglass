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
import { Loader2, DollarSign, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CompanyCash {
  current_balance: number;
  fixed_fund: number;
}

interface AbrirCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (openingAmount: number) => Promise<unknown>;
  companyCash?: CompanyCash | null;
  isLoading?: boolean;
}

export function AbrirCaixaDialog({
  open,
  onOpenChange,
  onConfirm,
  companyCash,
  isLoading = false,
}: AbrirCaixaDialogProps) {
  const [openingAmount, setOpeningAmount] = useState('');

  // Pre-fill with fixed fund when dialog opens
  useEffect(() => {
    if (open && companyCash?.fixed_fund) {
      setOpeningAmount(companyCash.fixed_fund.toString().replace('.', ','));
    }
  }, [open, companyCash?.fixed_fund]);

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

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parsedAmount = parseFloat(openingAmount.replace(',', '.')) || 0;
  const hasCompanyCash = !!companyCash;
  const companyBalance = companyCash?.current_balance || 0;
  const fixedFund = companyCash?.fixed_fund || 500;
  const hasEnoughBalance = hasCompanyCash ? companyBalance >= parsedAmount : true;
  const isValidAmount = parsedAmount > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Abrir Caixa do Dia
          </DialogTitle>
          <DialogDescription>
            Informe o valor em dinheiro para iniciar o caixa operacional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Saldo da Empresa */}
          {hasCompanyCash && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Caixa da Empresa
                </span>
                <span className="font-semibold text-primary">
                  {formatCurrency(companyBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Fundo fixo sugerido:</span>
                <span>{formatCurrency(fixedFund)}</span>
              </div>
            </div>
          )}

          {!hasCompanyCash && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Caixa da empresa não configurado
                  </p>
                  <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                    O valor não será transferido automaticamente. Configure o caixa da empresa para ter controle patrimonial.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Valor de Abertura */}
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
              Este valor será transferido do caixa da empresa para o caixa do dia.
            </p>
          </div>

          {/* Validação de saldo */}
          {isValidAmount && hasCompanyCash && (
            <div className={`rounded-lg border p-3 ${
              hasEnoughBalance 
                ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2 text-sm">
                {hasEnoughBalance ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 dark:text-green-400">
                      Saldo suficiente para abertura
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-700 dark:text-red-400">
                      Saldo insuficiente. Disponível: {formatCurrency(companyBalance)}
                    </span>
                  </>
                )}
              </div>
              {hasEnoughBalance && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Novo saldo da empresa: {formatCurrency(companyBalance - parsedAmount)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || !isValidAmount || (hasCompanyCash && !hasEnoughBalance)}
          >
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
