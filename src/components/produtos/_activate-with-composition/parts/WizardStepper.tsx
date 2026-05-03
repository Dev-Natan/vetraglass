import { CheckCircle2 } from 'lucide-react';
import { wizardSteps } from '../constants';
import type { WizardStep } from '../types';

interface WizardStepperProps {
  current: WizardStep;
  onChange: (step: WizardStep) => void;
}

export function WizardStepper({ current, onChange }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {wizardSteps.map((step, index) => {
        const isActive = current === step.id;
        const isPast = wizardSteps.findIndex(s => s.id === current) > index;
        const StepIcon = step.icon;

        return (
          <button
            key={step.id}
            onClick={() => {
              if (isPast) onChange(step.id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all flex-1 justify-center ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : isPast
                  ? 'bg-success/20 text-success hover:bg-success/30 cursor-pointer'
                  : 'bg-muted text-muted-foreground'
            }`}
            disabled={!isPast && !isActive}
          >
            {isPast ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <StepIcon className="w-4 h-4 shrink-0" />
            )}
            <span className="text-sm font-medium">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
