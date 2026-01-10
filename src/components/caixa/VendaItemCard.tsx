import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Minus } from 'lucide-react';

export interface VendaItem {
  id: string;
  itemTemplateId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface VendaItemCardProps {
  item: VendaItem;
  onQuantityChange: (id: string, quantity: number) => void;
  onPriceChange: (id: string, price: number) => void;
  onRemove: (id: string) => void;
}

export function VendaItemCard({
  item,
  onQuantityChange,
  onPriceChange,
  onRemove,
}: VendaItemCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleQuantityInput = (value: string) => {
    const qty = parseFloat(value.replace(',', '.')) || 0;
    onQuantityChange(item.id, qty);
  };

  const handlePriceInput = (value: string) => {
    const price = parseFloat(value.replace(',', '.')) || 0;
    onPriceChange(item.id, price);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.unit}</p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onQuantityChange(item.id, Math.max(0.01, item.quantity - 1))}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          type="text"
          inputMode="decimal"
          value={item.quantity.toString().replace('.', ',')}
          onChange={(e) => handleQuantityInput(e.target.value)}
          className="w-16 h-8 text-center text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onQuantityChange(item.id, item.quantity + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="w-24">
        <Input
          type="text"
          inputMode="decimal"
          value={item.unitPrice.toFixed(2).replace('.', ',')}
          onChange={(e) => handlePriceInput(e.target.value)}
          className="h-8 text-sm text-right"
          placeholder="Preço"
        />
      </div>

      <div className="w-24 text-right">
        <p className="font-medium text-sm">{formatCurrency(item.totalPrice)}</p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => onRemove(item.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
