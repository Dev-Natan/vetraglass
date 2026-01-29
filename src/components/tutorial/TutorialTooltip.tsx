import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TutorialStep } from './tutorialSteps';

interface TutorialTooltipProps {
  step: TutorialStep;
  currentStep: number;
  totalSteps: number;
  position: { top: number; left: number };
  arrowPosition: 'left' | 'right' | 'top' | 'bottom';
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export function TutorialTooltip({
  step,
  currentStep,
  totalSteps,
  position,
  arrowPosition,
  onNext,
  onPrev,
  onSkip,
}: TutorialTooltipProps) {
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div
      className="fixed z-[10001] animate-scale-in"
      style={{ top: position.top, left: position.left }}
    >
      {/* Arrow */}
      <div
        className={cn(
          "absolute w-3 h-3 bg-card rotate-45 border",
          arrowPosition === 'left' && "left-[-7px] top-6 border-r-0 border-t-0",
          arrowPosition === 'right' && "right-[-7px] top-6 border-l-0 border-b-0",
          arrowPosition === 'top' && "top-[-7px] left-6 border-b-0 border-r-0",
          arrowPosition === 'bottom' && "bottom-[-7px] left-6 border-t-0 border-l-0"
        )}
      />

      {/* Content */}
      <div className="w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-primary">
            Passo {currentStep + 1} de {totalSteps}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onSkip}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3 className="font-semibold text-foreground text-lg mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={isFirstStep}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={onNext}
            className="gap-1"
          >
            {isLastStep ? 'Concluir' : 'Próximo'}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
