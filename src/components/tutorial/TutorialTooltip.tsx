import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Lightbulb } from 'lucide-react';
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
      <div className="w-[340px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step.emoji && (
              <span className="text-lg">{step.emoji}</span>
            )}
            <span className="text-xs font-medium text-primary">
              Passo {currentStep + 1} de {totalSteps}
            </span>
          </div>
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
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-foreground text-lg leading-tight">
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>

          {/* Tip */}
          {step.tip && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/50 border border-accent">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                {step.tip}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-4">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={isFirstStep}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <Button
            variant="link"
            size="sm"
            onClick={onSkip}
            className="text-xs text-muted-foreground"
          >
            Pular tutorial
          </Button>

          <Button
            size="sm"
            onClick={onNext}
            className="gap-1 text-xs"
          >
            {isLastStep ? '🎉 Concluir' : 'Próximo'}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
