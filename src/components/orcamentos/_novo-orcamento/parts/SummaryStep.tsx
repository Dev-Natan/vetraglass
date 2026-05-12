import { Fragment } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, User, Pencil, Trash2, ImageIcon } from 'lucide-react';
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
  onRemoveItem?: (index: number) => void;
  formatCurrency: (value: number) => string;
}

export function SummaryStep({
  form, items, totalAmount, discountPercent, discountAmount, finalAmount,
  onDiscountChange, onStepChange, onRemoveItem, formatCurrency,
}: Props) {
  const customerName = form.watch('customer_name');
  const customerPhone = form.watch('customer_phone');
  const customerDocument = form.watch('customer_document');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Resumo</h2>
        <p className="text-sm text-muted-foreground">Confira os itens antes de finalizar.</p>
      </div>

      {/* Cliente */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              <User className="w-3.5 h-3.5" />
              Cliente
            </div>
            <p className="font-bold uppercase truncate">{customerName || '—'}</p>
            <p className="text-sm text-muted-foreground">
              {[customerDocument, customerPhone].filter(Boolean).join(' • ') || ''}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onStepChange('client')}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>
      </div>

      {/* Itens */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            <Package className="w-3.5 h-3.5" />
            Itens ({items.length})
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onStepChange('products')}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item adicionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium w-[72px]">Imagem</th>
                  <th className="px-3 py-2 font-medium">Projeto</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Medidas</th>
                  <th className="px-3 py-2 font-medium text-right">M²</th>
                  <th className="px-3 py-2 font-medium text-right">Qtd</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium text-right w-[80px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const w = Number(item.width) || 0;
                  const h = Number(item.height) || 0;
                  const m2 = ((w * h) / 1_000_000) * (item.quantity || 1);
                  const componentsTotal = item.components?.reduce((s, c) => s + (c.unit_price * c.quantity), 0) || 0;
                  return (
                    <Fragment key={index}>
                      <tr className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2">
                          <div className="w-12 h-12 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.description} className="w-full h-full object-contain" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-muted-foreground/60" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 min-w-[200px]">
                          <p className="font-medium leading-tight">{item.description}</p>
                          {item.category && (
                            <p className="text-xs text-muted-foreground">{item.category}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-primary">
                          {w && h ? `${w}×${h} mm` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{m2.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                          {formatCurrency(item.total_price)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onStepChange('products')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {onRemoveItem && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => onRemoveItem(index)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {item.components && item.components.length > 0 && (
                        <tr key={`${index}-comps`} className="bg-muted/10 border-t border-dashed">
                          <td></td>
                          <td colSpan={5} className="px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Componentes / Acessórios</p>
                            <div className="space-y-1">
                              {item.components.map((c, ci) => (
                                <div key={ci} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">+ {c.description} ({c.quantity}x)</span>
                                  <span className="font-medium tabular-nums">{formatCurrency(c.unit_price * c.quantity)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs font-semibold border-t border-dashed pt-1 mt-1">
                                <span>Subtotal componentes</span>
                                <span className="tabular-nums text-primary">{formatCurrency(componentsTotal)}</span>
                              </div>
                            </div>
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex justify-end px-4 py-3 border-t bg-muted/20">
            <div className="text-base">
              <span className="text-muted-foreground mr-2">Total:</span>
              <span className="font-bold text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Totais e desconto */}
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
