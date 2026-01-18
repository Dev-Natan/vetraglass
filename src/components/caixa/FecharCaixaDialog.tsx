import { useState, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Lock, TrendingUp, TrendingDown, Minus, ArrowRight, 
  Wallet, ArrowRightLeft, AlertTriangle, CheckCircle2 
} from 'lucide-react';

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

interface Advance {
  id: string;
  amount: number;
  compensated_amount: number;
  pending_amount: number;
  reason: string;
}

interface AdvancesSummary {
  total_pending: number;
  count: number;
  advances: Advance[];
}

interface FecharCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (actualAmount: number, notes: string) => Promise<unknown>;
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
  const [actualAmount, setActualAmount] = useState('');
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

  const actualValue = parseFloat(actualAmount.replace(',', '.')) || 0;
  const fixedFund = companyCash?.fixed_fund || summary.openingAmount;
  
  // Calcular saldo esperado em dinheiro físico
  const expectedCash = summary.openingAmount + summary.totalDinheiro + (summary.totalEntradas || 0) - (summary.totalSaidas || 0);
  
  // Diferença entre contado e esperado
  const difference = actualValue - expectedCash;
  
  // Excedente bruto (antes de compensar adiantamentos)
  const grossExcess = Math.max(0, actualValue - fixedFund);
  
  // Total de adiantamentos pendentes
  const pendingAdvances = advancesSummary?.total_pending || 0;
  
  // Calcular compensação e excedente líquido
  const compensation = useMemo(() => {
    if (grossExcess <= 0 || pendingAdvances <= 0) {
      return { amount: 0, netExcess: grossExcess };
    }
    const compensationAmount = Math.min(grossExcess, pendingAdvances);
    return {
      amount: compensationAmount,
      netExcess: grossExcess - compensationAmount,
    };
  }, [grossExcess, pendingAdvances]);
  
  // Novo saldo da empresa após fechamento
  const newCompanyBalance = companyCash 
    ? companyCash.current_balance + compensation.netExcess 
    : 0;

  // Total de reforços recebidos hoje
  const todayReinforcementsTotal = todayAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);

  const handleConfirm = async () => {
    // A compensação agora é feita automaticamente pela função close_daily_cash
    // Passamos os valores e a função SQL cuida de tudo
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

  // Verificar se fechamento é com saldo abaixo do fundo fixo
  const closingBelowFund = actualValue < fixedFund && actualValue > 0;

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
          {/* Reforços recebidos hoje */}
          {todayAdvances.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <ArrowRightLeft className="h-4 w-4" />
                Reforços Recebidos Hoje
                <Badge variant="secondary" className="ml-auto text-xs">
                  {todayAdvances.length}
                </Badge>
              </h4>
              <div className="space-y-1 text-sm">
                {todayAdvances.map((adv) => (
                  <div key={adv.id} className="flex justify-between">
                    <span className="text-muted-foreground truncate max-w-[200px]">{adv.reason}</span>
                    <span className="font-medium">{formatCurrency(Number(adv.amount))}</span>
                  </div>
                ))}
                <Separator className="my-1" />
                <div className="flex justify-between font-medium">
                  <span>Total reforços:</span>
                  <span className="text-amber-600">{formatCurrency(todayReinforcementsTotal)}</span>
                </div>
              </div>
            </div>
          )}

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

            {/* Info Cartão/PIX */}
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

          {/* Alerta de fechamento abaixo do fundo */}
          {closingBelowFund && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Fechamento abaixo do fundo fixo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O caixa será fechado com R$ {(fixedFund - actualValue).toFixed(2)} abaixo do fundo fixo. 
                    Este valor foi utilizado em operações durante o dia e será compensado nas próximas vendas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Resumo do Recolhimento com Compensação */}
          {actualAmount && companyCash && grossExcess > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Resumo do Fechamento
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
                  <span>Excedente bruto:</span>
                  <span>{formatCurrency(grossExcess)}</span>
                </div>

                {/* Compensação de adiantamentos */}
                {compensation.amount > 0 && (
                  <>
                    <div className="flex justify-between text-amber-600">
                      <span className="flex items-center gap-1">
                        <ArrowRightLeft className="h-3 w-3" />
                        Compensação de adiantamentos:
                      </span>
                      <span>-{formatCurrency(compensation.amount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium text-green-600">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Excedente líquido:
                      </span>
                      <span>{formatCurrency(compensation.netExcess)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                <span>Caixa Empresa: {formatCurrency(companyCash.current_balance)}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="text-primary font-medium">{formatCurrency(newCompanyBalance)}</span>
              </div>

              {/* Info sobre adiantamentos restantes */}
              {pendingAdvances > compensation.amount && (
                <p className="text-xs text-muted-foreground">
                  Adiantamentos restantes: {formatCurrency(pendingAdvances - compensation.amount)}
                </p>
              )}
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Observações {(difference !== 0 || closingBelowFund) && actualAmount ? '(obrigatório)' : '(opcional)'}
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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={
              isLoading || 
              !actualAmount || 
              ((difference !== 0 || closingBelowFund) && !notes)
            }
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
