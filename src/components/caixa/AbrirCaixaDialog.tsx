import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  const handleConfirm = async () => {
    const amount = companyCash?.fixed_fund || 0;
    await onConfirm(amount);
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const fixedFund = companyCash?.fixed_fund || 0;
  const hasCompanyCash = !!companyCash;
  const companyBalance = companyCash?.current_balance || 0;
  const hasEnoughBalance = hasCompanyCash ? companyBalance >= fixedFund : false;
  const isValidAmount = fixedFund > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Abrir Caixa do Dia
          </DialogTitle>
          <DialogDescription>
            O caixa será aberto com o fundo fixo definido pela empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasCompanyCash ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Caixa da empresa não configurado
                  </p>
                  <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                    Um administrador precisa configurar o caixa da empresa antes de abrir o caixa do dia.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Valor Fixo de Abertura */}
              <div className="rounded-lg border bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Valor de Abertura (Fundo Fixo)</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(fixedFund)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Este valor é definido pelo administrador e não pode ser alterado.
                </p>
              </div>

              {/* Saldo da Empresa */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Saldo da Empresa
                  </span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(companyBalance)}
                  </span>
                </div>
              </div>

              {/* Validação de saldo */}
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
                    Novo saldo da empresa: {formatCurrency(companyBalance - fixedFund)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || !isValidAmount || !hasEnoughBalance}
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