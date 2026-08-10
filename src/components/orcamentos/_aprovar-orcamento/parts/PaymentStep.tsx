import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Calendar as CalendarIcon, AlertCircle, Loader2,
  ClipboardList, Receipt, Wallet, Settings2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, parseAmount } from '../utils';
import type { ApprovalFormState, EntryPaymentMethod, Priority } from '../types';

interface FormaPagamento {
  id: string;
  nome: string;
  tipo: string;
}

const FALLBACK_FORMAS_PAGAMENTO: FormaPagamento[] = [
  { id: 'fallback-pix', nome: 'PIX', tipo: 'pix' },
  { id: 'fallback-dinheiro', nome: 'Dinheiro', tipo: 'dinheiro' },
  { id: 'fallback-cartao', nome: 'Cartão de Crédito/Débito', tipo: 'cartao' },
  { id: 'fallback-boleto', nome: 'Boleto', tipo: 'boleto' },
];

interface Props {
  state: ApprovalFormState;
  onChange: <K extends keyof ApprovalFormState>(key: K, value: ApprovalFormState[K]) => void;
  formasPagamento: FormaPagamento[];
  condicoesPagamento: any[];
  hasPaymentOptions: boolean;
  onInitializeDefaults: () => void;
  isInitializingDefaults: boolean;
  isCaixaAberto: boolean;
  valorFinal: number;
  quote: any;
}

export function PaymentStep({
  state, onChange, formasPagamento, condicoesPagamento, hasPaymentOptions,
  onInitializeDefaults, isInitializingDefaults, isCaixaAberto, valorFinal, quote,
}: Props) {
  const entryValue = parseAmount(state.entryAmount);
  const hasEntry = entryValue > 0;
  const pendingAmount = valorFinal - entryValue;
  const formasFiltradas = (formasPagamento.length > 0 ? formasPagamento : FALLBACK_FORMAS_PAGAMENTO)
    .filter((f, idx, arr) => arr.findIndex(x => x.id === f.id) === idx);
  const labelForma = (forma: FormaPagamento) =>
    forma.nome || forma.tipo || 'Forma de pagamento';

  return (
    <div className="space-y-6 px-1">
      {!hasPaymentOptions && (
        <div className="flex items-center justify-between p-4 border rounded-xl bg-amber-50 dark:bg-amber-950/30">
          <div>
            <p className="font-medium">Configurar opções de pagamento</p>
            <p className="text-sm text-muted-foreground">
              Crie as formas e condições de pagamento padrão para sua empresa.
            </p>
          </div>
          <Button onClick={onInitializeDefaults} disabled={isInitializingDefaults}>
            {isInitializingDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
            <span className="ml-2">Configurar</span>
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-4">
          <div className="p-4 border rounded-xl bg-card space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <Label className="text-base font-semibold">Forma de Pagamento</Label>
            </div>

            <Select
              value={state.selectedFormaId || ''}
              onValueChange={(v) => onChange('selectedFormaId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {formasFiltradas.map(forma => (
                  <SelectItem key={forma.id} value={forma.id}>
                    <div className="flex items-center gap-2">
                      <span>{labelForma(forma)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  value={state.entryAmount}
                  onChange={(e) => onChange('entryAmount', e.target.value)}
                  placeholder="0,00"
                  className="pl-9 h-12 text-lg"
                />
              </div>
            </div>

            {hasEntry && (
              <>
                <div>
                  <Label>Forma de pagamento da entrada</Label>
                  <RadioGroup
                    value={state.entryPaymentMethod}
                    onValueChange={(v) => onChange('entryPaymentMethod', v as EntryPaymentMethod)}
                    className="flex gap-3 mt-2"
                  >
                    {(['dinheiro', 'cartao', 'pix'] as const).map(method => (
                      <div key={method} className="flex items-center space-x-2 p-2 border rounded-lg flex-1">
                        <RadioGroupItem value={method} id={`entry-${method}`} />
                        <Label htmlFor={`entry-${method}`} className="cursor-pointer capitalize">
                          {method === 'cartao' ? 'Cartão' : method === 'pix' ? 'Pix / Transferência' : 'Dinheiro'}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {state.entryPaymentMethod === 'cartao' && (
                  <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/30 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Taxa de cartão</span>
                    </div>
                    <div>
                      <Label htmlFor="cardActualReceived" className="text-sm">Valor líquido recebido</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                        <Input
                          id="cardActualReceived"
                          value={state.cardActualReceived}
                          onChange={(e) => onChange('cardActualReceived', e.target.value)}
                          placeholder={state.entryAmount || "0,00"}
                          className="pl-9"
                        />
                      </div>
                      {state.cardActualReceived && state.entryAmount && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Taxa: {formatCurrency(entryValue - parseAmount(state.cardActualReceived))}
                          {' '}({((1 - parseAmount(state.cardActualReceived) / entryValue) * 100).toFixed(2)}%)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Vencimento do saldo restante</Label>

                  <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
                    <Checkbox
                      id="receiveOnCompletion"
                      checked={state.receiveOnCompletion}
                      onCheckedChange={(checked) => onChange('receiveOnCompletion', checked === true)}
                    />
                    <Label htmlFor="receiveOnCompletion" className="cursor-pointer text-sm font-normal">
                      Receber na conclusão do serviço
                    </Label>
                  </div>

                  {!state.receiveOnCompletion && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {state.balanceDueDate ? format(state.balanceDueDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                        <Calendar
                          mode="single"
                          selected={state.balanceDueDate}
                          onSelect={(d) => onChange('balanceDueDate', d)}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className="p-6 border-2 border-primary/30 rounded-xl bg-gradient-to-br from-primary/5 to-transparent space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Resumo do Pagamento
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-dashed">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Subtotal Original</span>
                  <span className="font-medium line-through decoration-destructive/50">
                    {formatCurrency(valorFinal === quote?.final_amount ? (quote?.total_amount || valorFinal) : valorFinal)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full uppercase">
                    {['avista', 'pix', 'dinheiro', 'debito', 'boleto', 'transferencia'].includes(
                      formasFiltradas.find(f => f.id === state.selectedFormaId)?.tipo || ''
                    ) ? 'À Vista (c/ Desconto)' : 'Parcelado (s/ Desconto)'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl border-2 border-primary/20">
                <div>
                  <span className="block text-sm font-medium text-primary/80">Valor Final para OS</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Este valor será gravado nas Contas a Receber</p>
                </div>
                <span className="text-3xl font-black text-primary tracking-tight">{formatCurrency(valorFinal)}</span>
              </div>

              {hasEntry && (
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-sm px-1">
                    <span className="text-green-600 font-medium">Entrada informada</span>
                    <span className="text-green-600 font-bold">-{formatCurrency(entryValue)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2 px-1">
                    <span>Saldo Final a Receber</span>
                    <span>{formatCurrency(pendingAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border rounded-xl bg-card space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              <Label className="text-base font-semibold">Configuração da OS</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Select value={state.priority} onValueChange={(v) => onChange('priority', v as Priority)}>
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
                      {state.estimatedEnd ? format(state.estimatedEnd, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                    <Calendar
                      mode="single"
                      selected={state.estimatedEnd}
                      onSelect={(d) => onChange('estimatedEnd', d)}
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
                value={state.notes}
                onChange={(e) => onChange('notes', e.target.value)}
                placeholder="Observações sobre o serviço..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
