import type { UseFormReturn } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { QuoteFormData, QuoteItem, Step } from '../types';

interface Props {
  form: UseFormReturn<QuoteFormData>;
  items: QuoteItem[];
  totalAmount: number;
  discountPercent: number;
  discountAmount: number;
  finalAmount: number;
  onDiscountChange: (value: number) => void;
  onStepChange: (step: Step) => void;
  formatCurrency: (value: number) => string;
}

export function ReviewStep({
  form, items, totalAmount, discountPercent, discountAmount, finalAmount,
  onDiscountChange, onStepChange, formatCurrency,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Cliente</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onStepChange('client')}>
            Editar
          </Button>
        </div>
        <p className="font-semibold">{form.watch('customer_name')}</p>
        {form.watch('customer_phone') && (
          <p className="text-sm text-muted-foreground">{form.watch('customer_phone')}</p>
        )}
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Produtos ({items.length})
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onStepChange('products')}>
            Editar
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="truncate flex-1">{item.description}</span>
              <span className="font-medium ml-2">{formatCurrency(item.total_price)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
              <Textarea placeholder="Observações adicionais..." rows={2} {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Desconto (%)</span>
          <Input
            type="number"
            value={discountPercent}
            onChange={(e) => onDiscountChange(Number(e.target.value))}
            min={0}
            max={100}
            className="w-20 h-8 text-right bg-background"
          />
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-destructive">
            <span>Desconto</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl font-bold border-t pt-3">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(finalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
