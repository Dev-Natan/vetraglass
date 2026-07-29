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
  const [partyType, setPartyType] = useState<'none' | 'cliente' | 'fornecedor' | 'funcionario'>('none');
  const [partyId, setPartyId] = useState<string>('');

  const categories = type === 'entrada' ? entradaCategories : saidaCategories;

  // Entidades vinculáveis (clientes, fornecedores ou funcionários)
  const { data: parties = [] } = useQuery({
    queryKey: ['movement-parties', currentCompany?.id, partyType],
    queryFn: async () => {
      if (!currentCompany?.id || partyType === 'none') return [] as { id: string; name: string }[];
      const table = partyType === 'cliente' ? 'clients' : partyType === 'fornecedor' ? 'suppliers' : 'employees';
      const { data, error } = await (supabase as any)
        .from(table)
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!currentCompany?.id && open && partyType !== 'none',
  });

  const selectedParty = parties.find((p) => p.id === partyId);
  const partyLabels: Record<string, string> = {
    cliente: 'Cliente',
    fornecedor: 'Fornecedor',
    funcionario: 'Funcionário',
  };

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
  };

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
        
        return result;
      }

      // Entrada normal
      const { data, error } = await supabase
        .from('cash_movements')
        .insert({
          company_id: currentCompany.id,
          cash_register_id: cashRegisterId,
          type,
          category,
          amount: amountValue,
          description: description.trim(),
          payment_method: paymentMethod,
          created_by: user.id,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentação de Caixa</DialogTitle>
          <DialogDescription>
            Registre entradas ou saídas avulsas do caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Saldo atual do caixa do dia */}
          <div className="bg-muted/50 rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Saldo atual do caixa</span>
            <span className="font-semibold">{formatCurrency(currentDailyBalance)}</span>
          </div>

          {/* Type Selection */}
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
              className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                type === 'entrada' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted hover:border-green-300'
              }`}
            >
              <RadioGroupItem value="entrada" id="type-entrada" className="sr-only" />
              <ArrowUpCircle className={`w-5 h-5 ${type === 'entrada' ? 'text-green-600' : 'text-muted-foreground'}`} />
              <span className={`font-medium ${type === 'entrada' ? 'text-green-700 dark:text-green-400' : ''}`}>
                Entrada
              </span>
            </Label>

            <Label
              htmlFor="type-saida"
              className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                type === 'saida' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-muted hover:border-red-300'
              }`}
            >
              <RadioGroupItem value="saida" id="type-saida" className="sr-only" />
              <ArrowDownCircle className={`w-5 h-5 ${type === 'saida' ? 'text-red-600' : 'text-muted-foreground'}`} />
              <span className={`font-medium ${type === 'saida' ? 'text-red-700 dark:text-red-400' : ''}`}>
                Saída
              </span>
            </Label>
          </RadioGroup>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
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

          {/* Amount */}
          <div className="space-y-2">
            <Label>Valor</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 text-lg"
              />
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

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Forma</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="flex gap-3"
            >
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <Label
                    key={method.value}
                    htmlFor={`method-${method.value}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                      paymentMethod === method.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value={method.value} id={`method-${method.value}`} className="sr-only" />
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{method.label}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descreva a movimentação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Preview */}
          {amountValue > 0 && (
            <div className={`rounded-lg p-4 ${
              type === 'entrada' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            } border`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {type === 'entrada' ? 'Entrada no caixa' : 'Saída do caixa'}
                </span>
                <span className={`text-lg font-bold ${type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  {type === 'entrada' ? '+' : '-'}{formatCurrency(amountValue)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
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
            className={type === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : needsReinforcement ? (
              'Confirmar com Reforço'
            ) : (
              `Registrar ${type === 'entrada' ? 'Entrada' : 'Saída'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
