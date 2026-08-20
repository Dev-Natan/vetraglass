import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DollarSign, CreditCard, Smartphone, Receipt, User, CheckCircle2, AlertCircle, ArrowRight, ClipboardList } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface OrdemServico {
  id: string;
  os_number: number;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  quote_id: string | null;
  status?: string;
}

interface FaturarSaldoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServico: OrdemServico;
  onSuccess: () => void;
}

export function FaturarSaldoDialog({
  open,
  onOpenChange,
  ordemServico,
  onSuccess,
}: FaturarSaldoDialogProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');

  // Buscar caixa aberto
  const { data: openCashRegister } = useQuery({
    queryKey: ['cash-register-open', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('cash_registers')
        .select('id, status')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && open,
  });

  // FLUXO CORRIGIDO: Buscar TODAS as entradas jÃ¡ pagas do orÃ§amento
  const { data: allDeposits, isLoading: isLoadingDeposits } = useQuery({
    queryKey: ['quote-all-deposits', ordemServico.quote_id],
    queryFn: async () => {
      if (!ordemServico.quote_id) return { deposits: [], totalReceived: 0 };
      
      // Buscar todos os depÃ³sitos recebidos
      const { data: deposits, error: depositsError } = await supabase
        .from('quote_deposits')
        .select('id, amount, status, received_at, payment_method')
        .eq('quote_id', ordemServico.quote_id)
        .in('status', ['received', 'pending']);
      
      if (depositsError) throw depositsError;

      // A aprovaÃ§Ã£o jÃ¡ cria a venda canÃ´nica; o faturamento apenas quita seu saldo.
      const { data: canonicalSale, error: salesError } = await supabase
        .from('sales')
        .select('id, total_amount, paid_amount, pending_amount, payment_status')
        .eq('ordem_servico_id', ordemServico.id)
        .neq('payment_status', 'cancelled')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (salesError) console.warn('Erro ao buscar vendas parciais:', salesError);

      // Calcular total recebido via depÃ³sitos
      const depositsReceived = (deposits || [])
        .filter(d => d.status === 'received')
        .reduce((sum, d) => sum + Number(d.amount), 0);

      // Total efetivamente recebido: depÃ³sitos sÃ£o a fonte canÃ´nica
      // NÃ£o usar Math.max pois pode ignorar entradas adicionais
      const totalReceived = depositsReceived;
      
      return {
        deposits: deposits || [],
        canonicalSale,
        totalReceived,
        depositsReceived,
      };
    },
    enabled: !!ordemServico.quote_id && open,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const faturarMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuÃ¡rio nÃ£o encontrado');
      }

      if (!openCashRegister?.id) {
        throw new Error('Nenhum caixa aberto. Abra o caixa para faturar.');
      }

      const entradaJaRecebida = allDeposits?.totalReceived || 0;
      const totalOrcamento = ordemServico.total_amount;
      const sale = allDeposits?.canonicalSale;
      if (!sale?.id) {
        throw new Error('Venda canÃ´nica da OS nÃ£o encontrada. Reprocesse a aprovaÃ§Ã£o do orÃ§amento.');
      }
      const saldoRestante = Math.max(0, Number(sale.pending_amount ?? ordemServico.pending_amount));

      if (saldoRestante > 0) {
        const { data, error } = await supabase.rpc('receive_sale_payment_transactional', {
          _sale_id: sale.id,
          _amount: saldoRestante,
          _payment_method: paymentMethod,
          _cash_register_id: openCashRegister.id,
          _operation_key: crypto.randomUUID(),
        });
        if (error) throw error;
        const result = data as { success?: boolean } | null;
        if (!result?.success) throw new Error('O faturamento transacional nÃ£o foi confirmado');
      }

      return { 
        saleId: sale.id,
        entradaJaRecebida, 
        saldoFaturado: saldoRestante,
        totalFaturado: totalOrcamento,
      };
    },
    onSuccess: (data) => {
      const mensagem = data.entradaJaRecebida > 0
        ? `Entrada de ${formatCurrency(data.entradaJaRecebida)} reconhecida. Saldo de ${formatCurrency(data.saldoFaturado)} faturado.`
        : `Venda de ${formatCurrency(data.totalFaturado)} registrada`;

      toast.success('ServiÃ§o faturado e concluÃ­do!', {
        description: mensagem,
      });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      onSuccess();
    },
    onError: (error) => {
      console.error('Erro ao faturar saldo:', error);
      toast.error('Erro ao faturar saldo', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  const handleConfirm = () => {
    faturarMutation.mutate();
  };

  const isCaixaAberto = !!openCashRegister?.id;
  const entradaRecebida = allDeposits?.totalReceived || 0;
  const totalOrcamento = ordemServico.total_amount;
  const saldoRestante = Math.max(
    0,
    Number(allDeposits?.canonicalSale?.pending_amount ?? ordemServico.pending_amount),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Faturar Saldo - OS #{String(ordemServico.os_number).padStart(4, '0')}
          </DialogTitle>
          <DialogDescription>
            Finalize o faturamento do serviÃ§o concluÃ­do
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Badge de OS ConcluÃ­da */}
          <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <ClipboardList className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-400 font-medium">ServiÃ§o ConcluÃ­do</span>
            <Badge variant="outline" className="ml-auto text-green-600 border-green-300">Pronto para Faturar</Badge>
          </div>

          {/* Info do Cliente */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">{ordemServico.customer_name}</p>
          </div>

          {/* Resumo Financeiro Detalhado */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor total do orÃ§amento:</span>
              <span className="font-medium">{formatCurrency(totalOrcamento)}</span>
            </div>
            
            {entradaRecebida > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Entrada(s) jÃ¡ recebida(s):
                </span>
                <span className="font-medium text-green-600">
                  - {formatCurrency(entradaRecebida)}
                </span>
              </div>
            )}
            
            <Separator className="my-2" />
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Saldo a faturar agora:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(saldoRestante)}
              </span>
            </div>

            {entradaRecebida > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs text-green-700 dark:text-green-400">
                <ArrowRight className="h-3 w-3" />
                As entradas anteriores serÃ£o vinculadas automaticamente a esta venda
              </div>
            )}
          </div>

          {/* Alerta se caixa fechado */}
          {!isCaixaAberto && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum caixa aberto. Abra o caixa para faturar o saldo.
              </AlertDescription>
            </Alert>
          )}

          {/* Forma de Pagamento (apenas se hÃ¡ saldo) */}
          {isCaixaAberto && saldoRestante > 0 && (
            <div>
              <Label className="text-sm font-medium">Forma de Pagamento do Saldo</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dinheiro" id="fat-dinheiro" />
                  <Label htmlFor="fat-dinheiro" className="flex items-center gap-1 cursor-pointer">
                    <DollarSign className="w-4 h-4" />
                    Dinheiro
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cartao" id="fat-cartao" />
                  <Label htmlFor="fat-cartao" className="flex items-center gap-1 cursor-pointer">
                    <CreditCard className="w-4 h-4" />
                    CartÃ£o
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pix" id="fat-pix" />
                  <Label htmlFor="fat-pix" className="flex items-center gap-1 cursor-pointer">
                    <Smartphone className="w-4 h-4" />
                    Pix
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Caso nÃ£o haja saldo (jÃ¡ estÃ¡ tudo pago) */}
          {isCaixaAberto && saldoRestante === 0 && entradaRecebida >= totalOrcamento && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                O valor total jÃ¡ foi recebido via entradas. Clique em "Faturar" para finalizar.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={faturarMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={faturarMutation.isPending || !isCaixaAberto || isLoadingDeposits}
          >
            {faturarMutation.isPending ? 'Processando...' : 'Faturar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
