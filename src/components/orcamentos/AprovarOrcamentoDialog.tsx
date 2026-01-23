import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CheckCircle, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  ClipboardList,
  Wallet,
  Receipt
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateOSDocuments } from '@/utils/generateOSDocuments';

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  total_amount: number;
  final_amount: number;
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
}

interface AprovarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  items: QuoteItem[];
  onSuccess?: () => void;
}

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

  const [entryAmount, setEntryAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('pix');
  const [estimatedEnd, setEstimatedEnd] = useState<Date | undefined>(addDays(new Date(), 7));
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  
  // Installment configuration for pending balance
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstDueDays, setFirstDueDays] = useState(30);

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

  const isCaixaAberto = !!openCashRegister;
  const entryValue = parseFloat(entryAmount.replace(',', '.')) || 0;
  const totalAmount = quote?.final_amount || 0;
  const pendingAmount = totalAmount - entryValue;
  const hasEntry = entryValue > 0;

  // Generate installments preview for pending amount
  const installmentsPreview = useMemo(() => {
    if (pendingAmount <= 0 || installmentsCount < 1) return [];
    
    const baseAmount = Math.floor((pendingAmount / installmentsCount) * 100) / 100;
    const remainder = pendingAmount - (baseAmount * installmentsCount);
    
    // If firstDueDays is 0, use the estimated delivery date
    const firstDueDate = firstDueDays === 0 && estimatedEnd 
      ? estimatedEnd 
      : addDays(new Date(), firstDueDays);
    
    return Array.from({ length: installmentsCount }, (_, i) => ({
      number: i + 1,
      dueDate: addMonths(firstDueDate, i),
      amount: i === 0 ? baseAmount + remainder : baseAmount,
    }));
  }, [pendingAmount, installmentsCount, firstDueDays, estimatedEnd]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !currentCompany?.id || !user?.id) {
        throw new Error('Dados incompletos');
      }

      // Recalculate values inside mutation to ensure correct values
      const mutationEntryValue = parseFloat(entryAmount.replace(',', '.')) || 0;
      const mutationTotalAmount = quote.final_amount || 0;
      const mutationPendingAmount = mutationTotalAmount - mutationEntryValue;
      const mutationHasEntry = mutationEntryValue > 0;
      
      // Recalculate installments inside mutation
      const mutationInstallments = (() => {
        if (mutationPendingAmount <= 0 || installmentsCount < 1) return [];
        
        const baseAmount = Math.floor((mutationPendingAmount / installmentsCount) * 100) / 100;
        const remainder = Math.round((mutationPendingAmount - (baseAmount * installmentsCount)) * 100) / 100;
        
        // If firstDueDays is 0, use the estimated delivery date
        const firstDueDate = firstDueDays === 0 && estimatedEnd 
          ? estimatedEnd 
          : addDays(new Date(), firstDueDays);
        
        return Array.from({ length: installmentsCount }, (_, i) => ({
          number: i + 1,
          dueDate: addMonths(firstDueDate, i),
          amount: i === 0 ? baseAmount + remainder : baseAmount,
        }));
      })();

      // If there's an entry and cash is not open, error
      if (mutationHasEntry && !isCaixaAberto) {
        throw new Error('Caixa precisa estar aberto para registrar entrada');
      }

      // 1. Create order of service
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
          total_amount: mutationTotalAmount,
          paid_amount: mutationEntryValue,
          pending_amount: mutationPendingAmount,
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

      // 2. If there's an entry, create partial sale
      if (mutationHasEntry && openCashRegister) {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            company_id: currentCompany.id,
            cash_register_id: openCashRegister.id,
            customer_name: quote.customer_name,
            subtotal: mutationEntryValue,
            total_amount: mutationEntryValue,
            payment_method: paymentMethod,
            payment_status: 'paid',
            sale_type: 'partial',
            paid_amount: mutationEntryValue,
            pending_amount: mutationPendingAmount,
            quote_id: quote.id,
            ordem_servico_id: ordemServico.id,
            sold_by: user.id,
            notes: `Entrada do orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
          })
          .select()
          .single();

        if (saleError) throw saleError;
        saleId = sale.id;

        // Create sale item for the entry (just informational, no stock deduction)
        await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            item_name: `Entrada - Orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
            item_unit: 'un',
            quantity: 1,
            unit_price: mutationEntryValue,
            total_price: mutationEntryValue,
            notes: `Entrada parcial referente ao orçamento #${quote.quote_number}`,
          });

        // Update OS with sale_id
        await supabase
          .from('ordens_servico')
          .update({ sale_id: sale.id })
          .eq('id', ordemServico.id);
      }

      // 3. Create accounts_receivable for pending installments
      if (mutationPendingAmount > 0 && mutationInstallments.length > 0) {
        const installmentsToInsert = mutationInstallments.map((inst) => ({
          company_id: currentCompany.id,
          ordem_servico_id: ordemServico.id,
          quote_id: quote.id,
          sale_id: saleId,
          customer_name: quote.customer_name,
          description: `OS #${ordemServico.os_number} - Parcela ${inst.number}/${mutationInstallments.length}`,
          total_amount: inst.amount,
          installment_number: inst.number,
          total_installments: mutationInstallments.length,
          due_date: format(inst.dueDate, 'yyyy-MM-dd'),
          status: 'pending',
          created_by: user.id,
        }));

        const { error: receivablesError } = await supabase
          .from('accounts_receivable')
          .insert(installmentsToInsert);
        
        if (receivablesError) {
          console.error('Error creating receivables:', receivablesError);
          throw new Error(`Erro ao criar parcelas: ${receivablesError.message}`);
        }
      }

      // 4. Update quote status to approved
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ status: 'approved' })
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      // 5. Generate OS documents (materials, cutting plan, glass projects)
      const docsResult = await generateOSDocuments(ordemServico.id, items);
      if (!docsResult.success) {
        console.warn('Error generating OS documents:', docsResult.error);
      }

      // 6. Create delivery appointment in the agenda
      if (estimatedEnd) {
        const { error: appointmentError } = await supabase
          .from('service_appointments')
          .insert({
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
            notes: `Entrega programada referente ao orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
          });

        if (appointmentError) {
          console.warn('Error creating delivery appointment:', appointmentError);
        }
      }

      return { ordemServico, saleId };
    },
    onSuccess: (data) => {
      const osNumber = data.ordemServico.os_number;
      const parcelasMsg = installmentsPreview.length > 1 
        ? ` ${installmentsPreview.length} parcelas criadas em Contas a Receber.`
        : installmentsPreview.length === 1 
        ? ' Parcela criada em Contas a Receber.'
        : '';
      
      toast({
        title: 'Orçamento aprovado!',
        description: hasEntry
          ? `OS #${osNumber} criada. Entrada de ${formatCurrency(entryValue)} registrada.${parcelasMsg}`
          : `OS #${osNumber} criada. Valor pendente: ${formatCurrency(pendingAmount)}.${parcelasMsg}`,
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['service-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['today-appointments'] });
      resetForm();
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

  const resetForm = () => {
    setEntryAmount('');
    setPaymentMethod('pix');
    setEstimatedEnd(addDays(new Date(), 7));
    setPriority('normal');
    setNotes('');
    setInstallmentsCount(1);
    setFirstDueDays(30);
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Aprovar Orçamento
          </DialogTitle>
          <DialogDescription>
            Orçamento #{quote.quote_number.toString().padStart(4, '0')} - {quote.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Visual Flow Preview */}
          <div className="flex items-center justify-between gap-2 px-2">
            {[
              { label: 'Aprovação', active: true },
              { label: 'Entrada', active: hasEntry },
              { label: 'OS Criada', active: true },
              { label: 'Produção', active: false },
              { label: 'Faturamento', active: false },
            ].map((step, idx, arr) => (
              <div key={step.label} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                  step.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {idx + 1}
                </div>
                <span className={cn(
                  "text-[10px] hidden sm:block",
                  step.active ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
                {idx < arr.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1",
                    step.active ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 space-y-2 border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor do orçamento</span>
              <span className="font-bold text-xl text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <Separator />

          {/* Entry Payment */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">Entrada (opcional)</Label>
            </div>

            {!isCaixaAberto && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="w-4 h-4" />
                Caixa fechado. Abra o caixa para registrar entrada.
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="entryAmount">Valor da entrada</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <Input
                    id="entryAmount"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    placeholder="0,00"
                    className="pl-9"
                    disabled={!isCaixaAberto}
                  />
                </div>
              </div>

              {hasEntry && isCaixaAberto && (
                <>
                  <div>
                    <Label>Forma de pagamento</Label>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dinheiro" id="dinheiro" />
                        <Label htmlFor="dinheiro" className="flex items-center gap-1 cursor-pointer">
                          <DollarSign className="w-4 h-4" />
                          Dinheiro
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cartao" id="cartao" />
                        <Label htmlFor="cartao" className="flex items-center gap-1 cursor-pointer">
                          <CreditCard className="w-4 h-4" />
                          Cartão
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pix" id="pix" />
                        <Label htmlFor="pix" className="flex items-center gap-1 cursor-pointer">
                          <Smartphone className="w-4 h-4" />
                          Pix
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <div className="flex items-start gap-2 p-3 bg-primary/10 text-primary rounded-lg text-sm">
                    <Receipt className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      O valor da entrada será registrado como venda no caixa aberto. 
                      Certifique-se de receber o valor do cliente antes de aprovar.
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Service Order Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">Ordem de Serviço</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <RadioGroup
                  value={priority}
                  onValueChange={(v) => setPriority(v as typeof priority)}
                  className="flex flex-wrap gap-2 mt-2"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="low" id="low" />
                    <Label htmlFor="low" className="cursor-pointer text-sm">Baixa</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="normal" id="normal" />
                    <Label htmlFor="normal" className="cursor-pointer text-sm">Normal</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="cursor-pointer text-sm">Alta</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="urgent" id="urgent" />
                    <Label htmlFor="urgent" className="cursor-pointer text-sm">Urgente</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Previsão de entrega</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-2',
                        !estimatedEnd && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {estimatedEnd ? format(estimatedEnd, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
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
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Installments Configuration (when there's pending amount) */}
          {pendingAmount > 0 && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <Label className="text-base font-medium">Parcelamento do Saldo</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Número de Parcelas</Label>
                    <Select
                      value={String(installmentsCount)}
                      onValueChange={(v) => setInstallmentsCount(parseInt(v))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x de {formatCurrency(pendingAmount / n)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Primeiro Vencimento</Label>
                    <Select
                      value={String(firstDueDays)}
                      onValueChange={(v) => setFirstDueDays(parseInt(v))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Na entrega</SelectItem>
                        <SelectItem value="7">7 dias</SelectItem>
                        <SelectItem value="15">15 dias</SelectItem>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="45">45 dias</SelectItem>
                        <SelectItem value="60">60 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Installments Preview */}
                {installmentsPreview.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Parcelas a Receber:</p>
                    {installmentsPreview.map((inst) => (
                      <div key={inst.number} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Parcela {inst.number}/{installmentsPreview.length} - {format(inst.dueDate, 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <span className="font-medium">{formatCurrency(inst.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />
            </>
          )}

          {/* Final Summary */}
          <div className="rounded-lg border-2 border-primary/30 overflow-hidden">
            <div className="bg-primary/10 px-4 py-2 border-b border-primary/20">
              <span className="text-sm font-medium">Resumo da Aprovação</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor total do serviço</span>
                <span className="font-bold">{formatCurrency(totalAmount)}</span>
              </div>
              
              <div className={cn(
                "flex justify-between items-center p-2 rounded-lg",
                hasEntry ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-muted/30"
              )}>
                <span className={cn("text-sm", hasEntry ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
                  Entrada a receber agora
                </span>
                <span className={cn("font-bold", hasEntry ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {hasEntry ? formatCurrency(entryValue) : 'Sem entrada'}
                </span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Saldo a receber</span>
                <Badge 
                  variant={pendingAmount > 0 ? 'secondary' : 'default'} 
                  className={cn(
                    "text-base px-3 py-1",
                    pendingAmount === 0 && "bg-emerald-500"
                  )}
                >
                  {formatCurrency(pendingAmount)}
                </Badge>
              </div>
              
              {pendingAmount > 0 && installmentsCount > 1 && (
                <div className="flex justify-between text-xs text-muted-foreground bg-muted/30 rounded p-2">
                  <span>Parcelamento</span>
                  <span className="font-medium">{installmentsCount}x de {formatCurrency(pendingAmount / installmentsCount)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || (hasEntry && !isCaixaAberto)}
            className="gap-2"
          >
            {approveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Aprovar e Criar OS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
