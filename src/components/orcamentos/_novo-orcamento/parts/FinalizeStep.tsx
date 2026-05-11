import type { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2 } from 'lucide-react';
import type { QuoteFormData } from '../types';

interface Props {
  form: UseFormReturn<QuoteFormData>;
  finalAmount: number;
  formatCurrency: (value: number) => string;
}

export function FinalizeStep({ form, finalAmount, formatCurrency }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Valor final do orçamento</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(finalAmount)}</p>
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
