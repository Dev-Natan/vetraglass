import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Check, ArrowLeft, Ruler, DollarSign } from 'lucide-react';
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
    has_glass?: boolean;
    glass_color?: string;
    glass_thickness?: string;
  }) => void;
  onCancel: () => void;
}

const glassColors = [
  { value: 'incolor', label: 'Incolor' },
  { value: 'verde', label: 'Verde' },
  { value: 'fume', label: 'Fumê' },
];

const glassThicknesses = [
  { value: '4mm', label: '4mm' },
  { value: '6mm', label: '6mm' },
  { value: '8mm', label: '8mm' },
  { value: '10mm', label: '10mm' },
];

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
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [hasGlass, setHasGlass] = useState<boolean>(true);
  const [glassColor, setGlassColor] = useState<string>('incolor');
  const [glassThickness, setGlassThickness] = useState<string>('4mm');

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
  const defaultBasePrice = Number(companyProduct?.base_price) || 0;
  const basePrice = customPrice !== null ? customPrice : defaultBasePrice;

  // Calculate prices
  const area = width && height ? (width / 1000) * (height / 1000) : 0;
  const unitPrice = area > 0 ? basePrice * area : 0;
  const totalPrice = unitPrice * quantity;

  // Check if the selected product is from "Temperado" line (always has glass)
  const isTemperadoLine = selectedProduct?.linha?.toLowerCase().includes('temperado');

  // Reset custom price when product changes and set glass based on line
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setCustomPrice(null);
    
    // Auto-enable glass for Temperado line products
    const product = productTemplates?.find(p => p.id === productId);
    if (product?.linha?.toLowerCase().includes('temperado')) {
      setHasGlass(true);
    }
  };

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
      has_glass: hasGlass,
      glass_color: hasGlass ? glassColor : undefined,
      glass_thickness: hasGlass ? glassThickness : undefined,
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
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed Header - Filters */}
      <div className="shrink-0 space-y-4 pb-4 border-b mb-4">
        {/* Linha & Search Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linha</label>
            <Select value={selectedLinha} onValueChange={handleLinhaChange}>
              <SelectTrigger className="bg-background h-10">
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background h-10"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        {selectedLinha && categories.length > 0 && (
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-1">
              <Badge
                variant={selectedCategory === '' ? 'default' : 'outline'}
                className="cursor-pointer shrink-0 h-8 px-4"
                onClick={() => setSelectedCategory('')}
              >
                Todos
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  className="cursor-pointer shrink-0 h-8 px-4"
                  onClick={() => handleCategoryChange(cat!)}
                >
                  {categoryLabels[cat!] || cat}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Scrollable Middle - Products Grid */}
      <div className="flex-1 min-h-0 mb-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Selecione um produto ({filteredProducts.length})
        </label>
        <ScrollArea className="h-[240px] rounded-xl border bg-muted/20 p-3">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Nenhum produto encontrado</p>
              <p className="text-xs mt-1">Tente ajustar os filtros</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductId === product.id;
                const imageUrl = getProductImage(product.image_url);
                const hasCompanyProduct = companyProducts?.some(cp => cp.product_template_id === product.id);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSelect(product.id)}
                    className={cn(
                      "relative aspect-square rounded-xl border-2 bg-card overflow-hidden transition-all",
                      "hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]",
                      isSelected ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border"
                    )}
                  >
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}

                    {/* Image */}
                    <div className="w-full h-[70%] bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center p-2">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package className="w-10 h-10 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Name */}
                    <div className="h-[30%] p-1.5 flex items-center justify-center bg-background">
                      <span className="text-[9px] sm:text-[10px] font-medium text-center line-clamp-2 leading-tight">
                        {product.name}
                      </span>
                    </div>

                    {/* Active indicator */}
                    {hasCompanyProduct && !isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Fixed Bottom - Dimensions & Pricing */}
      <div className="shrink-0 space-y-4 pt-4 border-t">
        {/* Selected Product Preview */}
        {selectedProduct && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {getProductImage(selectedProduct.image_url) ? (
                <img
                  src={getProductImage(selectedProduct.image_url)!}
                  alt={selectedProduct.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Package className="w-6 h-6 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedProduct.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedProduct.linha} • {categoryLabels[selectedProduct.category] || selectedProduct.category}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {formatCurrency(basePrice)}/m²
            </Badge>
          </div>
        )}

        {/* Glass Options */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">Vidro:</label>
            <div className="flex gap-2">
              <Badge
                variant={hasGlass ? 'default' : 'outline'}
                className="cursor-pointer h-8 px-4"
                onClick={() => setHasGlass(true)}
              >
                Com Vidro
              </Badge>
              <Badge
                variant={!hasGlass ? 'default' : 'outline'}
                className={cn(
                  "cursor-pointer h-8 px-4",
                  isTemperadoLine && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => !isTemperadoLine && setHasGlass(false)}
                title={isTemperadoLine ? "Produtos da linha Temperado sempre incluem vidro" : undefined}
              >
                Sem Vidro
              </Badge>
              {isTemperadoLine && (
                <span className="text-xs text-muted-foreground italic ml-2">
                  (Linha Temperado sempre inclui vidro)
                </span>
              )}
            </div>
          </div>
          
          {hasGlass && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cor do Vidro</label>
                <Select value={glassColor} onValueChange={setGlassColor}>
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {glassColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Espessura</label>
                <Select value={glassThickness} onValueChange={setGlassThickness}>
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {glassThicknesses.map((thickness) => (
                      <SelectItem key={thickness.value} value={thickness.value}>
                        {thickness.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Dimensions, Price & Quantity */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Ruler className="w-3 h-3" />
              Largura (mm)
            </label>
            <Input
              type="number"
              value={width || ''}
              onChange={(e) => setWidth(Number(e.target.value))}
              placeholder="0"
              min={0}
              className="bg-background h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Ruler className="w-3 h-3 rotate-90" />
              Altura (mm)
            </label>
            <Input
              type="number"
              value={height || ''}
              onChange={(e) => setHeight(Number(e.target.value))}
              placeholder="0"
              min={0}
              className="bg-background h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Preço/m²
            </label>
            <Input
              type="number"
              value={customPrice !== null ? customPrice : defaultBasePrice || ''}
              onChange={(e) => setCustomPrice(e.target.value ? Number(e.target.value) : null)}
              placeholder="0.00"
              min={0}
              step="0.01"
              className="bg-background h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Qtd</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min={1}
              className="bg-background h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Área</label>
            <div className="h-10 px-3 rounded-md border bg-muted/50 flex items-center justify-center font-medium text-sm">
              {area.toFixed(2)} m²
            </div>
          </div>
        </div>

        {/* Price Summary & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border">
          <div className="flex-1 flex items-center gap-4">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Unitário</span>
              <p className="font-semibold">{formatCurrency(unitPrice)}</p>
            </div>
            <span className="text-muted-foreground">×</span>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Qtd</span>
              <p className="font-semibold">{quantity}</p>
            </div>
            <span className="text-muted-foreground">=</span>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
              <p className="text-xl font-bold text-primary">{formatCurrency(totalPrice)}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button 
              type="button" 
              onClick={handleAdd} 
              disabled={!canAdd}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-6"
            >
              Adicionar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
