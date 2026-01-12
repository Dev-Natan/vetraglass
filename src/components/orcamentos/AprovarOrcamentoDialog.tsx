import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
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
  CheckCircle, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  ClipboardList,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !currentCompany?.id || !user?.id) {
        throw new Error('Dados incompletos');
      }

      // If there's an entry and cash is not open, error
      if (hasEntry && !isCaixaAberto) {
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
          total_amount: totalAmount,
          paid_amount: entryValue,
          pending_amount: pendingAmount,
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
      if (hasEntry && openCashRegister) {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            company_id: currentCompany.id,
            cash_register_id: openCashRegister.id,
            customer_name: quote.customer_name,
            subtotal: entryValue,
            total_amount: entryValue,
            payment_method: paymentMethod,
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

        // Create sale item for the entry (just informational, no stock deduction)
        await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            item_name: `Entrada - Orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
            item_unit: 'un',
            quantity: 1,
            unit_price: entryValue,
            total_price: entryValue,
            notes: `Entrada parcial referente ao orçamento #${quote.quote_number}`,
          });

        // Update OS with sale_id
        await supabase
          .from('ordens_servico')
          .update({ sale_id: sale.id })
          .eq('id', ordemServico.id);
      }

      // 3. Update quote status to approved
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ status: 'approved' })
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      return { ordemServico, saleId };
    },
    onSuccess: (data) => {
      const osNumber = data.ordemServico.os_number;
      toast({
        title: 'Orçamento aprovado!',
        description: hasEntry
          ? `OS #${osNumber} criada. Entrada de ${formatCurrency(entryValue)} registrada.`
          : `OS #${osNumber} criada. Valor pendente: ${formatCurrency(pendingAmount)}`,
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
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
          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor do orçamento</span>
              <span className="font-bold text-lg">{formatCurrency(totalAmount)}</span>
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

          {/* Final Summary */}
          <div className="bg-primary/5 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Valor total</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Entrada</span>
              <span>{hasEntry ? formatCurrency(entryValue) : '-'}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Valor pendente</span>
              <Badge variant={pendingAmount > 0 ? 'secondary' : 'default'}>
                {formatCurrency(pendingAmount)}
              </Badge>
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
