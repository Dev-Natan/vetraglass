import { parseCurrencyBRL } from '@/utils/currencyMask';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Loader2,
  DollarSign,
  Smartphone,
  Banknote,
  AlertTriangle,
  ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';

type MovementType = 'entrada' | 'saida';
type PaymentMethod = 'dinheiro' | 'pix' | 'transferencia';

interface MovimentacaoCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashRegisterId: string;
  currentDailyBalance?: number;
}

const entradaCategories = [
  { value: 'recebimento_parcela', label: 'Recebimento de Parcela' },
  { value: 'reforco', label: 'Reforço de Caixa' },
  { value: 'ajuste_positivo', label: 'Ajuste Positivo' },
  { value: 'outros_entrada', label: 'Outros' },
];

const saidaCategories = [
  { value: 'sangria', label: 'Sangria (Envio ao Banco)' },
  { value: 'pagamento_fornecedor', label: 'Pagamento de Fornecedor' },
  { value: 'pagamento_despesa', label: 'Pagamento de Despesa' },
  { value: 'compra_material', label: 'Compra de Material' },
  { value: 'retirada_socio', label: 'Retirada do Sócio' },
  { value: 'vale_funcionario', label: 'Vale Funcionário' },
  { value: 'ajuste_negativo', label: 'Ajuste Negativo' },
  { value: 'outros_saida', label: 'Outros' },
];

const paymentMethods = [
  { value: 'dinheiro', label: 'Dinheiro', icon: DollarSign },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'transferencia', label: 'Transferência', icon: Banknote },
];

export function MovimentacaoCaixaDialog({
  open,
  onOpenChange,
  cashRegisterId,
  currentDailyBalance = 0,
}: MovimentacaoCaixaDialogProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [type, setType] = useState<MovementType>('entrada');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [clienteId, setClienteId] = useState<string>('none');
  const [fornecedorId, setFornecedorId] = useState<string>('none');
  const [funcionarioId, setFuncionarioId] = useState<string>('none');
  const [quoteId, setQuoteId] = useState<string>('none');

  const categories = type === 'entrada' ? entradaCategories : saidaCategories;

  // Listas independentes para vinculação múltipla
  const { data: clientes = [] } = useQuery({
    queryKey: ['movement-clientes', currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', currentCompany!.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!currentCompany?.id && open,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['movement-fornecedores', currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('clients')
        .select('id, name')
        .eq('company_id', currentCompany!.id)
        .eq('client_type', 'fornecedor')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!currentCompany?.id && open,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['movement-funcionarios', currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .eq('company_id', currentCompany!.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!currentCompany?.id && open,
  });

  // Buscar orçamentos ativos/aprovados do cliente selecionado
  const { data: orçamentos = [] } = useQuery({
    queryKey: ['movement-quote-options', clienteId],
    queryFn: async () => {
      if (clienteId === 'none') return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status')
        .eq('client_id', clienteId)
        .in('status', ['pending', 'sent', 'approved', 'partial', 'completed'])
        .order('quote_number', { ascending: false });
      if (error) throw error;
      return (data || []) as { id: string; quote_number: number; status: string }[];
    },
    enabled: clienteId !== 'none' && open,
  });

  // Buscar saldo do caixa da empresa
  const { data: companyCash } = useQuery({
    queryKey: ['company-cash', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('company_cash')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && open,
  });

  const amountValue = parseCurrencyBRL(amount);
  const needsReinforcement = type === 'saida' && amountValue > currentDailyBalance;
  const reinforcementAmount = needsReinforcement ? amountValue - currentDailyBalance : 0;
  const hasEnoughCompanyBalance = !needsReinforcement || (companyCash?.current_balance || 0) >= reinforcementAmount;

  const resetForm = () => {
    setType('entrada');
    setCategory('');
    setAmount('');
    setDescription('');
    setPaymentMethod('dinheiro');
    setClienteId('none');
    setFornecedorId('none');
    setFuncionarioId('none');
    setQuoteId('none');
  };

  const clienteSelected = clientes.find((c) => c.id === clienteId);
  const fornecedorSelected = fornecedores.find((f: any) => f.id === fornecedorId);
  const funcionarioSelected = funcionarios.find((e) => e.id === funcionarioId);

  // Mutation com suporte a reforço automático
  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Dados inválidos');
      }

      if (amountValue <= 0) {
        throw new Error('Valor inválido');
      }

      if (!category) {
        throw new Error('Selecione uma categoria');
      }

      if (!description.trim()) {
        throw new Error('Informe uma descrição');
      }

      // Vínculos independentes (podem existir 0 ou mais simultaneamente)
      const linkFields: Record<string, string | null> = {
        cliente_id: clienteId !== 'none' ? clienteId : null,
        fornecedor_id: fornecedorId !== 'none' ? fornecedorId : null,
        funcionario_id: funcionarioId !== 'none' ? funcionarioId : null,
        quote_id: quoteId !== 'none' ? quoteId : null,
      };

      // Manter compat com colunas legadas party_* usando o primeiro vínculo (prioridade fornecedor > cliente > funcionário)
      const legacyParty = fornecedorSelected
        ? { party_type: 'fornecedor', party_id: fornecedorSelected.id, party_name: (fornecedorSelected as any).name }
        : clienteSelected
        ? { party_type: 'cliente', party_id: clienteSelected.id, party_name: clienteSelected.name }
        : funcionarioSelected
        ? { party_type: 'funcionario', party_id: funcionarioSelected.id, party_name: funcionarioSelected.name }
        : { party_type: null as string | null, party_id: null as string | null, party_name: null as string | null };

      const partyFields = { ...linkFields, ...legacyParty };
      const hasAnyLink = !!(linkFields.cliente_id || linkFields.fornecedor_id || linkFields.funcionario_id);

      // Se é saída e precisa de reforço, usar a função com reforço automático
      if (type === 'saida') {
        const { data, error } = await supabase.rpc('register_cash_exit_with_reinforcement', {
          _cash_register_id: cashRegisterId,
          _amount: amountValue,
          _category: category,
          _description: description.trim(),
          _payment_method: paymentMethod,
        });

        if (error) throw error;

        const result = data as {
          success: boolean;
          error?: string;
          movement_id?: string;
          reinforcement?: {
            reinforcement_needed: boolean;
            reinforcement_amount?: number;
          };
          message?: string;
        };

        if (!result.success) {
          throw new Error(result.error || 'Erro ao registrar saída');
        }

        if (result.movement_id && hasAnyLink) {
          await (supabase.from('cash_movements') as any)
            .update(partyFields)
            .eq('id', result.movement_id);
        }

        return result;
      }

      // Entrada normal
      const { data, error } = await (supabase.from('cash_movements') as any)
        .insert({
          company_id: currentCompany.id,
          cash_register_id: cashRegisterId,
          type,
          category,
          amount: amountValue,
          description: description.trim(),
          payment_method: paymentMethod,
          created_by: user.id,
          ...partyFields,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    },
    onSuccess: (result) => {
      const hasReinforcement = result && 'reinforcement' in result && result.reinforcement?.reinforcement_needed;
      
      if (hasReinforcement && result.reinforcement) {
        toast.success(
          `Saída registrada com reforço automático de R$ ${result.reinforcement.reinforcement_amount?.toFixed(2)}`,
          { duration: 5000 }
        );
      } else {
        toast.success(`${type === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      queryClient.invalidateQueries({ queryKey: ['pending-advances'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    mutation.mutate();
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!mutation.isPending) {
        if (!o) resetForm();
        onOpenChange(o);
      }
    }}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">Nova Movimentação</DialogTitle>
          <DialogDescription>
            Registre entradas ou saídas avulsas do caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 px-1 flex-1 min-h-0 overflow-y-auto pr-2 pb-24 max-h-[60vh]">
          {/* Saldo atual do caixa do dia */}
          <div className="bg-muted/50 rounded-xl px-4 py-3 flex justify-between items-center border">
            <span className="text-sm text-muted-foreground">Saldo atual do caixa</span>
            <span className="font-semibold">{formatCurrency(currentDailyBalance)}</span>
          </div>

          {/* Type Selection — Toggle Tabs */}
          <RadioGroup
            value={type}
            onValueChange={(v) => {
              setType(v as MovementType);
              setCategory('');
            }}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="type-entrada"
              className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 cursor-pointer transition-all ${
                type === 'entrada'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm'
                  : 'border-muted bg-background hover:border-emerald-300'
              }`}
            >
              <RadioGroupItem value="entrada" id="type-entrada" className="sr-only" />
              <ArrowUpCircle className={`w-5 h-5 ${type === 'entrada' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              <span className={`font-semibold ${type === 'entrada' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                Entrada
              </span>
            </Label>

            <Label
              htmlFor="type-saida"
              className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 cursor-pointer transition-all ${
                type === 'saida'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 shadow-sm'
                  : 'border-muted bg-background hover:border-rose-300'
              }`}
            >
              <RadioGroupItem value="saida" id="type-saida" className="sr-only" />
              <ArrowDownCircle className={`w-5 h-5 ${type === 'saida' ? 'text-rose-600' : 'text-muted-foreground'}`} />
              <span className={`font-semibold ${type === 'saida' ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground'}`}>
                Saída
              </span>
            </Label>
          </RadioGroup>

          {/* Category + Amount — same row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10 text-lg rounded-lg font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Alerta de Reforço Automático */}
          {needsReinforcement && (
            <Alert variant={hasEnoughCompanyBalance ? "default" : "destructive"}>
              <ArrowRightLeft className="h-4 w-4" />
              <AlertTitle>
                {hasEnoughCompanyBalance ? 'Reforço Automático' : 'Saldo Insuficiente'}
              </AlertTitle>
              <AlertDescription>
                {hasEnoughCompanyBalance ? (
                  <div className="space-y-2 text-sm">
                    <p>O saldo do caixa é insuficiente. O sistema transferirá automaticamente:</p>
                    <div className="bg-background/50 rounded p-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Saldo atual do dia:</span>
                        <span>{formatCurrency(currentDailyBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor da saída:</span>
                        <span className="text-red-600">{formatCurrency(amountValue)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Reforço necessário:</span>
                        <span className="text-amber-600">{formatCurrency(reinforcementAmount)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs pt-1">
                      <span>Saldo empresa atual:</span>
                      <span>{formatCurrency(companyCash?.current_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Saldo empresa após:</span>
                      <span>{formatCurrency((companyCash?.current_balance || 0) - reinforcementAmount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p>Saldo insuficiente no caixa da empresa.</p>
                    <div className="flex justify-between">
                      <span>Disponível:</span>
                      <span>{formatCurrency(companyCash?.current_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Necessário:</span>
                      <span>{formatCurrency(reinforcementAmount)}</span>
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Method — Modern cards */}
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid grid-cols-3 gap-3"
            >
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const selected = paymentMethod === method.value;
                return (
                  <Label
                    key={method.value}
                    htmlFor={`method-${method.value}`}
                    className={`flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-muted bg-background hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    <RadioGroupItem value={method.value} id={`method-${method.value}`} className="sr-only" />
                    <Icon className={`w-5 h-5 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm ${selected ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                      {method.label}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Ex.: Pagamento de fornecedor referente à NF 1234..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-lg resize-none min-h-[84px]"
            />
          </div>

          {/* Vincular a — múltiplos envolvidos independentes */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Vínculos da Movimentação
              </h4>
              <span className="text-xs text-muted-foreground">opcional</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="rounded-lg bg-background">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger className="rounded-lg bg-background">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {fornecedores.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum fornecedor cadastrado.</div>
                    ) : (
                      fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Funcionário</Label>
                <Select value={funcionarioId} onValueChange={setFuncionarioId}>
                  <SelectTrigger className="rounded-lg bg-background">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {funcionarios.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {clienteId !== 'none' && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Vincular a Orçamento</Label>
                <Select value={quoteId} onValueChange={setQuoteId}>
                  <SelectTrigger className="rounded-lg bg-background w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {orçamentos.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        Orçamento #{q.quote_number} ({q.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>



          {/* Preview */}
          {amountValue > 0 && (
            <div className={`rounded-xl p-4 border ${
              type === 'entrada'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {type === 'entrada' ? 'Entrada no caixa' : 'Saída do caixa'}
                </span>
                <span className={`text-lg font-bold ${type === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {type === 'entrada' ? '+' : '-'}{formatCurrency(amountValue)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2 border-t sticky bottom-0 bg-background z-10 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            className="rounded-full px-6"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              mutation.isPending ||
              !category ||
              !amount ||
              !description.trim() ||
              (needsReinforcement && !hasEnoughCompanyBalance)
            }
            className="rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : needsReinforcement ? (
              'Confirmar com Reforço'
            ) : (
              `Confirmar ${type === 'entrada' ? 'Entrada' : 'Saída'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
