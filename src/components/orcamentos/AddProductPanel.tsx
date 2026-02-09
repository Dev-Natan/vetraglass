import { useState, useMemo, useEffect } from 'react';
import { resolveProductImageUrl } from '@/utils/imageUrl';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Check, ArrowLeft, Ruler, DollarSign, Sparkles, Info, GlassWater, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';
import { useProductLinhas } from '@/hooks/useProductLinhas';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ProductGlassPrice {
  id: string;
  glass_type: string;
  glass_color: string;
  thickness_mm: number;
  price_per_sqm: number;
  cost_per_sqm: number;
}

interface AddProductPanelProps {
  onAdd: (product: {
    product_template_id: string | null;
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
    glass_type?: string;
    glass_color?: string;
    glass_thickness?: string;
    glass_price_per_sqm?: number;
    is_custom?: boolean;
  }) => void;
  onCancel: () => void;
}

export function AddProductPanel({ onAdd, onCancel }: AddProductPanelProps) {
  const { currentCompany } = useAuth();
  const { labels: categoryLabels } = useProductCategoryLabels();
  const { data: productLinhas } = useProductLinhas();
  
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [hasGlass, setHasGlass] = useState<boolean>(true);
  const [selectedGlassPriceId, setSelectedGlassPriceId] = useState<string>('');

  // Fetch active company products with template data
  const { data: companyProducts, isLoading } = useQuery({
    queryKey: ['company-products-with-templates', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select(`
          id,
          commercial_name,
          base_price,
          price_per_sqm,
          description,
          image_url,
          linha,
          category,
          is_custom,
          uses_glass,
          product_template_id,
          product_template:product_templates (
            id, name, description, category, linha, image_url
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id
  });

  // Get unique linhas from active company products
  const linhas = useMemo(() => {
    const linhaSet = new Set<string>();
    companyProducts?.forEach(p => {
      const linha = p.linha || (p.product_template as any)?.linha;
      if (linha) linhaSet.add(linha);
    });
    return Array.from(linhaSet).sort();
  }, [companyProducts]);

  // Get categories for selected linha from active company products
  const categories = useMemo(() => {
    if (!selectedLinha) return [];
    const catSet = new Set<string>();
    companyProducts
      ?.filter(p => (p.linha || (p.product_template as any)?.linha) === selectedLinha)
      .forEach(p => {
        const cat = p.category || (p.product_template as any)?.category;
        if (cat) catSet.add(cat);
      });
    return Array.from(catSet).sort();
  }, [companyProducts, selectedLinha]);

  // Get filtered products from active company products
  const filteredProducts = useMemo(() => {
    // Se não há linha selecionada, não mostrar produtos
    if (!selectedLinha) return [];
    
    let products = (companyProducts || []).map(cp => {
      const template = cp.product_template as any;
      return {
        id: cp.id,
        name: cp.commercial_name || template?.name || 'Produto',
        description: cp.description || template?.description,
        category: cp.category || template?.category || 'other',
        linha: cp.linha || template?.linha || 'Personalizado',
        image_url: cp.image_url || template?.image_url || null,
        is_custom: cp.is_custom ?? false,
        uses_glass: cp.uses_glass ?? true,
        company_product: cp,
        product_template_id: cp.product_template_id
      };
    });
    
    // Filtra pela linha selecionada
    products = products.filter(p => p.linha === selectedLinha);
    
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
  }, [companyProducts, selectedLinha, selectedCategory, searchQuery]);

  const selectedProduct = filteredProducts?.find(p => p.id === selectedProductId);
  const companyProduct = selectedProduct?.company_product;

  // Fetch glass prices for selected product
  const { data: productGlassPrices } = useQuery({
    queryKey: ['product-glass-prices', companyProduct?.id],
    queryFn: async () => {
      if (!companyProduct?.id) return [];
      const { data, error } = await supabase
        .from('product_glass_prices')
        .select('*')
        .eq('company_product_id', companyProduct.id)
        .eq('is_active', true)
        .order('glass_type')
        .order('glass_color')
        .order('thickness_mm');
      
      if (error) throw error;
      return data as ProductGlassPrice[];
    },
    enabled: !!companyProduct?.id
  });

  // Check if product uses glass
  const productUsesGlass = (companyProduct as any)?.uses_glass ?? true;
  const hasGlassPrices = (productGlassPrices?.length || 0) > 0;

  // Set default glass price when product changes
  useEffect(() => {
    if (productGlassPrices?.length && !selectedGlassPriceId) {
      setSelectedGlassPriceId(productGlassPrices[0].id);
    }
  }, [productGlassPrices, selectedGlassPriceId]);

  // Reset glass selection when product changes
  useEffect(() => {
    setSelectedGlassPriceId('');
    setHasGlass(productUsesGlass);
  }, [companyProduct?.id, productUsesGlass]);

  // Get selected glass price details
  const selectedGlassPrice = productGlassPrices?.find(p => p.id === selectedGlassPriceId);
  const glassPricePerSqm = selectedGlassPrice?.price_per_sqm || 0;
  
  // Use price_per_sqm as the primary pricing method (fallback when no glass selected)
  const productBasePricePerSqm = Number((companyProduct as any)?.price_per_sqm) || Number(companyProduct?.base_price) || 0;
  
  // Se produto usa vidro E tem vidro selecionado, usar preço do vidro (SUBSTITUI o base)
  // Caso contrário, usar preço base do produto
  const finalPricePerSqm = 
    (hasGlass && productUsesGlass && glassPricePerSqm > 0) 
      ? glassPricePerSqm  // Preço definido pelo vidro
      : productBasePricePerSqm; // Preço base (quando não usa vidro ou não tem vidro configurado)
  
  const basePrice = customPrice !== null ? customPrice : finalPricePerSqm;

  // Calculate prices: area in m² × price per m²
  const area = width && height ? (width / 1000) * (height / 1000) : 0;
  const unitPrice = area > 0 ? basePrice * area : 0;
  const totalPrice = unitPrice * quantity;

  // Check if the selected product is from "Temperado" line (always has glass)
  const isTemperadoLine = selectedProduct?.linha?.toLowerCase().includes('temperado');

  // Reset custom price when product changes and set glass based on line
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setCustomPrice(null);
    setSelectedGlassPriceId('');
    
    // Auto-enable glass for Temperado line products
    const product = filteredProducts?.find(p => p.id === productId);
    if (product?.linha?.toLowerCase().includes('temperado')) {
      setHasGlass(true);
    }
  };

  const getProductImage = resolveProductImageUrl;

  const handleAdd = () => {
    if (!selectedProduct) return;

    onAdd({
      product_template_id: selectedProduct.is_custom ? null : selectedProduct.product_template_id,
      company_product_id: companyProduct?.id,
      name: selectedProduct.name,
      base_price: basePrice,
      image_url: selectedProduct.image_url,
      linha: selectedProduct.linha,
      category: selectedProduct.category,
      width,
      height,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      has_glass: hasGlass && productUsesGlass,
      glass_type: hasGlass && selectedGlassPrice ? selectedGlassPrice.glass_type : undefined,
      glass_color: hasGlass && selectedGlassPrice ? selectedGlassPrice.glass_color : undefined,
      glass_thickness: hasGlass && selectedGlassPrice ? `${selectedGlassPrice.thickness_mm}mm` : undefined,
      glass_price_per_sqm: hasGlass ? glassPricePerSqm : undefined,
      is_custom: selectedProduct.is_custom,
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
          Selecione um produto {selectedLinha ? `(${filteredProducts.length})` : ''}
        </label>
        <ScrollArea className="h-[240px] rounded-xl border bg-muted/20 p-3">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : !selectedLinha ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Layers className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Selecione uma linha</p>
              <p className="text-xs mt-1 text-center max-w-[200px]">
                Escolha a linha do produto no filtro acima para ver os produtos disponíveis
              </p>
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
                const isCustomProduct = product.is_custom;

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

                    {/* Custom product badge */}
                    {isCustomProduct && (
                      <div className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-warning flex items-center justify-center shadow-md" title="Produto Personalizado">
                        <Sparkles className="w-3.5 h-3.5 text-warning-foreground" />
                      </div>
                    )}

                    {/* Image */}
                    <div className="w-full h-[70%] bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center p-2">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling;
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={cn("items-center justify-center", imageUrl ? "hidden" : "flex")}>
                        <Package className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    </div>

                    {/* Name */}
                    <div className="h-[30%] p-1.5 flex items-center justify-center bg-background">
                      <span className="text-[9px] sm:text-[10px] font-medium text-center line-clamp-2 leading-tight">
                        {product.name}
                      </span>
                    </div>

                    {/* Active indicator - only for non-custom products that don't have selection */}
                    {!isCustomProduct && !isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-background" />
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

        {/* Glass Options - Only show if product uses glass */}
        {productUsesGlass && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <GlassWater className="w-3 h-3" />
                Vidro:
              </label>
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
              <div className="space-y-3">
                {/* Glass Type + Thickness Selector - From product's glass prices */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tipo e Espessura do Vidro</label>
                  {hasGlassPrices ? (
                    <Select value={selectedGlassPriceId} onValueChange={setSelectedGlassPriceId}>
                      <SelectTrigger className="bg-background h-10">
                        <SelectValue placeholder="Selecione o vidro..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        {productGlassPrices?.map((gp) => (
                          <SelectItem key={gp.id} value={gp.id}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span>{gp.glass_type} {gp.glass_color} {gp.thickness_mm}mm</span>
                              <span className="text-muted-foreground text-xs">
                                {formatCurrency(gp.price_per_sqm)}/m²
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30">
                      <Info className="w-4 h-4 text-warning shrink-0" />
                      <span className="text-xs text-foreground">
                        Nenhum preço de vidro cadastrado para este produto. Configure em Produtos → Preços.
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Glass Price Info */}
                {hasGlass && productUsesGlass && glassPricePerSqm > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent border border-primary/20">
                    <GlassWater className="w-4 h-4 text-primary" />
                    <span className="text-xs text-foreground">
                      Preço definido pelo vidro {selectedGlassPrice?.glass_color} {selectedGlassPrice?.thickness_mm}mm: 
                      <strong className="ml-1">{formatCurrency(glassPricePerSqm)}/m²</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
              <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {hasGlass && productUsesGlass && glassPricePerSqm > 0 
                        ? `Preço do vidro: ${formatCurrency(glassPricePerSqm)}/m²`
                        : `Preço base: ${formatCurrency(productBasePricePerSqm)}/m²`
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>
              </label>
              <Input
                type="number"
                value={customPrice !== null ? customPrice : finalPricePerSqm || ''}
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
              className="flex-1 sm:flex-none bg-success hover:bg-success/90 text-success-foreground px-6"
            >
              Adicionar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
