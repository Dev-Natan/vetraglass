import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DollarSign, CreditCard, Smartphone, Receipt, User, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface QuoteDeposit {
  id: string;
  quote_id: string;
  ordem_servico_id: string | null;
  client_id?: string | null;
  customer_name: string;
  customer_phone: string | null;
  amount: number;
  status: string;
  quotes?: {
    quote_number: number;
  };
  ordens_servico?: {
    os_number: number;
  };
}

interface ReceberEntradaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deposit: QuoteDeposit;
  cashRegisterId: string;
  onSuccess: () => void;
}

export function ReceberEntradaDialog({
  open,
  onOpenChange,
  deposit,
  cashRegisterId,
  onSuccess,
}: ReceberEntradaDialogProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const receberMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuário não encontrado');
      }

      const { data, error } = await supabase.rpc('receive_quote_deposit_transactional', {
        _deposit_id: deposit.id,
        _payment_method: paymentMethod,
        _cash_register_id: cashRegisterId,
        _operation_key: crypto.randomUUID(),
      });
      if (error) throw error;
      const result = data as { success?: boolean; movement_id?: string } | null;
      if (!result?.success) throw new Error('A entrada transacional não foi confirmada');
      return result;
    },
    onSuccess: () => {
      toast.success('Entrada recebida com sucesso!', {
        description: `${formatCurrency(Number(deposit.amount))} adicionado ao caixa`,
      });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-sales-financials'] });
      queryClient.invalidateQueries({ queryKey: ['quote-financial-movements'] });
      queryClient.invalidateQueries({ queryKey: ['quote-all-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['quote-previously-paid'] });
      queryClient.invalidateQueries({ queryKey: ['approved-quotes-paid-map'] });
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] });
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao receber entrada:', error);
      toast.error('Erro ao receber entrada', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  const handleConfirm = () => {
    receberMutation.mutate();
  };

  const osNumber = deposit.ordens_servico?.os_number;
  const quoteNumber = deposit.quotes?.quote_number;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receber Entrada de Orçamento
          </DialogTitle>
          <DialogDescription>
            Confirme o recebimento da entrada no caixa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do Cliente */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{deposit.customer_name}</p>
              {deposit.customer_phone && (
                <p className="text-sm text-muted-foreground">{deposit.customer_phone}</p>
              )}
            </div>
          </div>

          {/* Info do Orçamento/OS */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {osNumber 
                  ? `OS #${String(osNumber).padStart(4, '0')}`
                  : `Orçamento #${String(quoteNumber || 0).padStart(4, '0')}`
                }
              </p>
              <p className="text-sm text-muted-foreground">Entrada pendente</p>
            </div>
          </div>

          {/* Valor */}
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
            <span className="text-sm font-medium">Valor da Entrada</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(Number(deposit.amount))}
            </span>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <Label className="text-sm font-medium">Forma de Pagamento</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dinheiro" id="rec-dinheiro" />
                <Label htmlFor="rec-dinheiro" className="flex items-center gap-1 cursor-pointer">
                  <DollarSign className="w-4 h-4" />
                  Dinheiro
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cartao" id="rec-cartao" />
                <Label htmlFor="rec-cartao" className="flex items-center gap-1 cursor-pointer">
                  <CreditCard className="w-4 h-4" />
                  Cartão
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pix" id="rec-pix" />
                <Label htmlFor="rec-pix" className="flex items-center gap-1 cursor-pointer">
                  <Smartphone className="w-4 h-4" />
                  Pix
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={receberMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={receberMutation.isPending}
          >
            {receberMutation.isPending ? 'Processando...' : 'Confirmar Recebimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
