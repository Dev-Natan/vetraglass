import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Lock, TrendingUp, TrendingDown, ArrowRight, 
  Wallet, ArrowRightLeft, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { CashCountForm } from './CashCountForm';

interface CashSummary {
  openingAmount: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  expectedAmount: number;
  totalEntradas?: number;
  totalSaidas?: number;
}

interface CompanyCash {
  current_balance: number;
  fixed_fund: number;
}

interface CashCount {
  payment_method: string;
  amount: number;
}

interface AdvancesSummary {
  total_pending: number;
  count: number;
}

interface FecharCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (counts: CashCount[], notes: string) => Promise<unknown>;
  summary: CashSummary;
  companyCash?: CompanyCash | null;
  cashRegisterId?: string;
  isLoading?: boolean;
}

export function FecharCaixaDialog({
  open,
  onOpenChange,
  onConfirm,
  summary,
  companyCash,
  cashRegisterId,
  isLoading = false,
}: FecharCaixaDialogProps) {
  const { currentCompany } = useAuth();
  const [cashCounts, setCashCounts] = useState<CashCount[]>([]);
  const [totalCounted, setTotalCounted] = useState(0);
  const [notes, setNotes] = useState('');

  // Buscar adiantamentos pendentes
  const { data: advancesSummary } = useQuery({
    queryKey: ['pending-advances', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase.rpc('get_pending_advances_summary', {
        _company_id: currentCompany.id,
      });
      if (error) throw error;
      return data as unknown as AdvancesSummary;
    },
    enabled: !!currentCompany?.id && open,
  });

  // Buscar reforços recebidos no caixa atual
  const { data: todayAdvances = [] } = useQuery({
    queryKey: ['today-advances', cashRegisterId],
    queryFn: async () => {
      if (!cashRegisterId) return [];
      const { data, error } = await supabase
        .from('cash_register_advances')
        .select('*')
        .eq('cash_register_id', cashRegisterId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cashRegisterId && open,
  });

  const handleCashCountChange = useCallback((counts: CashCount[], total: number) => {
    setCashCounts(counts);
    setTotalCounted(total);
  }, []);

  const fixedFund = companyCash?.fixed_fund || summary.openingAmount;
  // Movimentação em espécie do dia (SEM o fundo de abertura)
  const movDinheiro = summary.totalDinheiro + (summary.totalEntradas || 0) - (summary.totalSaidas || 0);
  // Para a contagem física o operador conta fundo + dinheiro movimentado
  const expectedCashForCount = summary.openingAmount + movDinheiro;
  const totalMovimentado = movDinheiro + summary.totalCartao + summary.totalPix;
  const totalGeralEsperado = summary.openingAmount + totalMovimentado;
  const difference = totalCounted - totalGeralEsperado;
  const profit = totalCounted - fixedFund; // Pode ser negativo
  const pendingAdvances = advancesSummary?.total_pending || 0;
  
  // Calcular retorno do fundo fixo (mínimo entre contado e fundo)
  const fundToReturn = Math.min(totalCounted, fixedFund);
  
  // Compensação só ocorre se houver lucro
  const compensation = useMemo(() => {
    if (profit <= 0 || pendingAdvances <= 0) {
      return { amount: 0, netProfit: Math.max(0, profit) };
    }
    const compensationAmount = Math.min(profit, pendingAdvances);
    return { amount: compensationAmount, netProfit: profit - compensationAmount };
  }, [profit, pendingAdvances]);

  // Total que retorna para empresa = fundo + lucro líquido
  const totalToReturn = fundToReturn + compensation.netProfit;
  
  const todayReinforcementsTotal = todayAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);
  const closingBelowFund = totalCounted < fixedFund && totalCounted > 0;
  const hasCounts = cashCounts.some(c => c.amount > 0);

  const handleConfirm = async () => {
    await onConfirm(cashCounts, notes);
    setCashCounts([]);
    setTotalCounted(0);
    setNotes('');
  };

  const handleClose = () => {
    if (!isLoading) {
      setCashCounts([]);
      setTotalCounted(0);
      setNotes('');
      onOpenChange(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Fechar Caixa do Dia
          </DialogTitle>
          <DialogDescription>
            Faça a contagem de cada forma de pagamento para fechar o caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Coluna Esquerda: Contagem */}
          <div className="space-y-4">
            <CashCountForm
              expectedCash={expectedCashForCount}
              expectedPix={summary.totalPix}
              expectedCardDebit={summary.totalCartao * 0.5}
              expectedCardCredit={summary.totalCartao * 0.5}
              onChange={handleCashCountChange}
            />
          </div>

          {/* Coluna Direita: Resumo */}
          <div className="space-y-4">
            {/* Reforços recebidos hoje */}
            {todayAdvances.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <ArrowRightLeft className="h-4 w-4" />
                  Reforços Recebidos
                  <Badge variant="secondary" className="ml-auto text-xs">{todayAdvances.length}</Badge>
                </h4>
                <div className="text-sm font-medium flex justify-between">
                  <span>Total:</span>
                  <span className="text-amber-600">{formatCurrency(todayReinforcementsTotal)}</span>
                </div>
              </div>
            )}

            {/* Resumo esperado */}
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Valores Esperados
              </h4>
              <div className="grid grid-cols-2 gap-1 pl-4">
                <span className="text-muted-foreground">Fundo de Abertura:</span>
                <span className="text-right text-muted-foreground">{formatCurrency(summary.openingAmount)}</span>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground font-medium pt-1">Movimentações do dia</p>
              <div className="grid grid-cols-2 gap-1 pl-4">
                <span className="text-muted-foreground">Dinheiro:</span>
                <span className="text-right">{formatCurrency(movDinheiro)}</span>
                <span className="text-muted-foreground">Cartão:</span>
                <span className="text-right">{formatCurrency(summary.totalCartao)}</span>
                <span className="text-muted-foreground">PIX:</span>
                <span className="text-right">{formatCurrency(summary.totalPix)}</span>
              </div>
              <div className="flex justify-between text-sm pl-4">
                <span className="text-muted-foreground">Total movimentado:</span>
                <span>{formatCurrency(totalMovimentado)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total Geral Esperado:</span>
                <span className="text-primary">{formatCurrency(totalGeralEsperado)}</span>
              </div>
            </div>

            {/* Diferença */}
            {hasCounts && (
              <div className={`rounded-lg border p-3 ${
                difference === 0 ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                  : difference > 0 ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {difference === 0 ? <CheckCircle2 className="h-4 w-4" /> : difference > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {difference === 0 ? 'Caixa conferido' : difference > 0 ? 'Sobra' : 'Falta'}
                  </span>
                  <span className={`font-bold ${difference === 0 ? 'text-green-600' : difference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                  </span>
                </div>
              </div>
            )}

            {/* Alerta falta */}
            {(closingBelowFund || difference < 0) && hasCounts && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {difference < 0 
                      ? 'A falta será registrada e compensada nos próximos fechamentos.'
                      : 'Fechamento abaixo do fundo fixo.'}
                  </p>
                </div>
              </div>
            )}

            {/* Resumo do Recolhimento */}
            {hasCounts && totalCounted > 0 && companyCash && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm">
                <h4 className="font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Resumo do Fechamento
                </h4>
                <div className="space-y-1 pl-4">
                  {/* Retorno do fundo fixo */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retorno fundo fixo:</span>
                    <span className="text-primary">{formatCurrency(fundToReturn)}</span>
                  </div>
                  {/* Lucro do dia */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lucro do dia:</span>
                    <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                    </span>
                  </div>
                  {/* Compensação de adiantamentos */}
                  {compensation.amount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Compensação adiant.:</span>
                      <span>-{formatCurrency(compensation.amount)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  {/* Total retornado para empresa */}
                  <div className="flex justify-between font-medium text-primary">
                    <span>Total para empresa:</span>
                    <span>{formatCurrency(totalToReturn)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                  <span>Caixa Empresa: {formatCurrency(companyCash.current_balance)}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-primary font-medium">{formatCurrency(companyCash.current_balance + totalToReturn)}</span>
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                Observações {(difference !== 0 || closingBelowFund) && hasCounts ? '(obrigatório)' : '(opcional)'}
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>Cancelar</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || !hasCounts || ((difference !== 0 || closingBelowFund) && !notes)}
            variant={difference < 0 ? 'destructive' : 'default'}
          >
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fechando...</> : 'Confirmar Fechamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
