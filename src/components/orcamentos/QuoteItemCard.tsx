import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package, Edit2 } from 'lucide-react';

interface QuoteItem {
  id?: string;
  company_product_id?: string;
  product_template_id?: string;
  description: string;
  width?: number;
  height?: number;
  quantity: number;
  base_price_m2: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
  linha?: string | null;
  category?: string;
}

interface QuoteItemCardProps {
  item: QuoteItem;
  index: number;
  onUpdate: (index: number, field: keyof QuoteItem, value: any) => void;
  onRemove: (index: number) => void;
  formatCurrency: (value: number) => string;
}

const categoryLabels: Record<string, string> = {
  window: 'Janela',
  door: 'Porta',
  partition: 'Divisória',
  mirror: 'Espelho',
  shower: 'Box',
  facade: 'Fachada',
  guarda_corpo: 'Guarda Corpo',
  other: 'Outros',
};

export function QuoteItemCard({ item, index, onUpdate, onRemove, formatCurrency }: QuoteItemCardProps) {
  const getProductImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `/products/${imageUrl}`;
  };

  const imageUrl = getProductImage(item.image_url);
  const area = item.width && item.height ? ((item.width / 1000) * (item.height / 1000)).toFixed(2) : null;

  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="w-20 h-20 shrink-0 rounded-lg bg-muted overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.description}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Product Info & Controls */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{item.description || 'Produto não selecionado'}</h4>
              <div className="flex items-center gap-2 mt-1">
                {item.linha && (
                  <Badge variant="secondary" className="text-xs">{item.linha}</Badge>
                )}
                {item.category && (
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[item.category] || item.category}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              className="text-destructive hover:text-destructive shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Dimensions & Quantity */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Largura (mm)</label>
              <Input
                type="number"
                value={item.width || ''}
                onChange={(e) => onUpdate(index, 'width', Number(e.target.value))}
                placeholder="1200"
                min={0}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Altura (mm)</label>
              <Input
                type="number"
                value={item.height || ''}
                onChange={(e) => onUpdate(index, 'height', Number(e.target.value))}
                placeholder="1500"
                min={0}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Qtd</label>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => onUpdate(index, 'quantity', Number(e.target.value))}
                min={1}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Preço/m²</label>
              <Input
                type="number"
                value={item.base_price_m2 || ''}
                onChange={(e) => onUpdate(index, 'base_price_m2', Number(e.target.value))}
                min={0}
                step={0.01}
                className="h-9"
              />
            </div>
          </div>

          {/* Price Summary */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {area && `${area} m² × ${item.quantity} un`}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-bold text-primary">{formatCurrency(item.total_price)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
