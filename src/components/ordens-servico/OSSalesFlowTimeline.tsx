import { CheckCircle2, Circle, Clock, FileText, DollarSign, Truck, Receipt, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlowStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error';
  date?: string;
  value?: string;
  icon: React.ReactNode;
}

interface OSSalesFlowTimelineProps {
  quoteCreatedAt?: string;
  quoteApprovedAt?: string;
  entryValue?: number;
  entryPaid?: boolean;
  osStatus: string;
  osCompletedAt?: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  hasOverduePayments?: boolean;
}

export function OSSalesFlowTimeline({
  quoteCreatedAt,
  quoteApprovedAt,
  entryValue = 0,
  entryPaid = false,
  osStatus,
  osCompletedAt,
  totalAmount,
  paidAmount,
  pendingAmount,
  hasOverduePayments = false,
}: OSSalesFlowTimelineProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return undefined;
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Determine step statuses
  const getSteps = (): FlowStep[] => {
    const isApproved = !!quoteApprovedAt;
    const isInProgress = osStatus === 'in_progress';
    const isCompleted = osStatus === 'completed';
    const isCancelled = osStatus === 'cancelled';
    const isFullyPaid = pendingAmount <= 0;

    return [
      {
        id: 'quote',
        label: 'Orçamento',
        status: 'completed',
        date: formatDate(quoteCreatedAt),
        icon: <FileText className="w-4 h-4" />,
      },
      {
        id: 'approval',
        label: 'Aprovação',
        status: isApproved ? 'completed' : 'current',
        date: formatDate(quoteApprovedAt),
        icon: <CheckCircle2 className="w-4 h-4" />,
      },
      {
        id: 'entry',
        label: 'Entrada',
        status: !isApproved ? 'pending' : entryValue > 0 ? (entryPaid ? 'completed' : hasOverduePayments ? 'error' : 'current') : 'completed',
        value: entryValue > 0 ? formatCurrency(entryValue) : 'Sem entrada',
        icon: <DollarSign className="w-4 h-4" />,
      },
      {
        id: 'production',
        label: 'Produção',
        status: isCancelled ? 'error' : !isApproved ? 'pending' : isCompleted ? 'completed' : isInProgress ? 'current' : 'pending',
        icon: <Clock className="w-4 h-4" />,
      },
      {
        id: 'delivery',
        label: 'Entrega',
        status: isCancelled ? 'error' : isCompleted ? 'completed' : 'pending',
        date: formatDate(osCompletedAt),
        icon: <Truck className="w-4 h-4" />,
      },
      {
        id: 'billing',
        label: 'Faturamento',
        status: isCancelled ? 'error' : isFullyPaid && isCompleted ? 'completed' : isCompleted && !isFullyPaid ? 'current' : 'pending',
        value: isFullyPaid ? formatCurrency(totalAmount) : formatCurrency(pendingAmount) + ' pendente',
        icon: <Receipt className="w-4 h-4" />,
      },
    ];
  };

  const steps = getSteps();

  const getStatusStyles = (status: FlowStep['status']) => {
    switch (status) {
      case 'completed':
        return {
          circle: 'bg-primary text-primary-foreground',
          line: 'bg-primary',
          text: 'text-foreground font-medium',
        };
      case 'current':
        return {
          circle: 'bg-primary/20 text-primary border-2 border-primary',
          line: 'bg-muted',
          text: 'text-primary font-semibold',
        };
      case 'error':
        return {
          circle: 'bg-destructive text-destructive-foreground',
          line: 'bg-destructive/30',
          text: 'text-destructive font-medium',
        };
      default:
        return {
          circle: 'bg-muted text-muted-foreground',
          line: 'bg-muted',
          text: 'text-muted-foreground',
        };
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start justify-between min-w-[600px] px-4 py-2">
        {steps.map((step, index) => {
          const styles = getStatusStyles(step.status);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center relative">
              {/* Connector line (before) */}
              {index > 0 && (
                <div
                  className={cn(
                    'absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2',
                    getStatusStyles(steps[index - 1].status).line
                  )}
                  style={{ right: '50%', width: '100%' }}
                />
              )}

              {/* Step circle */}
              <div
                className={cn(
                  'relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  styles.circle
                )}
              >
                {step.status === 'error' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : step.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  step.icon
                )}
              </div>

              {/* Step label */}
              <div className="mt-2 text-center">
                <div className={cn('text-xs', styles.text)}>{step.label}</div>
                {step.date && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">{step.date}</div>
                )}
                {step.value && (
                  <div className={cn('text-[10px] mt-0.5', step.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                    {step.value}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
