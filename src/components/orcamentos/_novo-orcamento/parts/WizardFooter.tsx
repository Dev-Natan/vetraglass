import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import type { Step } from '../types';

interface Props {
  currentStep: Step;
  currentStepIndex: number;
  isEditing: boolean;
  isPending: boolean;
  canProceedFromClient: boolean;
  canProceedFromProducts: boolean;
  itemsCount: number;
  partialTotal: number;
  formatCurrency: (value: number) => string;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function WizardFooter({
  currentStep, currentStepIndex, isEditing, isPending,
  canProceedFromClient, canProceedFromProducts,
  itemsCount, partialTotal, formatCurrency,
  onCancel, onBack, onNext, onSubmit,
}: Props) {
  const showPartial = currentStep === 'products' || currentStep === 'summary';
  const isFinal = currentStep === 'finalize';

  return (
    <div className="shrink-0 border-t bg-gradient-to-r from-primary/95 to-primary text-primary-foreground">
      <div className="flex items-center justify-between gap-3 p-4">
        {showPartial ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-primary-foreground/80 font-medium">
                {itemsCount} {itemsCount === 1 ? 'item' : 'itens'} · Total parcial
              </p>
              <p className="text-lg font-bold leading-tight">{formatCurrency(partialTotal)}</p>
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-primary-foreground/90">
            {currentStep === 'client' ? 'Etapa 1 de 4 · Dados do cliente' : 'Etapa final · Revise e finalize'}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={currentStepIndex === 0 ? onCancel : onBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
          </Button>

          {!isFinal ? (
            <Button
              type="button"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 font-semibold"
              onClick={onNext}
              disabled={
                (currentStep === 'client' && !canProceedFromClient) ||
                (currentStep === 'products' && !canProceedFromProducts)
              }
            >
              Avançar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90 font-semibold"
              onClick={onSubmit}
              disabled={isPending}
            >
              {isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar orçamento'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
