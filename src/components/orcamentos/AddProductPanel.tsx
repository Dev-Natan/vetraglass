import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Check, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddProductPanelProps {
  onAdd: (product: {
    product_template_id: string;
    company_product_id?: string;
    name: string;
    base_price: number;
    image_url?: string | null;
    linha?: string | null;
    category?: string;
    width: number;
    height: number;
    quantity: number;
    unit_price: number;
    total_price: number;
  }) => void;
  onCancel: () => void;
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

export function AddProductPanel({ onAdd, onCancel }: AddProductPanelProps) {
  const { currentCompany } = useAuth();
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);

  // Fetch all product templates
  const { data: productTemplates, isLoading } = useQuery({
    queryKey: ['product-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('is_active', true)
        .order('linha')
        .order('category')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch company products to get prices
  const { data: companyProducts } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id
  });

  // Get unique linhas
  const linhas = useMemo(() => {
    return [...new Set(productTemplates?.map(p => p.linha).filter(Boolean) || [])];
  }, [productTemplates]);

  // Get categories for selected linha
  const categories = useMemo(() => {
    if (!selectedLinha) return [];
    const cats = productTemplates
      ?.filter(p => p.linha === selectedLinha)
      .map(p => p.category)
      .filter(Boolean) || [];
    return [...new Set(cats)];
  }, [productTemplates, selectedLinha]);

  // Get products based on filters
  const filteredProducts = useMemo(() => {
    let products = productTemplates || [];
    
    if (selectedLinha) {
      products = products.filter(p => p.linha === selectedLinha);
    }
    if (selectedCategory) {
      products = products.filter(p => p.category === selectedCategory);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }
    
    return products;
  }, [productTemplates, selectedLinha, selectedCategory, searchQuery]);

  const selectedProduct = productTemplates?.find(p => p.id === selectedProductId);
  const companyProduct = companyProducts?.find(cp => cp.product_template_id === selectedProductId);
  const basePrice = Number(companyProduct?.base_price) || 0;

  // Calculate prices
  const area = width && height ? (width / 1000) * (height / 1000) : 0;
  const unitPrice = area > 0 ? basePrice * area : 0;
  const totalPrice = unitPrice * quantity;

  const getProductImage = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `/products/${imageUrl}`;
  };

  const handleAdd = () => {
    if (!selectedProduct) return;

    onAdd({
      product_template_id: selectedProductId,
      company_product_id: companyProduct?.id,
      name: companyProduct?.commercial_name || selectedProduct.name,
      base_price: basePrice,
      image_url: selectedProduct.image_url,
      linha: selectedProduct.linha,
      category: selectedProduct.category,
      width,
      height,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleLinhaChange = (value: string) => {
    setSelectedLinha(value);
    setSelectedCategory('');
    setSelectedProductId('');
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedProductId('');
  };

  const canAdd = selectedProductId && width > 0 && height > 0 && quantity > 0;

  return (
    <div className="space-y-6">
      {/* Linha Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Selecione ou digite o nome da linha:</label>
        <Select value={selectedLinha} onValueChange={handleLinhaChange}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione a linha..." />
          </SelectTrigger>
          <SelectContent className="bg-popover border shadow-lg z-50">
            {linhas.map((linha) => (
              <SelectItem key={linha} value={linha!}>
                {linha}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Filter - Only show when linha is selected */}
      {selectedLinha && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedCategory === '' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory('')}
          >
            Todos
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleCategoryChange(cat!)}
            >
              {categoryLabels[cat!] || cat}
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Filtrar nome do produto:</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* Product Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Selecione um produto:</label>
        <ScrollArea className="h-[200px] rounded-lg border bg-muted/30 p-3">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Package className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductId === product.id;
                const imageUrl = getProductImage(product.image_url);
                const hasCompanyProduct = companyProducts?.some(cp => cp.product_template_id === product.id);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className={cn(
                      "relative aspect-square rounded-lg border-2 bg-card overflow-hidden transition-all",
                      "hover:shadow-md hover:border-primary/50",
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
                    )}
                  >
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}

                    {/* Image */}
                    <div className="w-full h-3/4 bg-muted flex items-center justify-center p-2">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Name */}
                    <div className="h-1/4 p-1 flex items-center justify-center bg-background">
                      <span className="text-[10px] font-medium text-center line-clamp-2 leading-tight">
                        {product.name}
                      </span>
                    </div>

                    {/* Active indicator */}
                    {hasCompanyProduct && !isSelected && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Largura do vão (mm)</label>
          <Input
            type="number"
            value={width || ''}
            onChange={(e) => setWidth(Number(e.target.value))}
            placeholder="0 mm"
            min={0}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Altura do vão (mm)</label>
          <Input
            type="number"
            value={height || ''}
            onChange={(e) => setHeight(Number(e.target.value))}
            placeholder="0 mm"
            min={0}
            className="bg-background"
          />
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Quantidade</label>
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          min={1}
          className="bg-background w-24"
        />
      </div>

      {/* Price Summary */}
      {selectedProduct && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Preço Base (m²)</span>
            <span>{formatCurrency(basePrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Área</span>
            <span>{area.toFixed(2)} m²</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Preço Unitário</span>
            <span>{formatCurrency(unitPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Quantidade</span>
            <span>× {quantity}</span>
          </div>
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between font-bold">
              <span>VALOR PRODUTO</span>
              <span className="text-primary text-lg">{formatCurrency(totalPrice)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button 
          type="button" 
          onClick={handleAdd} 
          disabled={!canAdd}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
