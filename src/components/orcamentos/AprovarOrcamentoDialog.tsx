import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, differenceInDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { usePaymentOptions } from '@/hooks/usePaymentOptions';
import type { CompositionStockResult } from '@/utils/checkCompositionStock';

import type {
  AprovarOrcamentoDialogProps,
  ApprovalStep,
  ApprovalFormState,
} from './_aprovar-orcamento/types';
import { formatCurrency, parseAmount } from './_aprovar-orcamento/utils';
import { useOpenCashRegister } from './_aprovar-orcamento/hooks/useOpenCashRegister';
import { useApprovalMutation } from './_aprovar-orcamento/hooks/useApprovalMutation';
import { ApprovalStepper, APPROVAL_STEPS } from './_aprovar-orcamento/parts/ApprovalStepper';
import { PaymentStep } from './_aprovar-orcamento/parts/PaymentStep';
import { ConfirmStep } from './_aprovar-orcamento/parts/ConfirmStep';
import { ApprovalFooter } from './_aprovar-orcamento/parts/ApprovalFooter';

const DEFAULT_FORM_STATE: ApprovalFormState = {
  selectedFormaId: null,
  selectedCondicaoId: null,
  entryAmount: '',
  entryPaymentMethod: 'pix',
  cardActualReceived: '',
  balanceDueDate: addDays(new Date(), 30),
  receiveOnCompletion: true,
  estimatedEnd: addDays(new Date(), 7),
  priority: 'normal',
  notes: '',
};

export function AprovarOrcamentoDialog({
  open,
  onOpenChange,
  quote,
  items,
  onSuccess,
}: AprovarOrcamentoDialogProps) {
  const { currentCompany, user } = useAuth();

  const [currentStep, setCurrentStep] = useState<ApprovalStep>('payment');
  const [formState, setFormState] = useState<ApprovalFormState>(DEFAULT_FORM_STATE);
  const [stockCheckResult, setStockCheckResult] = useState<CompositionStockResult | null>(null);

  const { formasPagamento, condicoesPagamento, hasPaymentOptions, initializeDefaults } = usePaymentOptions();

  const totalOriginal = items.reduce((sum, item) => sum + item.total_price, 0);
  
  const selectedForma = useMemo(() => 
    formasPagamento.find(f => f.id === formState.selectedFormaId),
    [formasPagamento, formState.selectedFormaId]
  );

  const condicoesDaForma = useMemo(
    () => condicoesPagamento.filter(
      (condicao) => !condicao.forma_pagamento_id || condicao.forma_pagamento_id === formState.selectedFormaId,
    ),
    [condicoesPagamento, formState.selectedFormaId],
  );

  const valorFinal = useMemo(() => {
    if (!quote) return totalOriginal;
    
    // Se for pagamento à vista, usa o valor com desconto (final_amount).
    // Fallbacks locais como PIX/Dinheiro também contam como à vista.
    const tipoPagamento = selectedForma?.tipo;
    if (tipoPagamento && ['avista', 'pix', 'dinheiro', 'debito', 'boleto', 'transferencia'].includes(tipoPagamento)) {
      return quote.final_amount;
    }
    
    return quote.total_amount || totalOriginal;
  }, [quote, totalOriginal, selectedForma]);

  const entryValue = parseAmount(formState.entryAmount);
  const hasEntry = entryValue > 0;

  const { data: openCashRegister } = useOpenCashRegister(currentCompany?.id, user?.id, open);
  const isCaixaAberto = !!openCashRegister;

  const quoteAgeDays = quote?.created_at
    ? differenceInDays(new Date(), new Date(quote.created_at))
    : 0;
  const isOldQuote = quoteAgeDays > 30;

  const updateField = <K extends keyof ApprovalFormState>(key: K, value: ApprovalFormState[K]) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentStep('payment');
      setFormState(DEFAULT_FORM_STATE);
    }
  }, [open]);

  // Auto-select first valid payment option (avista or parcelado only)
  useEffect(() => {
    if (formasPagamento.length > 0 && !formState.selectedFormaId) {
      setFormState(prev => ({ ...prev, selectedFormaId: formasPagamento[0].id }));
    }
  }, [formasPagamento, formState.selectedFormaId]);

  useEffect(() => {
    if (!formState.selectedFormaId) return;
    const selectedStillValid = condicoesDaForma.some(
      (condicao) => condicao.id === formState.selectedCondicaoId,
    );
    if (!selectedStillValid) {
      setFormState((previous) => ({
        ...previous,
        selectedCondicaoId: condicoesDaForma[0]?.id ?? null,
      }));
    }
  }, [condicoesDaForma, formState.selectedCondicaoId, formState.selectedFormaId]);

  const approveMutation = useApprovalMutation({
    quote,
    items,
    companyId: currentCompany?.id,
    userId: user?.id,
    openCashRegister,
    totalOriginal,
    valorFinal,
    formState,
    onClose: () => onOpenChange(false),
    onSuccess,
  });

  if (!quote) return null;

  const currentStepIndex = APPROVAL_STEPS.findIndex(s => s.key === currentStep);

  const handleNext = () => {
    if (currentStep === 'payment') setCurrentStep('confirm');
  };

  const handleBack = () => {
    if (currentStep === 'confirm') setCurrentStep('payment');
  };

  const navigateToStep = (stepKey: ApprovalStep) => {
    const targetIndex = APPROVAL_STEPS.findIndex(s => s.key === stepKey);
    if (targetIndex <= currentStepIndex + 1) setCurrentStep(stepKey);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col min-h-0 p-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <span className="truncate">Aprovar #{quote.quote_number.toString().padStart(4, '0')}</span>
              </DialogTitle>
              <DialogDescription className="flex items-center gap-3 mt-1 ml-10">
                <span className="truncate">{quote.customer_name}</span>
                <span className="text-primary font-semibold">{formatCurrency(valorFinal)}</span>
                {isOldQuote && (
                  <Badge variant="destructive" className="gap-1 flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    {quoteAgeDays}d
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>

          <ApprovalStepper currentStep={currentStep} onNavigate={navigateToStep} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {currentStep === 'payment' && (
            <PaymentStep
              state={formState}
              onChange={updateField}
              formasPagamento={formasPagamento}
              condicoesPagamento={condicoesPagamento}
              hasPaymentOptions={hasPaymentOptions}
              onInitializeDefaults={() => initializeDefaults.mutate()}
              isInitializingDefaults={initializeDefaults.isPending}
              isCaixaAberto={isCaixaAberto}
              valorFinal={valorFinal}
              quote={quote}
            />
          )}

          {currentStep === 'confirm' && (
            <ConfirmStep
              quote={quote}
              items={items}
              state={formState}
              companyId={currentCompany?.id}
              valorFinal={valorFinal}
              isCaixaAberto={isCaixaAberto}
              selectedForma={selectedForma}
              onStockCheck={setStockCheckResult}
            />
          )}
        </div>

        <ApprovalFooter
          currentStep={currentStep}
          isApproving={approveMutation.isPending}
          hasEntry={hasEntry}
          isCaixaAberto={isCaixaAberto}
          hasShortage={!!stockCheckResult?.hasShortage}
          canApprove={
            !approveMutation.isSuccess
            && !!formState.selectedFormaId
            && entryValue >= 0
            && entryValue <= valorFinal
            && (selectedForma?.tipo !== 'parcelado' || !!formState.selectedCondicaoId)
          }
          onCancel={() => onOpenChange(false)}
          onBack={handleBack}
          onNext={handleNext}
          onApprove={() => approveMutation.mutate()}
        />
      </DialogContent>
    </Dialog>
  );
}
