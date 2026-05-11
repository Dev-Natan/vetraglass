import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, User, Pencil } from 'lucide-react';
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

export function SummaryStep({
  form, items, totalAmount, discountPercent, discountAmount, finalAmount,
  onDiscountChange, onStepChange, formatCurrency,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="w-4 h-4" />
            Cliente
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onStepChange('client')}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>
        <p className="font-semibold">{form.watch('customer_name')}</p>
        {form.watch('customer_phone') && (
          <p className="text-sm text-muted-foreground">{form.watch('customer_phone')}</p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="w-4 h-4" />
            Itens ({items.length})
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onStepChange('products')}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>
        <div className="space-y-2 divide-y divide-border/60">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm pt-2 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity}x {item.width && item.height ? `${item.width}×${item.height}mm` : ''}
                </p>
              </div>
              <span className="font-semibold ml-2 shrink-0">{formatCurrency(item.total_price)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-4 space-y-3">
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
        <div className="flex justify-between text-xl font-bold border-t border-primary/20 pt-3">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(finalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
