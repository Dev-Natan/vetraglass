import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';

interface CuttingPlanFiltersProps {
  availableLinhas: string[];
  availableCategories: string[];
  filteredProducts: Array<{ id: string; name: string; image_url?: string | null }>;
  selectedLinha: string;
  selectedCategory: string;
  selectedProduct: string;
  onLinhaChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProductChange: (value: string) => void;
}

export function CuttingPlanFilters({
  availableLinhas,
  availableCategories,
  filteredProducts,
  selectedLinha,
  selectedCategory,
  selectedProduct,
  onLinhaChange,
  onCategoryChange,
  onProductChange,
}: CuttingPlanFiltersProps) {
  const { labels: categoryLabels } = useProductCategoryLabels();

  const translateCategory = (category: string) => {
    return categoryLabels[category] || category;
  };

  const selectedProductData = filteredProducts.find(p => p.id === selectedProduct);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Linha</Label>
        <Select value={selectedLinha} onValueChange={onLinhaChange}>
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="Selecione a linha" />
          </SelectTrigger>
          <SelectContent className="max-w-[300px]">
            {availableLinhas.map(linha => (
              <SelectItem key={linha} value={linha} className="truncate">
                {linha}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Categoria</Label>
        <Select 
          value={selectedCategory} 
          onValueChange={onCategoryChange}
          disabled={!selectedLinha}
        >
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map(category => (
              <SelectItem key={category} value={category}>
                {translateCategory(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Produto</Label>
        <Select 
          value={selectedProduct} 
          onValueChange={onProductChange}
          disabled={!selectedCategory}
        >
          <SelectTrigger className="w-full h-10">
            {selectedProductData ? (
              <div className="flex items-center gap-2 overflow-hidden">
                {selectedProductData.image_url && (
                  <img 
                    src={selectedProductData.image_url} 
                    alt="" 
                    className="w-6 h-6 object-contain rounded flex-shrink-0"
                  />
                )}
                <span className="truncate">{selectedProductData.name}</span>
              </div>
            ) : (
              <SelectValue placeholder="Selecione" />
            )}
          </SelectTrigger>
          <SelectContent className="max-w-[400px]">
            {filteredProducts.map(product => (
              <SelectItem 
                key={product.id} 
                value={product.id} 
                className="py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-lg text-muted-foreground">🪟</span>
                    )}
                  </div>
                  <span className="truncate">{product.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
