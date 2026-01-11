import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Minus, Package, Ruler } from 'lucide-react';

export interface VendaItem {
  id: string;
  itemTemplateId?: string;
  companyProductId?: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  width?: number;
  height?: number;
  isProduct?: boolean;
}

interface VendaItemCardProps {
  item: VendaItem;
  onQuantityChange: (id: string, quantity: number) => void;
  onPriceChange: (id: string, price: number) => void;
  onDimensionsChange?: (id: string, width: number, height: number) => void;
  onRemove: (id: string) => void;
}

export function VendaItemCard({
  item,
  onQuantityChange,
  onPriceChange,
  onDimensionsChange,
  onRemove,
}: VendaItemCardProps) {
  // Units that use millimeters for display (stored internally as meters)
  const isLinearMeter = ['m', 'metro', 'metros'].includes(item.unit.toLowerCase());
  const isFractionalUnit = isLinearMeter || ['m²', 'kg'].includes(item.unit.toLowerCase());

  // For linear meters: display in mm, store in meters
  const displayQuantity = isLinearMeter ? Math.round(item.quantity * 1000) : item.quantity;
  const displayUnit = isLinearMeter ? 'mm' : item.unit;
  const step = isLinearMeter ? 100 : (isFractionalUnit ? 0.1 : 1);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleQuantityInput = (value: string) => {
    const inputQty = parseFloat(value.replace(',', '.')) || 0;
    const storedQty = isLinearMeter ? inputQty / 1000 : inputQty;
    onQuantityChange(item.id, storedQty);
  };

  const handleIncrement = (delta: number) => {
    if (isLinearMeter) {
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

  const handleDimensionChange = (dimension: 'width' | 'height', value: string) => {
    if (!onDimensionsChange) return;
    const numValue = parseFloat(value.replace(',', '.')) || 0;
    const width = dimension === 'width' ? numValue : (item.width || 0);
    const height = dimension === 'height' ? numValue : (item.height || 0);
    onDimensionsChange(item.id, width, height);
  };

  // Product card with dimensions
  if (item.isProduct) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">Produto</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {/* Dimensions */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Ruler className="h-3 w-3" /> Largura
            </label>
            <div className="relative">
              <Input
                type="text"
                inputMode="numeric"
                value={(item.width || 0).toString()}
                onChange={(e) => handleDimensionChange('width', e.target.value)}
                className="h-8 text-sm pr-8"
                placeholder="0"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Altura</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="numeric"
                value={(item.height || 0).toString()}
                onChange={(e) => handleDimensionChange('height', e.target.value)}
                className="h-8 text-sm pr-8"
                placeholder="0"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Qtd</label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onQuantityChange(item.id, Math.max(1, item.quantity - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="text"
                inputMode="numeric"
                value={item.quantity.toString()}
                onChange={(e) => {
                  const qty = parseInt(e.target.value) || 1;
                  onQuantityChange(item.id, qty);
                }}
                className="h-8 text-center text-sm w-12"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Preço Unit.</label>
            <Input
              type="text"
              inputMode="decimal"
              value={item.unitPrice.toFixed(2).replace('.', ',')}
              onChange={(e) => handlePriceInput(e.target.value)}
              className="h-8 text-sm text-right"
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1 border-t">
          <p className="font-semibold text-sm">
            Total: {formatCurrency(item.totalPrice)}
          </p>
        </div>
      </div>
    );
  }

  // Material card (original layout)
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {isLinearMeter ? `${item.unit} (preço/metro)` : item.unit}
        </p>
      </div>

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
