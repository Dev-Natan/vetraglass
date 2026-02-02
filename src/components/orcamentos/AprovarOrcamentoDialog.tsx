import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  CheckCircle, 
  DollarSign, 
  CreditCard, 
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  ClipboardList,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Percent,
  Receipt,
  Wallet,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateOSDocuments } from '@/utils/generateOSDocuments';
import { generateMaterialConsumption, linkReservationsToConsumption } from '@/utils/generateMaterialConsumption';
import { MaterialsAvailabilityPreview } from './MaterialsAvailabilityPreview';
import { usePaymentOptions, CondicaoPagamento } from '@/hooks/usePaymentOptions';
import { usePriceRevision, QuoteItemWithRevision } from '@/hooks/usePriceRevision';

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  total_amount: number;
  discount_percent?: number | null;  // % de desconto aplicado no orçamento
  discount_amount?: number | null;   // Valor absoluto do desconto
  final_amount: number;              // Valor final (já com desconto)
  created_at?: string;
}

interface QuoteItem {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  company_product_id?: string | null;
  product_template_id?: string | null;
  glass_thickness?: string | null;
  glass_color?: string | null;
  has_glass?: boolean | null;
}

interface AprovarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  items: QuoteItem[];
  onSuccess?: () => void;
}

type ApprovalStep = 'price-review' | 'payment' | 'confirm';

export function AprovarOrcamentoDialog({
  open,
  onOpenChange,
  quote,
  items,
  onSuccess,
}: AprovarOrcamentoDialogProps) {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step management
  const [currentStep, setCurrentStep] = useState<ApprovalStep>('price-review');
  
  // Price revision state
  const [useCurrentPrices, setUseCurrentPrices] = useState(false);
  const [itemPriceOverrides, setItemPriceOverrides] = useState<Record<string, boolean>>({});
  
  // Payment state
  const [selectedFormaId, setSelectedFormaId] = useState<string | null>(null);
  const [selectedCondicaoId, setSelectedCondicaoId] = useState<string | null>(null);
  
  // Entry payment state
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPaymentMethod, setEntryPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('pix');
  
  // OS configuration
  const [estimatedEnd, setEstimatedEnd] = useState<Date | undefined>(addDays(new Date(), 7));
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');

  // Hooks
  const { 
    formasPagamento, 
    condicoesPagamento, 
    isLoading: isLoadingPayment,
    hasPaymentOptions,
    initializeDefaults,
    calculatePayment,
    getCondicoesByForma,
  } = usePaymentOptions();

  const {
    revisedItems,
    hasAnyPriceChanges,
    totalOriginal,
    totalWithCurrentPrices,
    totalDifference,
  } = usePriceRevision({ items, companyId: currentCompany?.id });

  // Check if cash register is open
  const { data: openCashRegister } = useQuery({
    queryKey: ['cash-register-open', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && open,
  });

  // Calculate quote age
  const quoteAgeDays = quote?.created_at 
    ? differenceInDays(new Date(), new Date(quote.created_at))
    : 0;
  const isOldQuote = quoteAgeDays > 30;

  // Desconto existente do orçamento
  const quoteDiscountPercent = quote?.discount_percent || 0;
  const hasExistingDiscount = quoteDiscountPercent > 0;

  // Calculate final values - CORRIGIDO: usar final_amount (com desconto) como base
  const valorBase = useMemo(() => {
    if (useCurrentPrices) {
      // Recalcular com preços atuais
      const revisedTotal = revisedItems.reduce((sum, item) => {
        const useCurrentForItem = itemPriceOverrides[item.id] !== false;
        return sum + (useCurrentForItem && item.currentCalculatedTotal 
          ? item.currentCalculatedTotal 
          : item.total_price);
      }, 0);
      // Reaplicar o desconto % do orçamento original aos preços atuais
      if (hasExistingDiscount) {
        return revisedTotal * (1 - quoteDiscountPercent / 100);
      }
      return revisedTotal;
    }
    // CORREÇÃO: usar final_amount que JÁ inclui o desconto aplicado na criação
    return quote?.final_amount || totalOriginal;
  }, [useCurrentPrices, revisedItems, itemPriceOverrides, totalOriginal, quote, hasExistingDiscount, quoteDiscountPercent]);

  const selectedCondicao = condicoesPagamento.find(c => c.id === selectedCondicaoId) || null;
  const paymentCalculation = calculatePayment(valorBase, selectedCondicao);
  
  const entryValue = parseFloat(entryAmount.replace(',', '.')) || 0;
  const hasEntry = entryValue > 0;
  const pendingAmount = paymentCalculation.valorFinal - entryValue;
  const isCaixaAberto = !!openCashRegister;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep('price-review');
      setUseCurrentPrices(false);
      setItemPriceOverrides({});
      setSelectedFormaId(null);
      setSelectedCondicaoId(null);
      setEntryAmount('');
      setEntryPaymentMethod('pix');
      setEstimatedEnd(addDays(new Date(), 7));
      setPriority('normal');
      setNotes('');
    }
  }, [open]);

  // Auto-select first payment option if available
  useEffect(() => {
    if (formasPagamento.length > 0 && !selectedFormaId) {
      setSelectedFormaId(formasPagamento[0].id);
    }
  }, [formasPagamento, selectedFormaId]);

  // Auto-select payment condition - CORRIGIDO: priorizar condições sem desconto se já existe desconto no orçamento
  useEffect(() => {
    const availableCondicoes = getCondicoesByForma(selectedFormaId);
    if (availableCondicoes.length > 0 && !selectedCondicaoId) {
      if (hasExistingDiscount) {
        // Priorizar condição sem desconto adicional
        const condicaoSemDesconto = availableCondicoes.find(c => c.desconto_percent === 0);
        if (condicaoSemDesconto) {
          setSelectedCondicaoId(condicaoSemDesconto.id);
          return;
        }
      }
      setSelectedCondicaoId(availableCondicoes[0].id);
    }
  }, [selectedFormaId, getCondicoesByForma, selectedCondicaoId, hasExistingDiscount]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !currentCompany?.id || !user?.id) {
        throw new Error('Dados incompletos');
      }

      const finalValue = paymentCalculation.valorFinal;
      const reajusteAplicado = useCurrentPrices && hasAnyPriceChanges;
      
      // Calculate correct paid_amount for OS
      const osPaidAmount = hasEntry && isCaixaAberto ? entryValue : 0;

      // If there's an entry and cash is not open, error
      if (hasEntry && !isCaixaAberto) {
        throw new Error('Caixa precisa estar aberto para registrar entrada');
      }

      // 1. Update quote with approval data
      const { error: quoteUpdateError } = await supabase
        .from('quotes')
        .update({
          status: 'approved',
          forma_pagamento_id: selectedFormaId,
          condicao_pagamento_id: selectedCondicaoId,
          valor_original: totalOriginal,
          valor_reajustado: useCurrentPrices ? valorBase : null,
          valor_final_aprovado: finalValue,
          reajuste_aplicado: reajusteAplicado,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', quote.id);

      if (quoteUpdateError) throw quoteUpdateError;

      // 2. Save price revision history if applicable
      if (reajusteAplicado) {
        const revisions = revisedItems
          .filter(item => item.needsRevision)
          .map(item => ({
            quote_id: quote.id,
            quote_item_id: item.id,
            preco_original: item.total_price,
            preco_tabela_atual: item.currentCalculatedTotal || item.total_price,
            preco_usado: itemPriceOverrides[item.id] !== false 
              ? (item.currentCalculatedTotal || item.total_price)
              : item.total_price,
            usou_preco_atual: itemPriceOverrides[item.id] !== false,
          }));

        if (revisions.length > 0) {
          const { error: revisionError } = await supabase
            .from('quote_price_revisions')
            .insert(revisions);
          
          if (revisionError) {
            console.warn('Error saving price revisions:', revisionError);
          }
        }
      }

      // 3. Create order of service
      const { data: ordemServico, error: osError } = await supabase
        .from('ordens_servico')
        .insert({
          company_id: currentCompany.id,
          quote_id: quote.id,
          customer_name: quote.customer_name,
          customer_phone: quote.customer_phone,
          customer_email: quote.customer_email,
          customer_address: quote.customer_address,
          status: 'pending',
          priority,
          estimated_end: estimatedEnd?.toISOString().split('T')[0],
          total_amount: finalValue,
          paid_amount: osPaidAmount,
          pending_amount: finalValue - osPaidAmount,
          notes,
          current_stage: 'Aguardando início',
          stages: JSON.stringify([
            { name: 'Aguardando início', completed: false },
            { name: 'Em produção', completed: false },
            { name: 'Instalação', completed: false },
            { name: 'Finalizado', completed: false },
          ]),
        })
        .select()
        .single();

      if (osError) throw osError;

      let saleId: string | null = null;

      // 4. If there's an entry, create deposit record and partial sale
      if (hasEntry) {
        // 4.1 Create quote_deposits record
        const { error: depositError } = await supabase
          .from('quote_deposits')
          .insert({
            company_id: currentCompany.id,
            quote_id: quote.id,
            ordem_servico_id: ordemServico.id,
            customer_name: quote.customer_name,
            customer_phone: quote.customer_phone,
            amount: entryValue,
            payment_method: entryPaymentMethod,
            status: isCaixaAberto ? 'received' : 'pending',
            cash_register_id: isCaixaAberto ? openCashRegister?.id : null,
            created_by: user.id,
          });

        if (depositError) {
          console.error('Error creating deposit:', depositError);
        }

        // 4.2 Create accounts_receivable for the entry
        const { error: entryReceivableError } = await supabase
          .from('accounts_receivable')
          .insert({
            company_id: currentCompany.id,
            ordem_servico_id: ordemServico.id,
            quote_id: quote.id,
            customer_name: quote.customer_name,
            description: `Entrada - Orç. #${quote.quote_number.toString().padStart(4, '0')}`,
            total_amount: entryValue,
            paid_amount: isCaixaAberto ? entryValue : 0,
            status: isCaixaAberto ? 'paid' : 'pending',
            due_date: format(new Date(), 'yyyy-MM-dd'),
            receivable_type: 'entrada_orcamento',
            installment_number: 0,
            total_installments: 0,
            created_by: user.id,
          });

        if (entryReceivableError) {
          console.error('Error creating entry receivable:', entryReceivableError);
        }

        // 4.3 If cash register is open, create cash movement and partial sale
        if (openCashRegister) {
          // IMPORTANTE: Criar movimento de caixa vinculado ao ORÇAMENTO
          // Esse vínculo será transferido para a VENDA quando o orçamento for faturado
          const { data: cashMovement, error: cashMovementError } = await supabase
            .from('cash_movements')
            .insert({
              cash_register_id: openCashRegister.id,
              company_id: currentCompany.id,
              type: 'entrada',
              category: 'entrada_orcamento',
              amount: entryValue,
              description: `Entrada - Orç. #${quote.quote_number.toString().padStart(4, '0')} - ${quote.customer_name}`,
              payment_method: entryPaymentMethod,
              created_by: user.id,
              // Vínculo obrigatório: origem e referência
              origem: 'orcamento',
            })
            .select('id')
            .single();

          if (cashMovementError) {
            console.error('Error creating cash movement:', cashMovementError);
          }

          // Atualizar quote_deposit com o cash_movement_id
          if (cashMovement?.id) {
            await supabase
              .from('quote_deposits')
              .update({ cash_movement_id: cashMovement.id })
              .eq('quote_id', quote.id)
              .eq('status', 'received');
          }

          // Criar venda parcial (para rastreamento, sem duplicar movimento de caixa)
          const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
              company_id: currentCompany.id,
              cash_register_id: openCashRegister.id,
              customer_name: quote.customer_name,
              subtotal: entryValue,
              total_amount: entryValue,
              payment_method: entryPaymentMethod,
              payment_status: 'paid',
              sale_type: 'partial',
              paid_amount: entryValue,
              pending_amount: pendingAmount,
              quote_id: quote.id,
              ordem_servico_id: ordemServico.id,
              sold_by: user.id,
              notes: `Entrada do orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
            })
            .select()
            .single();

          if (saleError) throw saleError;
          saleId = sale.id;

          // Vincular cash_movement à venda para rastreabilidade
          if (cashMovement?.id) {
            await supabase
              .from('cash_movements')
              .update({ sale_id: sale.id })
              .eq('id', cashMovement.id);
          }

          // Create sale item
          await supabase.from('sale_items').insert({
            sale_id: sale.id,
            item_name: `Entrada - Orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
            item_unit: 'un',
            quantity: 1,
            unit_price: entryValue,
            total_price: entryValue,
          });

          // Update OS with sale_id
          await supabase
            .from('ordens_servico')
            .update({ sale_id: sale.id })
            .eq('id', ordemServico.id);
        }
      }

      // 5. Create accounts_receivable for pending installments
      if (pendingAmount > 0 && selectedCondicao) {
        const parcelas = selectedCondicao.parcelas;
        const valorParcela = Math.round((pendingAmount / parcelas) * 100) / 100;
        const resto = Math.round((pendingAmount - valorParcela * parcelas) * 100) / 100;

        const installmentsToInsert = Array.from({ length: parcelas }, (_, i) => {
          const dueDate = addMonths(addDays(new Date(), selectedCondicao.dias_entre_parcelas), i);
          return {
            company_id: currentCompany.id,
            ordem_servico_id: ordemServico.id,
            quote_id: quote.id,
            sale_id: saleId,
            customer_name: quote.customer_name,
            description: `OS #${ordemServico.os_number} - Parcela ${i + 1}/${parcelas}`,
            total_amount: i === 0 ? valorParcela + resto : valorParcela,
            installment_number: i + 1,
            total_installments: parcelas,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            status: 'pending',
            created_by: user.id,
          };
        });

        const { error: receivablesError } = await supabase
          .from('accounts_receivable')
          .insert(installmentsToInsert);
        
        if (receivablesError) {
          console.error('Error creating receivables:', receivablesError);
        }
      }

      // 6. Generate OS documents
      const docsResult = await generateOSDocuments(ordemServico.id, items);
      if (!docsResult.success) {
        console.warn('Error generating OS documents:', docsResult.error);
      }

      // 7. Generate material consumption records (status='pending')
      const consumptionResult = await generateMaterialConsumption(
        ordemServico.id,
        currentCompany.id,
        items.map(item => ({
          id: item.id,
          description: item.description,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          company_product_id: item.company_product_id,
          product_template_id: item.product_template_id,
        }))
      );
      if (!consumptionResult.success) {
        console.warn('Error generating material consumption:', consumptionResult.error);
      }

      // 8. Link stock reservations to consumption records
      await linkReservationsToConsumption(ordemServico.id);

      // 9. Create delivery appointment
      if (estimatedEnd) {
        await supabase.from('service_appointments').insert({
          company_id: currentCompany.id,
          title: `Entrega OS #${ordemServico.os_number}`,
          appointment_type: 'delivery',
          status: 'pending',
          scheduled_date: format(estimatedEnd, 'yyyy-MM-dd'),
          all_day: true,
          customer_name: quote.customer_name,
          customer_phone: quote.customer_phone,
          customer_address: quote.customer_address,
          ordem_servico_id: ordemServico.id,
          quote_id: quote.id,
        });
      }

      return { ordemServico, saleId };
    },
    onSuccess: (data) => {
      const osNumber = data.ordemServico.os_number;
      toast({
        title: 'Orçamento aprovado!',
        description: `OS #${osNumber} criada com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['quote-deposit'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['material-consumption'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao aprovar orçamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleNext = () => {
    if (currentStep === 'price-review') {
      setCurrentStep('payment');
    } else if (currentStep === 'payment') {
      setCurrentStep('confirm');
    }
  };

  const handleBack = () => {
    if (currentStep === 'payment') {
      setCurrentStep('price-review');
    } else if (currentStep === 'confirm') {
      setCurrentStep('payment');
    }
  };

  const toggleItemPriceOverride = (itemId: string) => {
    setItemPriceOverrides(prev => ({
      ...prev,
      [itemId]: prev[itemId] === false ? true : false,
    }));
  };

  if (!quote) return null;

  const availableCondicoes = getCondicoesByForma(selectedFormaId);

  const steps = [
    { key: 'price-review' as const, label: 'Preços', fullLabel: 'Revisão de Preços', icon: RefreshCw },
    { key: 'payment' as const, label: 'Pagamento', fullLabel: 'Forma de Pagamento', icon: CreditCard },
    { key: 'confirm' as const, label: 'Confirmar', fullLabel: 'Confirmação', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const canNavigateToStep = (stepIndex: number) => {
    // Can always go back
    if (stepIndex < currentStepIndex) return true;
    // Can only go forward one step at a time
    if (stepIndex === currentStepIndex + 1) return true;
    return false;
  };

  const navigateToStep = (stepKey: ApprovalStep) => {
    const targetIndex = steps.findIndex(s => s.key === stepKey);
    if (canNavigateToStep(targetIndex) || targetIndex < currentStepIndex) {
      setCurrentStep(stepKey);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col min-h-0 p-0">
        {/* Compact Header */}
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
                <span className="text-primary font-semibold">{formatCurrency(quote.final_amount)}</span>
                {isOldQuote && (
                  <Badge variant="destructive" className="gap-1 flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    {quoteAgeDays}d
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="flex items-center mt-4">
            {steps.map((step, idx) => {
              const isActive = currentStep === step.key;
              const isCompleted = idx < currentStepIndex;
              const isClickable = canNavigateToStep(idx) || isCompleted;
              
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => isClickable && navigateToStep(step.key)}
                    disabled={!isClickable}
                    className={cn(
                      "flex items-center gap-2 transition-all group",
                      isClickable && "cursor-pointer",
                      !isClickable && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                      isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                      isCompleted && "bg-green-500 text-white",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground",
                      isClickable && !isActive && "group-hover:bg-primary/20"
                    )}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <span className={cn(
                        "text-sm font-medium",
                        isActive && "text-primary",
                        isCompleted && "text-green-600",
                        !isActive && !isCompleted && "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  </button>
                  
                  {idx < steps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-3 transition-colors",
                      idx < currentStepIndex ? "bg-green-500" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {/* Step 1: Price Review */}
          {currentStep === 'price-review' && (
            <div className="space-y-6 px-1">
              {/* Alert for old quotes */}
              {isOldQuote && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Orçamento com {quoteAgeDays} dias
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Recomendamos revisar os preços antes de aprovar para garantir que a margem esteja atualizada.
                    </p>
                  </div>
                </div>
              )}

              {/* Indicador de desconto existente no orçamento */}
              {hasExistingDiscount && (
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <Percent className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Desconto de {quoteDiscountPercent}% já aplicado no orçamento
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Valor original: {formatCurrency(quote.total_amount)} → Valor com desconto: {formatCurrency(quote.final_amount)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Este desconto será preservado na aprovação. Condições de pagamento com desconto adicional serão cumulativas.
                    </p>
                  </div>
                </div>
              )}

              {/* Global price update toggle */}
              <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                <div className="flex items-center gap-3">
                  <RefreshCw className={cn("w-5 h-5", hasAnyPriceChanges ? "text-amber-500" : "text-muted-foreground")} />
                  <div>
                    <Label className="text-base font-medium">Atualizar para preços atuais da tabela</Label>
                    <p className="text-sm text-muted-foreground">
                      {hasAnyPriceChanges 
                        ? `Diferença detectada: ${formatCurrency(totalDifference)} (${totalDifference > 0 ? '+' : ''}${((totalDifference / totalOriginal) * 100).toFixed(1)}%)`
                        : 'Nenhuma alteração de preço detectada'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={useCurrentPrices}
                  onCheckedChange={setUseCurrentPrices}
                  disabled={!hasAnyPriceChanges}
                />
              </div>

              {/* Price comparison table */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Comparação de Preços
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Item</TableHead>
                      <TableHead className="text-right">Valor Original</TableHead>
                      <TableHead className="text-right">Valor Tabela Atual</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      {useCurrentPrices && <TableHead className="text-center w-24">Usar Atual</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revisedItems.map((item) => (
                      <TableRow key={item.id} className={cn(item.needsRevision && "bg-amber-50/50 dark:bg-amber-950/20")}>
                        <TableCell>
                          <div className="font-medium">{item.description}</div>
                          {item.width && item.height && (
                            <div className="text-xs text-muted-foreground">
                              {item.width}x{item.height}mm • Qtd: {item.quantity}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.currentCalculatedTotal !== null ? (
                            <span className={cn(
                              "font-medium",
                              item.priceDifference > 0 && "text-green-600",
                              item.priceDifference < 0 && "text-red-600"
                            )}>
                              {formatCurrency(item.currentCalculatedTotal)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.needsRevision ? (
                            <div className="flex items-center justify-end gap-1">
                              {item.priceDifference > 0 ? (
                                <TrendingUp className="w-4 h-4 text-green-600" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-600" />
                              )}
                              <span className={cn(
                                "font-medium",
                                item.priceDifference > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {item.priceDifference > 0 ? '+' : ''}{item.percentDifference.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {useCurrentPrices && (
                          <TableCell className="text-center">
                            {item.needsRevision && (
                              <Checkbox
                                checked={itemPriceOverrides[item.id] !== false}
                                onCheckedChange={() => toggleItemPriceOverride(item.id)}
                              />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-xl bg-card">
                  <div className="text-sm text-muted-foreground mb-1">Valor Original</div>
                  <div className="text-2xl font-bold">{formatCurrency(totalOriginal)}</div>
                </div>
                <div className={cn(
                  "p-4 border rounded-xl",
                  useCurrentPrices ? "bg-primary/10 border-primary/30" : "bg-card"
                )}>
                  <div className="text-sm text-muted-foreground mb-1">
                    {useCurrentPrices ? 'Valor Atualizado' : 'Valor a Usar'}
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(valorBase)}
                  </div>
                  {useCurrentPrices && totalDifference !== 0 && (
                    <div className={cn(
                      "text-sm font-medium",
                      totalDifference > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {totalDifference > 0 ? '+' : ''}{formatCurrency(totalDifference)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Payment Configuration */}
          {currentStep === 'payment' && (
            <div className="space-y-6 px-1">
              {/* Initialize payment options if needed */}
              {!hasPaymentOptions && (
                <div className="flex items-center justify-between p-4 border rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <div>
                    <p className="font-medium">Configurar opções de pagamento</p>
                    <p className="text-sm text-muted-foreground">
                      Crie as formas e condições de pagamento padrão para sua empresa.
                    </p>
                  </div>
                  <Button onClick={() => initializeDefaults.mutate()} disabled={initializeDefaults.isPending}>
                    {initializeDefaults.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                    <span className="ml-2">Configurar</span>
                  </Button>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Payment Method Selection */}
                <div className="space-y-4">
                  {/* Payment Method */}
                  <div className="p-4 border rounded-xl bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Forma de Pagamento</Label>
                    </div>
                    
                    <Select value={selectedFormaId || ''} onValueChange={setSelectedFormaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a forma de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {formasPagamento.map(forma => (
                          <SelectItem key={forma.id} value={forma.id}>
                            <div className="flex items-center gap-2">
                              <span>{forma.nome}</span>
                              <Badge variant="outline" className="text-xs">
                                {forma.tipo === 'avista' ? 'À vista' : forma.tipo === 'parcelado' ? 'Parcelado' : 'Misto'}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Payment Condition */}
                  <div className="p-4 border rounded-xl bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <Percent className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Condição de Pagamento</Label>
                    </div>
                    
                    <Select value={selectedCondicaoId || ''} onValueChange={setSelectedCondicaoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a condição" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCondicoes.map(condicao => (
                          <SelectItem key={condicao.id} value={condicao.id}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span>{condicao.nome}</span>
                              {condicao.desconto_percent > 0 && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  -{condicao.desconto_percent}%
                                </Badge>
                              )}
                              {condicao.juros_percent > 0 && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                  +{condicao.juros_percent}%
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedCondicao && (
                      <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
                        <div className="flex justify-between">
                          <span>Parcelas:</span>
                          <span className="font-medium">{selectedCondicao.parcelas}x</span>
                        </div>
                        {selectedCondicao.dias_entre_parcelas > 0 && (
                          <div className="flex justify-between">
                            <span>Intervalo:</span>
                            <span className="font-medium">{selectedCondicao.dias_entre_parcelas} dias</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Entry Payment */}
                  <div className="p-4 border rounded-xl bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Entrada (opcional)</Label>
                    </div>

                    {!isCaixaAberto && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Caixa fechado. Abra o caixa para registrar entrada.</span>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="entryAmount">Valor da entrada</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          id="entryAmount"
                          value={entryAmount}
                          onChange={(e) => setEntryAmount(e.target.value)}
                          placeholder="0,00"
                          className="pl-9 h-12 text-lg"
                          disabled={!isCaixaAberto}
                        />
                      </div>
                    </div>

                    {hasEntry && isCaixaAberto && (
                      <div>
                        <Label>Forma de pagamento da entrada</Label>
                        <RadioGroup
                          value={entryPaymentMethod}
                          onValueChange={(v) => setEntryPaymentMethod(v as typeof entryPaymentMethod)}
                          className="flex gap-3 mt-2"
                        >
                          {['dinheiro', 'cartao', 'pix'].map(method => (
                            <div key={method} className="flex items-center space-x-2 p-2 border rounded-lg flex-1">
                              <RadioGroupItem value={method} id={`entry-${method}`} />
                              <Label htmlFor={`entry-${method}`} className="cursor-pointer capitalize">
                                {method === 'cartao' ? 'Cartão' : method.charAt(0).toUpperCase() + method.slice(1)}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Payment Summary */}
                <div className="space-y-4">
                  <div className="p-6 border-2 border-primary/30 rounded-xl bg-gradient-to-br from-primary/5 to-transparent space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-primary" />
                      Resumo do Pagamento
                    </h3>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor base</span>
                        <span>{formatCurrency(valorBase)}</span>
                      </div>

                      {paymentCalculation.desconto > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Desconto ({selectedCondicao?.desconto_percent}%)</span>
                          <span>-{formatCurrency(paymentCalculation.desconto)}</span>
                        </div>
                      )}

                      {paymentCalculation.juros > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Juros ({selectedCondicao?.juros_percent}%)</span>
                          <span>+{formatCurrency(paymentCalculation.juros)}</span>
                        </div>
                      )}

                      <Separator />

                      <div className="flex justify-between items-center">
                        <span className="font-medium">Valor Final</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(paymentCalculation.valorFinal)}
                        </span>
                      </div>

                      {hasEntry && (
                        <>
                          <div className="flex justify-between text-sm bg-green-50 dark:bg-green-950/30 p-2 rounded">
                            <span className="text-green-700 dark:text-green-300">Entrada</span>
                            <span className="text-green-700 dark:text-green-300 font-medium">
                              -{formatCurrency(entryValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Saldo Restante</span>
                            <span className="text-xl font-bold">{formatCurrency(pendingAmount)}</span>
                          </div>
                        </>
                      )}

                      {selectedCondicao && selectedCondicao.parcelas > 1 && (
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span>Parcelamento</span>
                            <span>{paymentCalculation.parcelas}x</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Valor da parcela</span>
                            <span className="text-lg font-bold">
                              {formatCurrency(hasEntry ? pendingAmount / paymentCalculation.parcelas : paymentCalculation.valorParcela)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* OS Configuration */}
                  <div className="p-4 border rounded-xl bg-card space-y-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-primary" />
                      <Label className="text-base font-semibold">Configuração da OS</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Prioridade</Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Previsão de entrega</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start mt-1">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {estimatedEnd ? format(estimatedEnd, 'dd/MM/yyyy') : 'Selecionar'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={estimatedEnd}
                              onSelect={setEstimatedEnd}
                              initialFocus
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notes">Observações</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observações sobre o serviço..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {currentStep === 'confirm' && (
            <div className="space-y-6 px-1">
              {/* Materials Preview */}
              {items.length > 0 && (
                <div className="p-4 border rounded-xl bg-card">
                  <MaterialsAvailabilityPreview 
                    quoteItems={items}
                    companyId={currentCompany?.id}
                  />
                </div>
              )}

              {/* Final Summary */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-xl bg-card">
                    <h3 className="font-semibold mb-4">Resumo de Valores</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliente</span>
                        <span className="font-medium">{quote.customer_name}</span>
                      </div>
                      
                      {/* Breakdown completo de descontos */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal (itens)</span>
                        <span>{formatCurrency(quote.total_amount)}</span>
                      </div>
                      
                      {hasExistingDiscount && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Desconto do orçamento ({quoteDiscountPercent}%)</span>
                          <span>-{formatCurrency(quote.discount_amount || 0)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor com desconto</span>
                        <span>{formatCurrency(quote.final_amount)}</span>
                      </div>

                      {useCurrentPrices && (
                        <div className="flex justify-between text-primary">
                          <span>Valor reajustado (preços atuais)</span>
                          <span className="font-medium">{formatCurrency(valorBase)}</span>
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Condição de pagamento</span>
                        <span>{selectedCondicao?.nome || '-'}</span>
                      </div>
                      
                      {paymentCalculation.desconto > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Desconto condição ({selectedCondicao?.desconto_percent}%)</span>
                          <span>-{formatCurrency(paymentCalculation.desconto)}</span>
                        </div>
                      )}
                      
                      {paymentCalculation.juros > 0 && (
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span>Juros condição ({selectedCondicao?.juros_percent}%)</span>
                          <span>+{formatCurrency(paymentCalculation.juros)}</span>
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="flex justify-between font-bold text-lg">
                        <span>Valor Final</span>
                        <span className="text-primary">{formatCurrency(paymentCalculation.valorFinal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-xl bg-card">
                    <h3 className="font-semibold mb-4">Ordem de Serviço</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prioridade</span>
                        <Badge variant={priority === 'urgent' ? 'destructive' : priority === 'high' ? 'default' : 'secondary'}>
                          {priority === 'low' ? 'Baixa' : priority === 'normal' ? 'Normal' : priority === 'high' ? 'Alta' : 'Urgente'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Previsão de entrega</span>
                        <span>{estimatedEnd ? format(estimatedEnd, 'dd/MM/yyyy') : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-6 border-2 border-primary/30 rounded-xl bg-gradient-to-br from-primary/10 to-transparent">
                    <h3 className="font-semibold text-lg mb-4">Financeiro</h3>
                    <div className="space-y-3">
                      {hasEntry && (
                        <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <span className="text-green-700 dark:text-green-300 font-medium">Entrada a receber</span>
                          <span className="text-xl font-bold text-green-600">{formatCurrency(entryValue)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Saldo pendente</span>
                        <span className="text-xl font-bold">{formatCurrency(pendingAmount)}</span>
                      </div>
                      {selectedCondicao && selectedCondicao.parcelas > 1 && (
                        <div className="text-sm text-muted-foreground">
                          Em {selectedCondicao.parcelas}x de {formatCurrency(pendingAmount / selectedCondicao.parcelas)}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasEntry && !isCaixaAberto && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Caixa precisa estar aberto</span>
                      </div>
                      <p className="text-sm text-destructive/80 mt-1">
                        Para registrar a entrada, abra o caixa antes de aprovar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="border-t bg-muted/30 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            {/* Left: Back button or step info */}
            <div className="flex items-center gap-2">
              {currentStep !== 'price-review' ? (
                <Button 
                  variant="ghost" 
                  onClick={handleBack} 
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Voltar</span>
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Passo {currentStepIndex + 1} de {steps.length}
                </span>
              )}
            </div>

            {/* Center: Current step indicator (mobile) */}
            <div className="flex sm:hidden items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {currentStepIndex + 1}/{steps.length}
              </span>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground"
              >
                Cancelar
              </Button>

              {currentStep !== 'confirm' ? (
                <Button onClick={handleNext} className="gap-2 min-w-[120px]">
                  <span>{steps[currentStepIndex + 1]?.label || 'Próximo'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending || (hasEntry && !isCaixaAberto)}
                  className="gap-2 bg-green-600 hover:bg-green-700 min-w-[140px]"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Aprovar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
