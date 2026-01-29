import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';

interface CuttingPlanFiltersProps {
  availableLinhas: string[];
  availableCategories: string[];
  filteredProducts: Array<{ id: string; name: string }>;
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
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent className="max-w-[350px]">
            {filteredProducts.map(product => (
              <SelectItem key={product.id} value={product.id} className="truncate">
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
