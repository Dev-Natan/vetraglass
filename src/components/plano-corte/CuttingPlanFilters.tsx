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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label>Linha</Label>
        <Select value={selectedLinha} onValueChange={onLinhaChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a linha" />
          </SelectTrigger>
          <SelectContent>
            {availableLinhas.map(linha => (
              <SelectItem key={linha} value={linha}>
                {linha}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select 
          value={selectedCategory} 
          onValueChange={onCategoryChange}
          disabled={!selectedLinha}
        >
          <SelectTrigger>
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
        <Label>Produto</Label>
        <Select 
          value={selectedProduct} 
          onValueChange={onProductChange}
          disabled={!selectedCategory}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {filteredProducts.map(product => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
