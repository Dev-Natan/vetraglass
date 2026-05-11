import { User, Layers, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Step } from '../types';

const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'client', label: 'Cliente', icon: <User className="w-4 h-4" /> },
  { key: 'products', label: 'Itens', icon: <Layers className="w-4 h-4" /> },
  { key: 'summary', label: 'Resumo', icon: <FileText className="w-4 h-4" /> },
  { key: 'finalize', label: 'Finalizar', icon: <Check className="w-4 h-4" /> },
];

interface Props {
  currentStep: Step;
  onStepChange: (step: Step) => void;
}

export function StepIndicator({ currentStep, onStepChange }: Props) {
  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="w-full rounded-xl border bg-card/50 px-4 py-3">
      <div className="flex items-center w-full">
        {steps.map((step, index) => {
          const isActive = currentStep === step.key;
          const isDone = index < currentStepIndex;
          const isClickable = index <= currentStepIndex;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => isClickable && onStepChange(step.key)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all",
                    isActive && "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15",
                    isDone && "bg-primary text-primary-foreground",
                    !isActive && !isDone && "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="w-4 h-4" /> : step.icon}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium hidden sm:inline",
                    isActive ? "text-foreground" : isDone ? "text-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 mx-3 transition-colors",
                    index < currentStepIndex ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { steps };
