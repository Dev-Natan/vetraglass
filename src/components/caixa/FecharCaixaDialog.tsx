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
import { Separator } from '@/components/ui/separator';
import { Loader2, Lock, TrendingUp, TrendingDown, Minus, ArrowRight, Wallet } from 'lucide-react';

interface CashSummary {
  openingAmount: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  expectedAmount: number;
  // Movimentações do caixa do dia
  totalEntradas?: number;
  totalSaidas?: number;
}

interface CompanyCash {
  current_balance: number;
  fixed_fund: number;
}

interface FecharCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (actualAmount: number, notes: string) => Promise<unknown>;
  summary: CashSummary;
  companyCash?: CompanyCash | null;
  isLoading?: boolean;
}

export function FecharCaixaDialog({
  open,
  onOpenChange,
  onConfirm,
  summary,
  companyCash,
  isLoading = false,
}: FecharCaixaDialogProps) {
  const [actualAmount, setActualAmount] = useState('');
  const [notes, setNotes] = useState('');

  const actualValue = parseFloat(actualAmount.replace(',', '.')) || 0;
  const fixedFund = companyCash?.fixed_fund || summary.openingAmount;
  
  // Calcular saldo esperado em dinheiro físico
  const expectedCash = summary.openingAmount + summary.totalDinheiro + (summary.totalEntradas || 0) - (summary.totalSaidas || 0);
  
  // Diferença entre contado e esperado
  const difference = actualValue - expectedCash;
  
  // Excedente a recolher (vai para o caixa da empresa)
  const excessToCollect = Math.max(0, actualValue - fixedFund);
  
  // Novo saldo da empresa após fechamento
  const newCompanyBalance = companyCash ? companyCash.current_balance + excessToCollect : 0;

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Fechar Caixa do Dia
          </DialogTitle>
          <DialogDescription>
            Confira o resumo e informe o valor contado em espécie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Breakdown Detalhado */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              ENTRADAS
            </h4>
            <div className="grid grid-cols-2 gap-1 text-sm pl-6">
              <span className="text-muted-foreground">Abertura do Caixa:</span>
              <span className="text-right">{formatCurrency(summary.openingAmount)}</span>
              
              <span className="text-muted-foreground">Vendas em Dinheiro:</span>
              <span className="text-right text-green-600">+{formatCurrency(summary.totalDinheiro)}</span>
              
              {(summary.totalEntradas || 0) > 0 && (
                <>
                  <span className="text-muted-foreground">Outras Entradas:</span>
                  <span className="text-right text-green-600">+{formatCurrency(summary.totalEntradas || 0)}</span>
                </>
              )}
            </div>

            <Separator className="my-2" />

            <h4 className="font-medium text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              SAÍDAS
            </h4>
            <div className="grid grid-cols-2 gap-1 text-sm pl-6">
              {(summary.totalSaidas || 0) > 0 ? (
                <>
                  <span className="text-muted-foreground">Sangrias / Despesas:</span>
                  <span className="text-right text-red-600">-{formatCurrency(summary.totalSaidas || 0)}</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground italic">Nenhuma saída</span>
                  <span className="text-right">-</span>
                </>
              )}
            </div>

            <Separator className="my-2" />

            <div className="grid grid-cols-2 gap-1 text-sm font-medium">
              <span>SALDO ESPERADO (Dinheiro):</span>
              <span className="text-right text-primary">{formatCurrency(expectedCash)}</span>
            </div>

            {/* Info Cartão/PIX (não afetam caixa físico) */}
            <div className="mt-2 pt-2 border-t border-dashed">
              <p className="text-xs text-muted-foreground mb-1">Vendas que não entram no caixa físico:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Cartão:</span>
                <span className="text-right">{formatCurrency(summary.totalCartao)}</span>
                <span>PIX:</span>
                <span className="text-right">{formatCurrency(summary.totalPix)}</span>
              </div>
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

          {/* Resumo do Recolhimento */}
          {actualAmount && companyCash && actualValue > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Recolhimento para Caixa da Empresa
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor contado:</span>
                  <span>{formatCurrency(actualValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fundo fixo (permanece):</span>
                  <span className="text-amber-600">-{formatCurrency(fixedFund)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Excedente a recolher:</span>
                  <span className="text-green-600">{formatCurrency(excessToCollect)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                <span>Caixa Empresa: {formatCurrency(companyCash.current_balance)}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="text-primary font-medium">{formatCurrency(newCompanyBalance)}</span>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações {difference !== 0 && actualAmount ? '(obrigatório para diferenças)' : '(opcional)'}</Label>
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
            disabled={isLoading || !actualAmount || (difference !== 0 && !notes)}
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
