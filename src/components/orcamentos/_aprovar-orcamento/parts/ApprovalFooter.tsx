import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { APPROVAL_STEPS } from './ApprovalStepper';
import type { ApprovalStep } from '../types';

interface Props {
  currentStep: ApprovalStep;
  isApproving: boolean;
  hasEntry: boolean;
  isCaixaAberto: boolean;
  hasShortage: boolean;
  canApprove: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onApprove: () => void;
}

export function ApprovalFooter({
  currentStep, isApproving, hasShortage, canApprove,
  onCancel, onBack, onNext, onApprove,
}: Props) {
  const currentStepIndex = APPROVAL_STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="border-t bg-muted/30 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentStep !== 'payment' ? (
            <Button
              variant="ghost"
              onClick={onBack}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground hidden sm:block">
              Passo {currentStepIndex + 1} de {APPROVAL_STEPS.length}
            </span>
          )}
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {currentStepIndex + 1}/{APPROVAL_STEPS.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
            Cancelar
          </Button>

          {currentStep !== 'confirm' ? (
            <Button onClick={onNext} className="gap-2 min-w-[120px]">
              <span>{APPROVAL_STEPS[currentStepIndex + 1]?.label || 'Próximo'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={onApprove}
              disabled={isApproving || !canApprove}
              className="gap-2 bg-green-600 hover:bg-green-700 min-w-[140px]"
            >
              {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {hasShortage ? 'Aprovar (com falta)' : 'Aprovar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
