import { memo } from 'react';
import { resolveImageUrl } from '@/utils/imageUrl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package, Layers, Palette } from 'lucide-react';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';
import { useItemTypes } from '@/hooks/useItemTypes';

interface QuoteItem {
  id?: string;
  company_product_id?: string;
  product_template_id?: string;
  company_item_id?: string;
  item_type?: 'product' | 'item';
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
  unit?: string;
  has_glass?: boolean;
  glass_color?: string;
  glass_thickness?: string;
  aluminum_color?: string;
}

const glassColorLabels: Record<string, string> = {
  incolor: 'Incolor',
  verde: 'Verde',
  fume: 'Fumê',
};

interface QuoteItemCardProps {
  item: QuoteItem;
  index: number;
  onUpdate: (index: number, field: keyof QuoteItem, value: any) => void;
  onRemove: (index: number) => void;
  formatCurrency: (value: number) => string;
}

export const QuoteItemCard = memo(function QuoteItemCard({ item, index, onUpdate, onRemove, formatCurrency }: QuoteItemCardProps) {
  const { labels: categoryLabels } = useProductCategoryLabels();
  const { data: itemTypes } = useItemTypes();
  
  const getProductImage = (imageUrl: string | null | undefined) => {
    const bucket = item.item_type === 'item' ? 'item-templates' : 'product-templates';
    return resolveImageUrl(imageUrl ?? null, bucket as any);
  };
  
  const getItemTypeLabel = (type: string) => {
    const found = itemTypes?.find(t => t.slug === type);
    return found?.name || type;
  };

  const imageUrl = getProductImage(item.image_url);
  const area = item.width && item.height ? ((item.width / 1000) * (item.height / 1000)).toFixed(2) : null;
  const isItem = item.item_type === 'item';

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
              {isItem ? (
                <Layers className="w-8 h-8 text-muted-foreground/30" />
              ) : (
                <Package className="w-8 h-8 text-muted-foreground/30" />
              )}
            </div>
          )}
        </div>

        {/* Product Info & Controls */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{item.description || 'Produto não selecionado'}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isItem && (
                  <Badge variant="secondary" className="text-xs bg-warning/20 text-warning-foreground dark:bg-warning/20">
                    Item Avulso
                  </Badge>
                )}
                {item.linha && (
                  <Badge variant="secondary" className="text-xs">{item.linha}</Badge>
                )}
                {item.category && (
                  <Badge variant="outline" className="text-xs">
                    {isItem ? getItemTypeLabel(item.category) : (categoryLabels[item.category] || item.category)}
                  </Badge>
                )}
                {!isItem && item.has_glass !== undefined && (
                  <Badge 
                    variant={item.has_glass ? 'default' : 'outline'} 
                    className="text-xs"
                  >
                    {item.has_glass ? 'Com Vidro' : 'Sem Vidro'}
                  </Badge>
                )}
                {item.has_glass && item.glass_color && (
                  <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary">
                    {glassColorLabels[item.glass_color] || item.glass_color}
                  </Badge>
                )}
                {item.has_glass && item.glass_thickness && (
                  <Badge variant="outline" className="text-xs bg-success/10 border-success/30 text-success">
                    {item.glass_thickness}
                  </Badge>
                )}
                {item.aluminum_color && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
                    <Palette className="w-3 h-3 mr-1" />
                    {item.aluminum_color}
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

          {/* Dimensions & Quantity - Different layout for items vs products */}
          {isItem ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Quantidade ({item.unit || 'un'})</label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', Number(e.target.value))}
                  min={1}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Preço Unit.</label>
                <Input
                  type="number"
                  value={item.unit_price || ''}
                  onChange={(e) => {
                    const newPrice = Number(e.target.value);
                    onUpdate(index, 'unit_price', newPrice);
                    onUpdate(index, 'base_price_m2', newPrice);
                    onUpdate(index, 'total_price', newPrice * item.quantity);
                  }}
                  min={0}
                  step={0.01}
                  className="h-9"
                />
              </div>
              <div className="hidden sm:block" />
            </div>
          ) : (
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
          )}

          {/* Price Summary */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {isItem 
                ? `${item.quantity} ${item.unit || 'un'} × ${formatCurrency(item.unit_price)}`
                : area && `${area} m² × ${item.quantity} un`
              }
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
}, (prev, next) => 
  prev.item.id === next.item.id && 
  prev.item.total_price === next.item.total_price &&
  prev.item.quantity === next.item.quantity &&
  prev.item.unit_price === next.item.unit_price &&
  prev.item.aluminum_color === next.item.aluminum_color
);
