import {
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { itemTypeTabs } from '../constants';
import type { WizardStep } from '../types';

interface WizardFooterProps {
  wizardStep: WizardStep;
  setWizardStep: (s: WizardStep) => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
  totalItems: number;
  pricePerSqm: number;
  isPending: boolean;
  onCancel: () => void;
  onActivate: () => void;
  onGoToPricing: () => void;
}

export function WizardFooter({
  wizardStep,
  setWizardStep,
  activeTab,
  setActiveTab,
  totalItems,
  pricePerSqm,
  isPending,
  onCancel,
  onActivate,
  onGoToPricing,
}: WizardFooterProps) {
  return (
    <DialogFooter className="p-4 border-t shrink-0">
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2">
          {wizardStep === 'pricing' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWizardStep('components')}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const idx = itemTypeTabs.findIndex(t => t.value === activeTab);
                if (idx > 0) setActiveTab(itemTypeTabs[idx - 1].value);
              }}
              disabled={itemTypeTabs.findIndex(t => t.value === activeTab) === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          {wizardStep === 'components' ? (
            <>
              <Package className="w-4 h-4" />
              {totalItems} componentes
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4" />
              {pricePerSqm > 0 ? `R$ ${pricePerSqm.toFixed(2)}/m²` : 'Defina o preço'}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>

          {wizardStep === 'components' ? (
            <Button size="sm" onClick={onGoToPricing} className="gap-1">
              <span className="hidden sm:inline">Próximo: Preços</span>
              <span className="sm:hidden">Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onActivate}
              disabled={isPending}
              className="bg-success hover:bg-success/90 gap-1"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Ativando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">Ativar Produto</span>
                  <span className="sm:hidden">Ativar</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </DialogFooter>
  );
}
