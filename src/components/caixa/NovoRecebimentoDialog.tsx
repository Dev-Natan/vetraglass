import { useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign, CreditCard, Smartphone, Receipt, User, CheckCircle2,
  AlertCircle, Loader2, History, FileDown,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseBRLInput, formatBRLInput } from '@/utils/currencyMask';
import { ExtratoRecebimentos } from './ExtratoRecebimentos';
import { elementToPdfBlob } from '@/utils/printableToPdf';

export interface PartialSaleTarget {
  id: string;                    // sale.id
  sale_number?: number | null;
  customer_name: string | null;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  quote_id?: string | null;
  ordem_servico_id?: string | null;
  os_number?: number | null;
  client_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: PartialSaleTarget | null;
  onSuccess?: () => void;
}

type PayMethod = 'dinheiro' | 'cartao' | 'pix';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const methodLabel: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao: 'CartÃ£o', pix: 'PIX',
};

export function NovoRecebimentoDialog({ open, onOpenChange, sale, onSuccess }: Props) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('dinheiro');
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data: openCashRegister, isLoading: loadingCash } = useQuery({
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

  // HistÃ³rico de recebimentos vinculados a esta venda
  const { data: history } = useQuery({
    queryKey: ['sale-receipts-history', sale?.id],
    queryFn: async () => {
      if (!sale?.id) return [];
      const { data, error } = await supabase
        .from('cash_movements')
        .select('id, amount, payment_method, description, created_at, type')
        .or(`sale_id.eq.${sale.id}${sale.quote_id ? `,quote_id.eq.${sale.quote_id}` : ''}`)
        .eq('type', 'entrada')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sale?.id && open,
  });

  // Dados do orÃ§amento vinculado (para extrato)
  const { data: linkedQuote } = useQuery({
    queryKey: ['quote-for-receipt', sale?.quote_id],
    queryFn: async () => {
      if (!sale?.quote_id) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, final_amount, created_at')
        .eq('id', sale.quote_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sale?.quote_id && open,
  });

  const remaining = Math.max(0, Number((sale?.pending_amount ?? 0).toFixed(2)));
  const amountToReceive = useMemo(() => {
    const v = parseBRLInput(paymentAmount);
    return Math.min(Math.max(0, v), remaining);
  }, [paymentAmount, remaining]);

  const suggestFull = () => setPaymentAmount(formatBRLInput(remaining));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sale || !currentCompany?.id || !user?.id) throw new Error('Dados incompletos');
      if (!openCashRegister?.id) throw new Error('Nenhum caixa aberto. Abra o caixa para receber.');
      if (amountToReceive <= 0) throw new Error('Informe um valor maior que zero');
      if (amountToReceive > remaining + 0.001) throw new Error('Valor maior que o saldo restante');

      const { data, error } = await supabase.rpc('receive_sale_payment_transactional', {
        _sale_id: sale.id,
        _amount: amountToReceive,
        _payment_method: paymentMethod,
        _cash_register_id: openCashRegister.id,
        _operation_key: crypto.randomUUID(),
      });
      if (error) throw error;
      const result = data as { success?: boolean; status?: string } | null;
      if (!result?.success) throw new Error('O recebimento transacional nÃ£o foi confirmado');
      return { amount: amountToReceive, fullyPaid: result.status === 'paid' };
    },
    onSuccess: (res) => {
      toast.success(res.fullyPaid ? 'Venda quitada!' : 'Recebimento parcial registrado', {
        description: `${formatCurrency(res.amount)} adicionado ao caixa (${methodLabel[paymentMethod]})`,
      });
      
      // Invalida todas as queries relacionadas para atualizar UI em tempo real
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['sale-receipts-history'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-sales-financials'] });
      queryClient.invalidateQueries({ queryKey: ['quote-financial-movements'] });
      queryClient.invalidateQueries({ queryKey: ['quote-receivables'] });
      queryClient.invalidateQueries({ queryKey: ['quote-all-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['quote-entry-sale'] });
      queryClient.invalidateQueries({ queryKey: ['quote-previously-paid'] });
      queryClient.invalidateQueries({ queryKey: ['approved-quotes-paid-map'] });
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] });
      
      setPaymentAmount('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      toast.error('Erro ao registrar recebimento', {
        description: err instanceof Error ? err.message : 'Tente novamente',
      });
    },
  });

  const [downloadingExtrato, setDownloadingExtrato] = useState(false);

  const handleDownloadExtrato = async () => {
    if (!sale) return;
    setDownloadingExtrato(true);
    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      const root = createRoot(container);
      root.render(
        <ExtratoRecebimentos
          clientName={sale.customer_name || 'Cliente'}
          company={currentCompany}
          saleNumber={sale.sale_number}
          quoteNumber={linkedQuote?.quote_number}
          totalAmount={Number(linkedQuote?.final_amount ?? sale.total_amount)}
          paidAmount={Number(sale.paid_amount)}
          pendingAmount={Number(sale.pending_amount)}
          saleStatus={sale.pending_amount <= 0.01 ? 'paid' : sale.paid_amount > 0 ? 'partial' : 'pending'}
          saleType='partial'
          createdAt={linkedQuote?.created_at || new Date().toISOString()}
          payments={(history || []).map(h => ({
            id: h.id,
            amount: Number(h.amount) || 0,
            payment_method: h.payment_method,
            description: h.description,
            created_at: h.created_at,
          }))}
        />,
      );

      await new Promise(resolve => setTimeout(resolve, 300));
      const blob = await elementToPdfBlob(container);
      root.unmount();
      container.remove();

      const ref = sale.sale_number
        ? `venda_${String(sale.sale_number).padStart(4, '0')}`
        : `orc_${String(linkedQuote?.quote_number ?? 0).padStart(4, '0')}`;
      const safeName = (sale.customer_name || 'cliente').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extrato_${safeName}_${ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Extrato de recebimentos baixado');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao gerar extrato');
    } finally {
      setDownloadingExtrato(false);
    }
  };

  if (!sale) return null;
  const isCaixaAberto = !!openCashRegister?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[92vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Novo Recebimento</DialogTitle>
              <DialogDescription className="text-xs">
                Registre um recebimento parcial para esta venda
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {sale.customer_name || 'Consumidor'}
              </p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                {sale.sale_number
                  ? `Venda #${String(sale.sale_number).padStart(4, '0')}`
                  : sale.os_number
                  ? `OS #${String(sale.os_number).padStart(4, '0')}`
                  : 'Venda'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total</p>
              <p className="text-sm font-semibold">{formatCurrency(Number(sale.total_amount))}</p>
            </div>
            <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
              <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 mb-1">JÃ¡ recebido</p>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(Number(sale.paid_amount))}
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
              <p className="text-[10px] uppercase font-bold text-primary mb-1">Restante</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(Number(remaining))}</p>
            </div>
          </div>

          {history && history.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                <History className="h-3.5 w-3.5" /> HistÃ³rico de recebimentos
              </div>
              <ScrollArea className="max-h-32 rounded-lg border">
                <div className="divide-y">
                  {history.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {format(new Date(m.created_at), "dd/MM/yyyy 'Ã s' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-muted-foreground truncate">
                          {methodLabel[m.payment_method] || m.payment_method || 'â€”'}
                        </p>
                      </div>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                        + {formatCurrency(Number(m.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {!isCaixaAberto && !loadingCash && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Abra o caixa para registrar recebimentos.</AlertDescription>
            </Alert>
          )}

          {isCaixaAberto && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                    Valor deste recebimento
                  </Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={suggestFull}>
                    Usar saldo total ({formatCurrency(remaining)})
                  </Button>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(formatBRLInput(parseBRLInput(e.target.value)))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Forma de pagamento
                </Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PayMethod)}
                  className="grid grid-cols-3 gap-2"
                >
                  {[
                    { value: 'dinheiro', label: 'Dinheiro', Icon: DollarSign },
                    { value: 'cartao', label: 'CartÃ£o', Icon: CreditCard },
                    { value: 'pix', label: 'PIX', Icon: Smartphone },
                  ].map(({ value, label, Icon }) => {
                    const selected = paymentMethod === value;
                    return (
                      <Label
                        key={value}
                        htmlFor={`nr-${value}`}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        <RadioGroupItem value={value} id={`nr-${value}`} className="sr-only" />
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase">{label}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-foreground text-background">
                <span className="text-sm opacity-70">Novo saldo apÃ³s recebimento</span>
                <span className="text-xl font-bold">
                  {formatCurrency(Math.max(0, remaining - amountToReceive))}
                </span>
              </div>

              {amountToReceive > 0 && amountToReceive >= remaining && (
                <Alert className="border-emerald-500/40 bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                    Este recebimento irÃ¡ <strong>quitar</strong> a venda.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t gap-2 flex-row flex-wrap">
          <Button
            variant="outline"
            className="flex-1 min-w-[120px]"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            className="flex-1 min-w-[140px] gap-2"
            onClick={handleDownloadExtrato}
            disabled={downloadingExtrato || !history?.length}
          >
            {downloadingExtrato ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
            ) : (
              <><FileDown className="h-4 w-4" /> Extrato</>
            )}
          </Button>
          <Button
            className="flex-1 min-w-[160px]"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isCaixaAberto || amountToReceive <= 0}
          >
            {mutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
            ) : (
              <>Registrar Recebimento</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
