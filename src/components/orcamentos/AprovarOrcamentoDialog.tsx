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
  CreditCard, 
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  ClipboardList,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Receipt,
  Wallet,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateOSDocuments } from '@/utils/generateOSDocuments';
import { generateMaterialConsumption, linkReservationsToConsumption } from '@/utils/generateMaterialConsumption';
import { MaterialsAvailabilityPreview } from './MaterialsAvailabilityPreview';
import { usePaymentOptions } from '@/hooks/usePaymentOptions';

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

type ApprovalStep = 'payment' | 'confirm';

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
  const [currentStep, setCurrentStep] = useState<ApprovalStep>('payment');
  
  // Payment state
  const [selectedFormaId, setSelectedFormaId] = useState<string | null>(null);
  
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
    isLoading: isLoadingPayment,
    hasPaymentOptions,
    initializeDefaults,
  } = usePaymentOptions();

  const totalOriginal = items.reduce((sum, item) => sum + item.total_price, 0);

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

  // Calculate final values - usar final_amount (com desconto) como base
  // NÃO PERMITE DESCONTOS ADICIONAIS - valor do orçamento é final
  const valorFinal = useMemo(() => {
    return quote?.final_amount || totalOriginal;
  }, [totalOriginal, quote]);

  const entryValue = parseFloat(entryAmount.replace(',', '.')) || 0;
  const hasEntry = entryValue > 0;
  const pendingAmount = valorFinal - entryValue;
  const isCaixaAberto = !!openCashRegister;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep('payment');
      setSelectedFormaId(null);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !currentCompany?.id || !user?.id) {
        throw new Error('Dados incompletos');
      }

      const finalValue = valorFinal;
      
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
          condicao_pagamento_id: null,
          valor_original: totalOriginal,
          valor_final_aprovado: finalValue,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', quote.id);

      if (quoteUpdateError) throw quoteUpdateError;

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

          // CORREÇÃO: Vincular cash_movement à venda para rastreabilidade COMPLETA
          if (cashMovement?.id && sale?.id) {
            const { error: linkError } = await supabase
              .from('cash_movements')
              .update({ sale_id: sale.id })
              .eq('id', cashMovement.id);
            
            if (linkError) {
              console.error('ERRO ao vincular cash_movement à venda:', linkError);
            } else {
              console.log('✓ cash_movement vinculado à venda:', cashMovement.id, '→', sale.id);
            }
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

      // 5. Create accounts_receivable for pending amount (single installment - "Na entrega")
      if (pendingAmount > 0) {
        const { error: receivablesError } = await supabase
          .from('accounts_receivable')
          .insert({
            company_id: currentCompany.id,
            ordem_servico_id: ordemServico.id,
            quote_id: quote.id,
            sale_id: saleId,
            customer_name: quote.customer_name,
            description: `OS #${ordemServico.os_number} - Saldo na entrega`,
            total_amount: pendingAmount,
            installment_number: 1,
            total_installments: 1,
            due_date: estimatedEnd ? format(estimatedEnd, 'yyyy-MM-dd') : format(addDays(new Date(), 30), 'yyyy-MM-dd'),
            status: 'pending',
            created_by: user.id,
          });
        
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
    if (currentStep === 'payment') {
      setCurrentStep('confirm');
    }
  };

  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('payment');
    }
  };

  if (!quote) return null;

  

  const steps = [
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
          {/* Step 1: Payment Configuration */}
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
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Valor do Orçamento</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(valorFinal)}
                        </span>
                      </div>

                      {hasEntry && (
                        <>
                          <Separator />
                          <div className="flex justify-between text-sm bg-green-50 dark:bg-green-950/30 p-2 rounded">
                            <span className="text-green-700 dark:text-green-300">Entrada</span>
                            <span className="text-green-700 dark:text-green-300 font-medium">
                              -{formatCurrency(entryValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Saldo na Entrega</span>
                            <span className="text-xl font-bold">{formatCurrency(pendingAmount)}</span>
                          </div>
                        </>
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
                      
                      {/* Breakdown de valores */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal (itens)</span>
                        <span>{formatCurrency(quote.total_amount)}</span>
                      </div>
                      
                      {quote.discount_percent && quote.discount_percent > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Desconto do orçamento ({quote.discount_percent}%)</span>
                          <span>-{formatCurrency(quote.discount_amount || 0)}</span>
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="flex justify-between font-bold text-lg">
                        <span>Valor Final</span>
                        <span className="text-primary">{formatCurrency(valorFinal)}</span>
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
                        <span className="text-muted-foreground">Saldo na entrega</span>
                        <span className="text-xl font-bold">{formatCurrency(pendingAmount)}</span>
                      </div>
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
              {currentStep !== 'payment' ? (
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
