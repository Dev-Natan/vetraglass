import type { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText } from 'lucide-react';
import type { QuoteFormData } from '../types';

interface Props {
  form: UseFormReturn<QuoteFormData>;
  finalAmount: number;
  itemsCount: number;
  customerName: string;
  showMedidasColumn: boolean;
  showM2Column: boolean;
  onToggleMedidas: (value: boolean) => void;
  onToggleM2: (value: boolean) => void;
  formatCurrency: (value: number) => string;
}

export function FinalizeStep({
  form,
  finalAmount,
  itemsCount,
  customerName,
  showMedidasColumn,
  showM2Column,
  onToggleMedidas,
  onToggleM2,
  formatCurrency,
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Finalizar</h2>
        <p className="text-sm text-muted-foreground">Tudo pronto! Salve para gerar o orçamento.</p>
      </div>

      {/* Hero confirmação */}
      <div className="rounded-xl border bg-card px-4 py-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-3">
          <FileText className="w-7 h-7 text-primary" />
        </div>
        <p className="text-base font-semibold">Pronto para gerar o orçamento</p>
        <p className="text-sm mt-1">
          <span className="text-muted-foreground">Cliente: </span>
          <span className="font-semibold uppercase">{customerName || '—'}</span>
        </p>
        <p className="text-sm mt-0.5">
          <span className="text-muted-foreground">{itemsCount} {itemsCount === 1 ? 'item' : 'itens'} · Total: </span>
          <span className="font-bold text-primary">{formatCurrency(finalAmount)}</span>
        </p>

        {/* Colunas no PDF */}
        <div className="mt-6 w-full max-w-sm rounded-lg border bg-muted/20 px-4 py-3 text-left">
          <p className="text-xs font-semibold text-primary text-center mb-3">Colunas exibidas no PDF</p>
          <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
            <Checkbox
              checked={showMedidasColumn}
              onCheckedChange={(v) => onToggleMedidas(!!v)}
            />
            <span>Mostrar coluna de Medidas (largura × altura)</span>
          </label>
          <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
            <Checkbox
              checked={showM2Column}
              onCheckedChange={(v) => onToggleM2(!!v)}
            />
            <span>Mostrar coluna de M² (metros quadrados)</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="valid_until"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Válido até</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="payment_terms"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Forma de Pagamento</FormLabel>
              <FormControl>
                <Input placeholder="50% entrada + 50% entrega" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea placeholder="Observações adicionais, condições especiais, prazos de entrega..." rows={4} {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <p className="text-xs text-muted-foreground text-center">
        Ao finalizar, o orçamento será salvo como <span className="font-semibold">Pendente</span> e poderá ser enviado ao cliente.
      </p>
    </div>
  );
}
