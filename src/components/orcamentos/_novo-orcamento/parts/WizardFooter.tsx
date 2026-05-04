import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Step } from '../types';

interface Props {
  currentStep: Step;
  currentStepIndex: number;
  isEditing: boolean;
  isPending: boolean;
  canProceedFromClient: boolean;
  canProceedFromProducts: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function WizardFooter({
  currentStep, currentStepIndex, isEditing, isPending,
  canProceedFromClient, canProceedFromProducts,
  onCancel, onBack, onNext, onSubmit,
}: Props) {
  return (
    <div className="shrink-0 p-6 pt-4 border-t flex justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={currentStepIndex === 0 ? onCancel : onBack}
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
      </Button>

      {currentStep !== 'review' ? (
        <Button
          type="button"
          onClick={onNext}
          disabled={
            (currentStep === 'client' && !canProceedFromClient) ||
            (currentStep === 'products' && !canProceedFromProducts)
          }
        >
          Próximo
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      ) : (
        <Button type="button" onClick={onSubmit} disabled={isPending}>
          {isEditing ? 'Salvar Alterações' : 'Criar Orçamento'}
        </Button>
      )}
    </div>
  );
}
