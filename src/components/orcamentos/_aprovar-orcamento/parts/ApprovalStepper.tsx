import { CheckCircle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApprovalStep } from '../types';

export const APPROVAL_STEPS = [
  { key: 'payment' as const, label: 'Pagamento', fullLabel: 'Forma de Pagamento', icon: CreditCard },
  { key: 'confirm' as const, label: 'Confirmar', fullLabel: 'Confirmação', icon: CheckCircle },
];

interface Props {
  currentStep: ApprovalStep;
  onNavigate: (step: ApprovalStep) => void;
}

export function ApprovalStepper({ currentStep, onNavigate }: Props) {
  const currentStepIndex = APPROVAL_STEPS.findIndex(s => s.key === currentStep);

  const canNavigateToStep = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return true;
    if (stepIndex === currentStepIndex + 1) return true;
    return false;
  };

  return (
    <div className="flex items-center mt-4">
      {APPROVAL_STEPS.map((step, idx) => {
        const isActive = currentStep === step.key;
        const isCompleted = idx < currentStepIndex;
        const isClickable = canNavigateToStep(idx) || isCompleted;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => isClickable && onNavigate(step.key)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 transition-all group",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-not-allowed opacity-60"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                isCompleted && "bg-green-500 text-white",
                !isActive && !isCompleted && "bg-muted text-muted-foreground",
                isClickable && !isActive && "group-hover:bg-primary/20"
              )}>
                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <span>{idx + 1}</span>}
              </div>
              <div className="hidden sm:block">
                <span className={cn(
                  "text-sm font-medium",
                  isActive && "text-primary",
                  isCompleted && "text-green-600",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
            </button>

            {idx < APPROVAL_STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-3 transition-colors",
                idx < currentStepIndex ? "bg-green-500" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
