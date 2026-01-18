import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Layers, Package } from 'lucide-react';

// Tradução de categorias
const categoryLabels: Record<string, string> = {
  window: 'Janela',
  door: 'Porta',
  facade: 'Fachada',
  shower: 'Box de Banheiro',
  mirror: 'Espelho',
  partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo',
  other: 'Outros',
};

const translateCategory = (category: string) => categoryLabels[category] || category;

interface ProductInfoHeaderProps {
  productName: string;
  productImage: string | null;
  category: string;
  linha: string;
  width: number;
  height: number;
  quantity: number;
  onQuantityChange: (value: number) => void;
}

export function ProductInfoHeader({ 
  productName, 
  productImage, 
  category,
  linha,
  width,
  height,
  quantity,
  onQuantityChange
}: ProductInfoHeaderProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center border shrink-0 overflow-hidden">
            {productImage ? (
              <img 
                src={productImage} 
                alt={productName} 
                className="w-full h-full object-contain"
              />
            ) : (
              <Package className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          
          {/* Product Info */}
          <div className="flex-1 space-y-2 min-w-0">
            <h3 className="font-bold text-lg leading-tight line-clamp-2">{productName}</h3>
            
            <div className="flex flex-wrap gap-2">
              {linha && (
                <Badge variant="secondary" className="text-xs">
                  <Layers className="w-3 h-3 mr-1" />
                  {linha}
                </Badge>
              )}
              {category && (
                <Badge variant="outline" className="text-xs">
                  {translateCategory(category)}
                </Badge>
              )}
            </div>
            
            {/* Quick dimensions display */}
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground">
                L: <span className="font-medium text-foreground">{width}mm</span>
              </span>
              <span className="text-muted-foreground">
                A: <span className="font-medium text-foreground">{height}mm</span>
              </span>
            </div>
          </div>
        </div>
        
        {/* Quantity input */}
        <div className="mt-4 flex items-center gap-3">
          <Label htmlFor="quantity" className="text-sm font-medium whitespace-nowrap">
            Quantidade:
          </Label>
          <Input
            id="quantity"
            type="number"
            value={quantity}
            onChange={e => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">unidade(s)</span>
        </div>
      </CardContent>
    </Card>
  );
}
