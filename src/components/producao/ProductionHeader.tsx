import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CuttingPlanFilters } from '@/components/plano-corte/CuttingPlanFilters';

interface ProductionHeaderProps {
  availableLinhas: string[];
  availableCategories: string[];
  filteredProducts: Array<{ id: string; name: string; image_url: string | null }>;
  selectedLinha: string;
  selectedCategory: string;
  selectedProduct: string;
  onLinhaChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProductChange: (value: string) => void;
  width: number;
  height: number;
  quantity: number;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onQuantityChange: (value: number) => void;
  productImageUrl: string | null;
  productName: string | null;
}

export function ProductionHeader({
  availableLinhas,
  availableCategories,
  filteredProducts,
  selectedLinha,
  selectedCategory,
  selectedProduct,
  onLinhaChange,
  onCategoryChange,
  onProductChange,
  width,
  height,
  quantity,
  onWidthChange,
  onHeightChange,
  onQuantityChange,
  productImageUrl,
  productName
}: ProductionHeaderProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 bg-card rounded-xl border shadow-sm">
      {/* Product Image */}
      <div className="flex justify-center lg:justify-start">
        <div className="w-full max-w-[180px] aspect-square bg-muted rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden">
          {productImageUrl ? (
            <img 
              src={productImageUrl} 
              alt={productName || 'Produto'}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-5xl text-muted-foreground/30">🪟</div>
          )}
        </div>
      </div>

      {/* Filters and Dimensions */}
      <div className="lg:col-span-3 space-y-4">
        {/* Product Selection - Full width filters */}
        <CuttingPlanFilters
          availableLinhas={availableLinhas}
          availableCategories={availableCategories}
          filteredProducts={filteredProducts}
          selectedLinha={selectedLinha}
          selectedCategory={selectedCategory}
          selectedProduct={selectedProduct}
          onLinhaChange={onLinhaChange}
          onCategoryChange={onCategoryChange}
          onProductChange={onProductChange}
        />

        {productName && (
          <h2 className="text-xl font-bold uppercase text-foreground">
            {productName}
          </h2>
        )}

        {/* Dimensions */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Largura do Vão (mm)</Label>
            <Input 
              type="number" 
              value={width} 
              onChange={e => onWidthChange(Number(e.target.value))}
              className="bg-muted h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Altura do Vão (mm)</Label>
            <Input 
              type="number" 
              value={height} 
              onChange={e => onHeightChange(Number(e.target.value))}
              className="bg-muted h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quantidade</Label>
            <Input 
              type="number" 
              value={quantity} 
              onChange={e => onQuantityChange(Number(e.target.value))}
              min={1}
              className="bg-muted h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
