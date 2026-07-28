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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Lock, TrendingUp, TrendingDown, Wallet,
  AlertTriangle, CheckCircle2, Banknote,
} from 'lucide-react';

interface CashSummary {
  openingAmount: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  expectedAmount: number;
  totalEntradas?: number;
  totalSaidas?: number;
  totalVendas?: number;
}

interface CashCount {
  payment_method: string;
  amount: number;
}

interface FecharCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (counts: CashCount[], notes: string) => Promise<unknown>;
  summary: CashSummary;
  companyCash?: { current_balance: number; fixed_fund: number } | null;
  cashRegisterId?: string;
  isLoading?: boolean;
}

export function FecharCaixaDialog({
  open,
  onOpenChange,
  onConfirm,
  summary,
  isLoading = false,
}: FecharCaixaDialogProps) {
  const [physicalTotalStr, setPhysicalTotalStr] = useState('');
  const [notes, setNotes] = useState('');

  const totalEntradasMov = (summary.totalEntradas || 0);
  const totalSaidas = summary.totalSaidas || 0;
  // Total de entradas do dia = vendas (todas formas) + entradas manuais/depósitos avulsos
  const totalVendas = summary.totalVendas ?? (summary.totalDinheiro + summary.totalCartao + summary.totalPix);
  const totalEntradasDia = totalVendas + totalEntradasMov;
  const saldoFinalEsperado = summary.openingAmount + totalEntradasDia - totalSaidas;

  const totalCounted = parseFloat(physicalTotalStr.replace(',', '.')) || 0;
  const rawDifference = totalCounted - saldoFinalEsperado;
  // Arredonda para centavos e normaliza -0
  const difference = (Math.round(rawDifference * 100) === 0) ? 0 : Math.round(rawDifference * 100) / 100;
  const hasValue = physicalTotalStr.trim() !== '';

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const reset = () => {
    setPhysicalTotalStr('');
    setNotes('');
  };

  const handleConfirm = async () => {
    await onConfirm(
      [{ payment_method: 'dinheiro', amount: totalCounted }],
      notes,
    );
    reset();
  };

  const handleClose = () => {
    if (!isLoading) {
      reset();
      onOpenChange(false);
    }
  };

  const requireNotes = hasValue && difference !== 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Fechar Caixa do Dia
          </DialogTitle>
          <DialogDescription>
            Informe o valor total conferido em caixa (dinheiro + comprovantes).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cálculo do saldo esperado */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <h4 className="font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Cálculo do Saldo Esperado
            </h4>
            <div className="grid grid-cols-2 gap-1 pl-1 pt-1">
              <span className="text-muted-foreground">Saldo Inicial (abertura):</span>
              <span className="text-right">{formatCurrency(summary.openingAmount)}</span>

              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                Total de Entradas do dia:
              </span>
              <span className="text-right text-green-600">
                +{formatCurrency(totalEntradasDia)}
              </span>

              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                Total de Saídas do dia:
              </span>
              <span className="text-right text-red-600">
                -{formatCurrency(totalSaidas)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold pt-1">
              <span>Saldo Final Esperado:</span>
              <span className="text-primary">{formatCurrency(saldoFinalEsperado)}</span>
            </div>
          </div>

          {/* Campo único de contagem */}
          <div className="space-y-2">
            <Label htmlFor="physical-total" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Valor Físico Total em Caixa (Dinheiro + Comprovantes)
            </Label>
            <Input
              id="physical-total"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={physicalTotalStr}
              onChange={(e) => setPhysicalTotalStr(e.target.value)}
              className="text-lg font-semibold h-11"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Some tudo que está em caixa (cédulas, moedas e comprovantes de PIX/cartão) e digite o valor total.
            </p>
          </div>

          {/* Diferença */}
          {hasValue && (
            <div className={`rounded-lg border p-3 ${
              difference === 0
                ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800'
                : difference > 0
                  ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-sm">
                  {difference === 0
                    ? <><CheckCircle2 className="h-4 w-4 text-green-600" /> Caixa conferido</>
                    : difference > 0
                      ? <><TrendingUp className="h-4 w-4 text-blue-600" /> Sobra em caixa</>
                      : <><AlertTriangle className="h-4 w-4 text-red-600" /> Falta em caixa (quebra)</>}
                </span>
                <span className={`font-bold ${
                  difference === 0 ? 'text-green-600'
                    : difference > 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                </span>
              </div>
              {difference !== 0 && (
                <p className="text-xs mt-2 text-muted-foreground">
                  {difference > 0
                    ? 'Foi contado mais do que o esperado. Informe uma observação para registrar a origem.'
                    : 'Foi contado menos do que o esperado. Informe uma observação para registrar a quebra.'}
                </p>
              )}
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Observações {requireNotes ? '(obrigatório)' : '(opcional)'}
            </Label>
            <Textarea
              id="notes"
              placeholder="Anotações sobre o fechamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            💡 O valor final deste fechamento será sugerido automaticamente como fundo de abertura no próximo dia.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !hasValue || (requireNotes && !notes.trim())}
            variant={difference < 0 ? 'destructive' : 'default'}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fechando...</>
            ) : (
              'Confirmar Fechamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
