import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SaleFinancialStatus } from '@/hooks/useSalesFinancial';

interface SaleEntry {
  id: string;
  amount: number;
  paymentMethod: string;
  receivedAt: string;
}

interface SaleInstallment {
  id: string;
  numero: number;
  total: number;
  valor: number;
  vencimento: string;
  status: string;
  paidAmount: number;
}

interface SaleFinancialCardProps {
  valorTotal: number;
  valorRecebido: number;
  valorRestante: number;
  statusFinanceiro: SaleFinancialStatus;
  entradas?: SaleEntry[];
  parcelas?: SaleInstallment[];
  className?: string;
  compact?: boolean;
}

const statusConfig: Record<SaleFinancialStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType; color: string }> = {
  'EM_ABERTO': {
    label: 'Em Aberto',
    variant: 'destructive',
    icon: AlertTriangle,
    color: 'text-destructive',
  },
  'PARCIAL': {
    label: 'Parcialmente Pago',
    variant: 'secondary',
    icon: Clock,
    color: 'text-amber-600',
  },
  'PAGO': {
    label: 'Pago',
    variant: 'default',
    icon: CheckCircle2,
    color: 'text-green-600',
  },
};

export function SaleFinancialCard({
  valorTotal,
  valorRecebido,
  valorRestante,
  statusFinanceiro,
  entradas = [],
  parcelas = [],
  className,
  compact = false,
}: SaleFinancialCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const config = statusConfig[statusFinanceiro];
  const StatusIcon = config.icon;
  const progressPercent = valorTotal > 0 ? (valorRecebido / valorTotal) * 100 : 0;

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      dinheiro: 'Dinheiro',
      cartao: 'Cartão',
      pix: 'Pix',
    };
    return labels[method] || method;
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4 p-3 rounded-lg border bg-card', className)}>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('h-4 w-4', config.color)} />
            <span className="text-sm font-medium">{formatCurrency(valorTotal)}</span>
            <Badge variant={config.variant} className="text-xs">
              {config.label}
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">Recebido</p>
          <p className="font-medium text-green-600">{formatCurrency(valorRecebido)}</p>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Status Financeiro
          </CardTitle>
          <Badge variant={config.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo Principal */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Total</p>
            <p className="font-bold text-lg">{formatCurrency(valorTotal)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-green-600 mb-1">Recebido</p>
            <p className="font-bold text-lg text-green-600">{formatCurrency(valorRecebido)}</p>
          </div>
          <div className={cn(
            'text-center p-3 rounded-lg',
            valorRestante > 0 
              ? 'bg-amber-500/10 border border-amber-500/20' 
              : 'bg-muted/50'
          )}>
            <p className={cn('text-xs mb-1', valorRestante > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
              Restante
            </p>
            <p className={cn('font-bold text-lg', valorRestante > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
              {formatCurrency(valorRestante)}
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso de pagamento</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Entradas Recebidas */}
        {entradas.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Entradas Recebidas
              </h4>
              <div className="space-y-2">
                {entradas.map((entrada) => (
                  <div key={entrada.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-muted-foreground">
                        {format(new Date(entrada.receivedAt), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getPaymentMethodLabel(entrada.paymentMethod)}
                      </Badge>
                    </div>
                    <span className="font-medium text-green-600">
                      {formatCurrency(entrada.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Parcelas */}
        {parcelas.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Parcelas ({parcelas.filter(p => p.status === 'paid').length}/{parcelas.length} pagas)
              </h4>
              <div className="space-y-2">
                {parcelas.map((parcela) => {
                  const isOverdue = parcela.status !== 'paid' && new Date(parcela.vencimento) < new Date();
                  const isPaid = parcela.status === 'paid';
                  
                  return (
                    <div 
                      key={parcela.id} 
                      className={cn(
                        'flex items-center justify-between text-sm p-2 rounded border',
                        isPaid 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : isOverdue 
                            ? 'bg-destructive/5 border-destructive/20' 
                            : 'bg-muted/50 border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : isOverdue ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span>Parcela {parcela.numero}/{parcela.total}</span>
                        <span className={cn(
                          'text-xs',
                          isOverdue ? 'text-destructive' : 'text-muted-foreground'
                        )}>
                          {format(new Date(parcela.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                      <span className={cn(
                        'font-medium',
                        isPaid ? 'text-green-600' : isOverdue ? 'text-destructive' : ''
                      )}>
                        {formatCurrency(parcela.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
