import { Button } from '@/components/ui/button';
import { Package, Layers, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { QuoteItemCard } from '../../QuoteItemCard';
import type { QuoteItem } from '../types';

interface Props {
  items: QuoteItem[];
  isLoading?: boolean;
  onAddProduct: () => void;
  onAddItem: () => void;
  onUpdateItem: (index: number, field: keyof QuoteItem, value: unknown) => void;
  onRemoveItem: (index: number) => void;
  formatCurrency: (value: number) => string;
}

function AddItemsHeader({ onAddProduct, onAddItem }: Pick<Props, 'onAddProduct' | 'onAddItem'>) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
      <div>
        <h3 className="text-base font-semibold text-foreground">Itens do orçamento</h3>
        <p className="text-xs text-muted-foreground">Adicione produtos completos ou itens avulsos</p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" className="gap-1.5 shadow-sm" onClick={onAddProduct}>
          <Plus className="w-4 h-4" />
          Produto
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onAddItem}>
          <Layers className="w-4 h-4" />
          Item Avulso
        </Button>
      </div>
    </div>
  );
}

function AddItemsFooter({ onAddProduct, onAddItem }: Pick<Props, 'onAddProduct' | 'onAddItem'>) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 px-6 py-3 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 border-t border-border/60 mt-4">
      <div className="flex gap-2">
        <Button type="button" className="flex-1 gap-2 shadow-sm" onClick={onAddProduct}>
          <Plus className="w-4 h-4" />
          Adicionar Produto
        </Button>
        <Button type="button" variant="outline" className="flex-1 gap-2" onClick={onAddItem}>
          <Layers className="w-4 h-4" />
          Adicionar Item Avulso
        </Button>
      </div>
    </div>
  );
}

function EmptyItemsState({ onAddProduct, onAddItem }: Pick<Props, 'onAddProduct' | 'onAddItem'>) {
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

export function ProductsStep({ items, isLoading, onAddProduct, onAddItem, onUpdateItem, onRemoveItem, formatCurrency }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <AddItemsHeader onAddProduct={onAddProduct} onAddItem={onAddItem} />
        <EmptyItemsState onAddProduct={onAddProduct} onAddItem={onAddItem} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AddItemsHeader onAddProduct={onAddProduct} onAddItem={onAddItem} />

      {items.map((item, index) => (
        <QuoteItemCard
          key={index}
          item={item}
          index={index}
          onUpdate={onUpdateItem}
          onRemove={onRemoveItem}
          formatCurrency={formatCurrency}
        />
      ))}

      <AddItemsFooter onAddProduct={onAddProduct} onAddItem={onAddItem} />
    </div>
  );
}

