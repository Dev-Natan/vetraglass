import { Button } from '@/components/ui/button';
import { Package, Layers } from 'lucide-react';
import { QuoteItemCard } from '../../QuoteItemCard';
import type { QuoteItem } from '../types';

interface Props {
  items: QuoteItem[];
  onAddProduct: () => void;
  onAddItem: () => void;
  onUpdateItem: (index: number, field: keyof QuoteItem, value: unknown) => void;
  onRemoveItem: (index: number) => void;
  formatCurrency: (value: number) => string;
}

export function ProductsStep({ items, onAddProduct, onAddItem, onUpdateItem, onRemoveItem, formatCurrency }: Props) {
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-center text-muted-foreground text-sm">
          Adicione produtos completos ou itens avulsos ao orçamento
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onAddProduct}
            className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-sm">Produto</p>
            <p className="text-xs mt-1">Janelas, portas, etc</p>
          </button>
          <button
            type="button"
            onClick={onAddItem}
            className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-sm">Item Avulso</p>
            <p className="text-xs mt-1">Perfis, vidros, acessórios</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <QuoteItemCard
          key={item.id || index}
          item={item}
          index={index}
          onUpdate={onUpdateItem}
          onRemove={onRemoveItem}
          formatCurrency={formatCurrency}
        />
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 gap-2" onClick={onAddProduct}>
          <Package className="w-4 h-4" />
          Produto
        </Button>
        <Button type="button" variant="outline" className="flex-1 gap-2" onClick={onAddItem}>
          <Layers className="w-4 h-4" />
          Item Avulso
        </Button>
      </div>
    </div>
  );
}
