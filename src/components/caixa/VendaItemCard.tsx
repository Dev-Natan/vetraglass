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
  // Units that use millimeters for display (stored internally as meters)
  const isLinearMeter = ['m', 'metro', 'metros'].includes(item.unit.toLowerCase());
  const isFractionalUnit = isLinearMeter || ['m²', 'kg'].includes(item.unit.toLowerCase());

  // For linear meters: display in mm, store in meters
  const displayQuantity = isLinearMeter ? Math.round(item.quantity * 1000) : item.quantity;
  const displayUnit = isLinearMeter ? 'mm' : item.unit;
  const step = isLinearMeter ? 100 : (isFractionalUnit ? 0.1 : 1); // 100mm step for profiles

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleQuantityInput = (value: string) => {
    const inputQty = parseFloat(value.replace(',', '.')) || 0;
    // Convert mm to meters for storage if linear meter
    const storedQty = isLinearMeter ? inputQty / 1000 : inputQty;
    onQuantityChange(item.id, storedQty);
  };

  const handleIncrement = (delta: number) => {
    if (isLinearMeter) {
      // delta is in mm, convert to meters
      const newQty = Math.max(0.001, item.quantity + (delta / 1000));
      onQuantityChange(item.id, parseFloat(newQty.toFixed(3)));
    } else {
      const newQty = Math.max(0.01, parseFloat((item.quantity + delta).toFixed(2)));
      onQuantityChange(item.id, newQty);
    }
  };

  const handlePriceInput = (value: string) => {
    const price = parseFloat(value.replace(',', '.')) || 0;
    onPriceChange(item.id, price);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {isLinearMeter ? `${item.unit} (preço/metro)` : item.unit}
        </p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleIncrement(-step)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <div className="relative">
          <Input
            type="text"
            inputMode="numeric"
            value={isLinearMeter ? displayQuantity.toString() : item.quantity.toString().replace('.', ',')}
            onChange={(e) => handleQuantityInput(e.target.value)}
            className="w-24 h-8 text-center text-sm pr-8"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
            {displayUnit}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleIncrement(step)}
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
