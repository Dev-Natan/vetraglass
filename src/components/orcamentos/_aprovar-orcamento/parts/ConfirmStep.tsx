import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, parseAmount } from '../utils';
import type { ApprovalQuote, ApprovalFormState } from '../types';

interface Props {
  quote: ApprovalQuote;
  state: ApprovalFormState;
  valorFinal: number;
  isCaixaAberto: boolean;
  selectedForma?: { tipo: string };
}

export function ConfirmStep({
  quote, state, valorFinal, isCaixaAberto, selectedForma,
}: Props) {
  const entryValue = parseAmount(state.entryAmount);
  const hasEntry = entryValue > 0;
  const pendingAmount = valorFinal - entryValue;

  return (
    <div className="space-y-6 px-1">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="p-4 border rounded-xl bg-card">
            <h3 className="font-semibold mb-4">Resumo de Valores</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{quote.customer_name}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (itens)</span>
                <span>{formatCurrency(quote.total_amount)}</span>
              </div>

              {selectedForma?.tipo === 'avista' && quote.discount_percent && quote.discount_percent > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Desconto aplicado ({quote.discount_percent}%)</span>
                  <span>-{formatCurrency(quote.discount_amount || 0)}</span>
                </div>
              )}

              {selectedForma?.tipo !== 'avista' && quote.discount_percent && quote.discount_percent > 0 && (
                <div className="flex justify-between text-muted-foreground italic">
                  <span>Desconto de à vista removido</span>
                  <span>{formatCurrency(0)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Valor Final</span>
                <span className="text-primary">{formatCurrency(valorFinal)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-xl bg-card">
            <h3 className="font-semibold mb-4">Ordem de Serviço</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prioridade</span>
                <Badge variant={state.priority === 'urgent' ? 'destructive' : state.priority === 'high' ? 'default' : 'secondary'}>
                  {state.priority === 'low' ? 'Baixa' : state.priority === 'normal' ? 'Normal' : state.priority === 'high' ? 'Alta' : 'Urgente'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previsão de entrega</span>
                <span>{state.estimatedEnd ? format(state.estimatedEnd, 'dd/MM/yyyy') : '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-6 border-2 border-primary/30 rounded-xl bg-gradient-to-br from-primary/10 to-transparent">
            <h3 className="font-semibold text-lg mb-4">Financeiro</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Modalidade</span>
                <Badge variant="outline" className="capitalize">
                  {selectedForma?.tipo === 'avista' ? 'À Vista' : 'Cartão (Parcelado)'}
                </Badge>
              </div>

              {hasEntry && (
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <span className="text-green-700 dark:text-green-300 font-medium">Entrada informada</span>
                  <span className="text-xl font-bold text-green-600">{formatCurrency(entryValue)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border border-dashed">
                <span className="text-muted-foreground font-medium">Saldo Final a Receber</span>
                <span className="text-xl font-bold">{formatCurrency(pendingAmount)}</span>
              </div>
            </div>
          </div>

          {hasEntry && !isCaixaAberto && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Caixa precisa estar aberto</span>
              </div>
              <p className="text-sm text-destructive/80 mt-1">
                Para registrar a entrada, abra o caixa antes de aprovar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
