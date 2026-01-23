import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Layers, Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';
import { useGlassTypes } from '@/hooks/useGlassTypes';

// Hardware types options
const hardwareTypes = [
  'Ferragens cromadas',
  'Ferragens pretas',
  'Ferragens bronzes',
  'Ferragens douradas',
  'Perfil de alumínio fosco e ferragens cromadas',
  'Perfil de alumínio preto e ferragens pretas',
  'Tubo / perfil de alumínio fosco e ferragens cromadas',
  'Tubo / perfil de alumínio preto e ferragens pretas',
];

interface ProductInfoHeaderProps {
  productName: string;
  productImage: string | null;
  category: string;
  linha: string;
  width: number;
  height: number;
  quantity: number;
  onQuantityChange: (value: number) => void;
  glassType: string;
  onGlassTypeChange: (value: string) => void;
  hardwareType: string;
  onHardwareTypeChange: (value: string) => void;
}

export function ProductInfoHeader({ 
  productName, 
  productImage, 
  category,
  linha,
  width,
  height,
  quantity,
  onQuantityChange,
  glassType,
  onGlassTypeChange,
  hardwareType,
  onHardwareTypeChange
}: ProductInfoHeaderProps) {
  // Use dynamic categories from database
  const { labels: categoryLabels } = useProductCategoryLabels();
  const { data: glassTypes } = useGlassTypes();
  
  const translateCategory = (cat: string) => categoryLabels[cat] || cat;

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center border shrink-0 overflow-hidden">
            {productImage ? (
              <img 
                src={productImage} 
                alt={productName} 
                className="w-full h-full object-contain"
              />
            ) : (
              <Package className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          
          {/* Product Info */}
          <div className="flex-1 space-y-2 min-w-0">
            <h3 className="font-bold text-base leading-tight line-clamp-2">{productName}</h3>
            
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
          </div>
        </div>
        
        {/* Glass type selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipo de Vidro</Label>
          <Select value={glassType} onValueChange={onGlassTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione o tipo de vidro" />
            </SelectTrigger>
            <SelectContent>
              {glassTypes?.map(type => (
                <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Hardware type selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipo de Ferragem</Label>
          <Select value={hardwareType} onValueChange={onHardwareTypeChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione o tipo de ferragem" />
            </SelectTrigger>
            <SelectContent>
              {hardwareTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Quantity input */}
        <div className="flex items-center gap-3 pt-1">
          <Label htmlFor="quantity" className="text-sm font-medium whitespace-nowrap">
            Quantidade:
          </Label>
          <Input
            id="quantity"
            type="number"
            value={quantity}
            onChange={e => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="w-20 h-9 text-center"
          />
          <span className="text-sm text-muted-foreground">conj.</span>
        </div>
      </CardContent>
    </Card>
  );
}
