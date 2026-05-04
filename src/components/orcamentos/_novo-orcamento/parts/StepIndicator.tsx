import { User, Package, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Step } from '../types';

const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'client', label: 'Cliente', icon: <User className="w-4 h-4" /> },
  { key: 'products', label: 'Produtos', icon: <Package className="w-4 h-4" /> },
  { key: 'review', label: 'Finalizar', icon: <Check className="w-4 h-4" /> },
];

interface Props {
  currentStep: Step;
  onStepChange: (step: Step) => void;
}

export function StepIndicator({ currentStep, onStepChange }: Props) {
  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center">
          <button
            type="button"
            onClick={() => {
              if (index < currentStepIndex) onStepChange(step.key);
            }}
            disabled={index > currentStepIndex}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              currentStep === step.key
                ? "bg-primary text-primary-foreground"
                : index < currentStepIndex
                ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            {step.icon}
            <span className="hidden sm:inline">{step.label}</span>
          </button>
          {index < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

export { steps };
