import { useState, useMemo, useEffect } from 'react';
import { useCompositionPricing } from '@/hooks/useCompositionPricing';
import { resolveProductImageUrl, resolveItemImageUrl } from '@/utils/imageUrl';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Check, ArrowLeft, Ruler, DollarSign, Sparkles, Info, GlassWater, Layers, Palette, Frame, Maximize2, FileText, Plus, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useProductCategoryLabels, useProductCategories } from '@/hooks/useProductCategories';
import { useProductLinhas } from '@/hooks/useProductLinhas';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProductAluminumPriceOptions } from '@/hooks/useProductAluminumPrices';
import { useGlassStockOptions } from '@/hooks/useGlassStockOptions';
import { buildCategoryNormalizer } from '@/utils/normalizeCategory';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AddItemPanel } from './AddItemPanel';

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
    width_b?: number;
    height_b?: number;
    width_c?: number;
    height_c?: number;
    vao_width?: number;
    vao_height?: number;
    vao_width_b?: number;
    vao_height_b?: number;
    vao_width_c?: number;
    vao_height_c?: number;
    quantity: number;
    leaves_count?: number;
    glasses_count?: number;
    panels_count?: number;
    sides_count?: number;
    unit_price: number;
    total_price: number;
    has_glass?: boolean;
    glass_type?: string;
    glass_color?: string;
    glass_thickness?: string;
    glass_price_per_sqm?: number;
    aluminum_color?: string;
    is_custom?: boolean;
    include_contramarco?: boolean;
    excluded_optional_ids?: string[];
    notes?: string;
    components?: Array<{
      description: string;
      quantity: number;
      unit_price: number;
    }>;
  }) => void;
  onCancel: () => void;
}

export function AddProductPanel({ onAdd, onCancel }: AddProductPanelProps) {
  const { currentCompany } = useAuth();
  const { labels: categoryLabels } = useProductCategoryLabels();
  const { data: adminCategories } = useProductCategories();
  const categoryNormalizer = useMemo(
    () => buildCategoryNormalizer(adminCategories?.map(c => ({ slug: c.slug, name: c.name }))),
    [adminCategories]
  );
  const { data: productLinhas } = useProductLinhas();
  
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [width, setWidth] = useState<number>(0); // Produto
  const [height, setHeight] = useState<number>(0); // Produto
  const [vaoWidth, setVaoWidth] = useState<number>(0);
  const [vaoHeight, setVaoHeight] = useState<number>(0);
  const [vaoWidthB, setVaoWidthB] = useState<number>(0);
  const [vaoHeightB, setVaoHeightB] = useState<number>(0);
  const [widthB, setWidthB] = useState<number>(0);
  const [heightB, setHeightB] = useState<number>(0);
  const [folgaWidth, setFolgaWidth] = useState<number>(0);
  const [folgaHeight, setFolgaHeight] = useState<number>(0);
  const [useVao, setUseVao] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [hasGlass, setHasGlass] = useState<boolean>(true);
  const [selectedGlassPriceId, setSelectedGlassPriceId] = useState<string>('');
  const [selectedGlassThickness, setSelectedGlassThickness] = useState<string>('');
  const [selectedGlassColor, setSelectedGlassColor] = useState<string>('');
  const [selectedAluminumColor, setSelectedAluminumColor] = useState<string>('');
  const [customAluminumColor, setCustomAluminumColor] = useState<string>('');
  const [hasAcabamento, setHasAcabamento] = useState<boolean>(true);
  const [excludedOptionalIds, setExcludedOptionalIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [components, setComponents] = useState<Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>>([]);

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
          pricing_type,
          product_template_id,
          leaves_count,
          glasses_count,
          panels_count,
          sides_count,
          product_template:product_templates (
            id, name, description, category, linha, image_url, has_multiple_sides,
            default_leaves_count, default_glasses_count, default_panels_count, default_sides_count
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

  // Get categories for selected linha (normalized via Admin dictionary)
  const categories = useMemo(() => {
    if (!selectedLinha) return [];
    const catMap = new Map<string, string>(); // canonical key -> display label
    companyProducts
      ?.filter(p => (p.linha || (p.product_template as any)?.linha) === selectedLinha)
      .forEach(p => {
        const raw = p.category || (p.product_template as any)?.category;
        const key = categoryNormalizer.key(raw);
        const label = categoryNormalizer.normalize(raw);
        if (label && !catMap.has(key)) catMap.set(key, label);
      });
    return Array.from(catMap.values()).sort();
  }, [companyProducts, selectedLinha, categoryNormalizer]);

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
        product_template_id: cp.product_template_id,
        has_multiple_sides: (template as any)?.has_multiple_sides ?? false
      };
    });
    
    // Filtra pela linha selecionada
    products = products.filter(p => p.linha === selectedLinha);
    
    if (selectedCategory) {
      products = products.filter(p => categoryNormalizer.match(p.category, selectedCategory));
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

  // Common aluminum finish colors (informational, for non-aluminum-priced products)
  const defaultAluminumColors = [
    'Branco', 'Preto', 'Bronze', 'Natural Fosco', 'Outros'
  ];

  const defaultGlassThicknessOptions = ['3', '4', '6', '8', '10', '12'];
  const defaultGlassColorOptions = ['Incolor', 'Verde', 'Fumer', 'Bronze', 'Jateado', 'Refletivo'];

  // Get pricing type for the product
  const pricingType = companyProduct?.pricing_type || (companyProduct?.uses_glass ? 'glass' : 'fixed');
  const productUsesGlass = pricingType === 'glass';
  const productUsesAluminum = pricingType === 'aluminum';
  const productUsesComposition = pricingType === 'composition';
  const hasGlassPrices = (productGlassPrices?.length || 0) > 0;

  // Fetch aluminum color prices (only when product uses aluminum pricing)
  const { data: aluminumPriceOptions } = useProductAluminumPriceOptions(
    productUsesAluminum ? (companyProduct?.id || null) : null
  );
  const hasAluminumPrices = (aluminumPriceOptions?.length || 0) > 0;

  // ── Opções de vidro vindas do ESTOQUE (company_items unit = m²) ──
  const glassStock = useGlassStockOptions(!!selectedProductId);

  // Unique glass thicknesses and colors derived from the product's glass price catalog
  // ⬇︎ Quando o produto NÃO tem catálogo próprio (product_glass_prices), caímos no estoque
  const glassThicknessOptions = useMemo(() => {
    const set = new Set<string>();
    productGlassPrices?.forEach((gp) => set.add(String(gp.thickness_mm)));
    glassStock.thicknessOptions.forEach((t) => set.add(t));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [productGlassPrices, glassStock.thicknessOptions]);

  const glassColorOptions = useMemo(() => {
    const set = new Set<string>();
    productGlassPrices
      ?.filter((gp) => !selectedGlassThickness || String(gp.thickness_mm) === selectedGlassThickness)
      .forEach((gp) => set.add(gp.glass_color));
    glassStock.colorOptionsFor(selectedGlassThickness || undefined).forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [productGlassPrices, glassStock, selectedGlassThickness]);


  // Set defaults when product changes
  useEffect(() => {
    if (productGlassPrices?.length && !selectedGlassPriceId) {
      const first = productGlassPrices[0];
      setSelectedGlassPriceId(first.id);
      setSelectedGlassThickness(String(first.thickness_mm));
      setSelectedGlassColor(first.glass_color);
    }
  }, [productGlassPrices, selectedGlassPriceId]);

  // Sync selectedGlassPriceId whenever thickness/color change
  useEffect(() => {
    if (!selectedGlassThickness || !selectedGlassColor) return;
    const match = productGlassPrices?.find(
      gp => String(gp.thickness_mm) === selectedGlassThickness && gp.glass_color === selectedGlassColor
    );
    if (match && match.id !== selectedGlassPriceId) {
      setSelectedGlassPriceId(match.id);
    }
  }, [selectedGlassThickness, selectedGlassColor, productGlassPrices, selectedGlassPriceId]);

  // Set default aluminum color when product changes (for aluminum-priced products)
  useEffect(() => {
    if (productUsesAluminum && aluminumPriceOptions?.length && !selectedAluminumColor) {
      setSelectedAluminumColor(aluminumPriceOptions[0].value);
    }
  }, [aluminumPriceOptions, selectedAluminumColor, productUsesAluminum]);

  // Sync Vão - Folga = Produto
  useEffect(() => {
    if (useVao) {
      setWidth(Math.max(0, vaoWidth - folgaWidth));
      setHeight(Math.max(0, vaoHeight - folgaHeight));
      setWidthB(Math.max(0, vaoWidthB - folgaWidth));
      setHeightB(Math.max(0, vaoHeightB - folgaHeight));
    }
  }, [vaoWidth, vaoHeight, vaoWidthB, vaoHeightB, folgaWidth, folgaHeight, useVao]);

  // Set default dimensions from vao if not using vao input directly
  useEffect(() => {
    if (!useVao) {
      setVaoWidth(width + folgaWidth);
      setVaoHeight(height + folgaHeight);
      setVaoWidthB(widthB + folgaWidth);
      setVaoHeightB(heightB + folgaHeight);
    }
  }, [width, height, widthB, heightB, folgaWidth, folgaHeight, !useVao]);


  // Get selected glass price details
  const selectedGlassPrice = productGlassPrices?.find((p) => p.id === selectedGlassPriceId);
  // ⬇︎ Match no estoque por Cor+Espessura selecionadas
  const stockGlassMatch = useMemo(
    () => glassStock.findMatch(selectedGlassThickness, selectedGlassColor),
    [glassStock, selectedGlassThickness, selectedGlassColor],
  );
  const stockGlassPricePerSqm = stockGlassMatch?.salePricePerSqm || 0;
  // Catálogo tem prioridade; senão, usa estoque
  const glassPricePerSqm = selectedGlassPrice?.price_per_sqm || stockGlassPricePerSqm || 0;


  // Get selected aluminum price (only for aluminum-priced products)
  const selectedAluminumPriceOption = productUsesAluminum 
    ? aluminumPriceOptions?.find(p => p.value === selectedAluminumColor) 
    : null;
  const aluminumPricePerSqm = selectedAluminumPriceOption?.pricePerSqm || 0;

  // Use price_per_sqm as the primary pricing method
  const productBasePricePerSqm = Number((companyProduct as any)?.price_per_sqm) || Number(companyProduct?.base_price) || 0;
  
  // Composition-based dynamic pricing
  const compositionPricing = useCompositionPricing({
    companyProductId: companyProduct?.id,
    width: width || 1000,
    height: height || 1000,
    widthB: widthB || 0,
    heightB: heightB || 0,
    leaves_count: companyProduct?.leaves_count || 1,
    glasses_count: companyProduct?.glasses_count || 1,
    panels_count: companyProduct?.panels_count || 1,
    sides_count: companyProduct?.sides_count || 1,
    quantity: quantity || 1,
    enabled: !!companyProduct?.id && width > 0 && height > 0,
    excludeOptionalIds: excludedOptionalIds,
  });

  // Get optional items for toggle UI
  const optionalItems = compositionPricing.optionalItems || [];

  // Determine final price based on pricing type
  const finalPricePerSqm = (() => {
    // Vidro do catálogo OU do estoque (cor+espessura selecionadas)
    if (hasGlass && glassPricePerSqm > 0) {
      return glassPricePerSqm;
    }
    if (productUsesAluminum && aluminumPricePerSqm > 0) {
      return aluminumPricePerSqm;
    }
    return productBasePricePerSqm;
  })();

  
  const basePrice = customPrice !== null ? customPrice : finalPricePerSqm;

  // Calculate prices: use composition when available, otherwise area × price/m²
  const area = width && height ? ((width + (selectedProduct?.has_multiple_sides ? widthB : 0)) / 1000) * (height / 1000) : 0;
  const unitPrice = (productUsesComposition && compositionPricing.isReady)
    ? compositionPricing.compositionCostPerUnit
    : (area > 0 ? basePrice * area : 0);
  const componentsTotal = components.reduce((sum, c) => sum + (c.unit_price * c.quantity), 0);
  const totalPrice = ((productUsesComposition && compositionPricing.isReady)
    ? compositionPricing.totalCost
    : unitPrice * quantity) + componentsTotal;

  // Check if the selected product is from "Temperado" line (always has glass)
  const isTemperadoLine = selectedProduct?.linha?.toLowerCase().includes('temperado');

  // Reset custom price when product changes and set glass based on line
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setCustomPrice(null);
    setSelectedGlassPriceId('');
    setSelectedGlassThickness('');
    setSelectedGlassColor('');
    setSelectedAluminumColor('');
    setCustomAluminumColor('');
    // Auto-enable glass for Temperado line products
    const product = filteredProducts?.find(p => p.id === productId);
    if (product?.linha?.toLowerCase().includes('temperado')) {
      setHasGlass(true);
    }
  };

  const getProductImage = resolveProductImageUrl;

  const handleAdd = () => {
    if (!selectedProduct) return;

    // For aluminum-priced products, the color name comes from the price option
    // For other products, it comes from the simple selector
    const aluminumColorName = productUsesAluminum 
      ? (selectedAluminumPriceOption?.colorName || '') 
      : (selectedAluminumColor === 'Outros' ? customAluminumColor : selectedAluminumColor);

    onAdd({
      product_template_id: selectedProduct.is_custom ? null : selectedProduct.product_template_id,
      company_product_id: companyProduct?.id,
      name: useVao ? `${selectedProduct.name} [Vão: ${vaoWidth}x${vaoHeight}mm]` : selectedProduct.name,
      base_price: (productUsesComposition && compositionPricing.isReady) ? compositionPricing.compositionCostPerSqm : basePrice,
      image_url: selectedProduct.image_url,
      linha: selectedProduct.linha,
      category: selectedProduct.category,
      width,
      height,
      width_b: selectedProduct.has_multiple_sides ? widthB : undefined,
      height_b: selectedProduct.has_multiple_sides ? heightB : undefined,
      width_c: 0, // Placeholder for side C
      height_c: 0,
      vao_width: useVao ? vaoWidth : undefined,
      vao_height: useVao ? vaoHeight : undefined,
      vao_width_b: (useVao && selectedProduct.has_multiple_sides) ? vaoWidthB : undefined,
      vao_height_b: (useVao && selectedProduct.has_multiple_sides) ? vaoHeightB : undefined,
      quantity,
      leaves_count: companyProduct?.leaves_count || 1,
      glasses_count: companyProduct?.glasses_count || 1,
      panels_count: companyProduct?.panels_count || 1,
      sides_count: companyProduct?.sides_count || 1,
      unit_price: unitPrice,
      total_price: totalPrice,
      has_glass: hasGlass && (!!selectedGlassThickness || !!selectedGlassColor || productUsesGlass),
      glass_type: hasGlass && selectedGlassPrice ? selectedGlassPrice.glass_type : undefined,
      glass_color: hasGlass ? (selectedGlassPrice?.glass_color || selectedGlassColor || undefined) : undefined,
      glass_thickness: hasGlass ? (selectedGlassPrice ? `${selectedGlassPrice.thickness_mm}mm` : (selectedGlassThickness ? `${selectedGlassThickness}mm` : undefined)) : undefined,
      glass_price_per_sqm: hasGlass ? glassPricePerSqm : undefined,
      aluminum_color: aluminumColorName || undefined,
      is_custom: selectedProduct.is_custom,
      include_contramarco: excludedOptionalIds.length === 0,
      excluded_optional_ids: excludedOptionalIds.length > 0 ? excludedOptionalIds : undefined,
      notes: notes.trim() || undefined,
      components: components.length > 0 ? components : undefined,
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
      {/* ── Etapa 1: Seleção do Produto (oculta quando um produto está selecionado) ── */}
      {!selectedProduct && (
        <>
          {/* Fixed Header - Filters */}
          <div className="shrink-0 space-y-4 pb-4 border-b mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linha</label>
                <Select value={selectedLinha} onValueChange={handleLinhaChange}>
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Selecione a linha..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {linhas.map((linha) => (
                      <SelectItem key={linha} value={linha!}>{linha}</SelectItem>
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

            {selectedLinha && categories.length > 0 && (
              <div className="flex flex-wrap gap-2 w-full">
                <Badge
                  variant={selectedCategory === '' ? 'default' : 'outline'}
                  className="cursor-pointer h-8 px-4"
                  onClick={() => setSelectedCategory('')}
                >
                  Todos
                </Badge>
                {categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant={categoryNormalizer.match(selectedCategory, cat) ? 'default' : 'outline'}
                    className="cursor-pointer h-8 px-4"
                    onClick={() => handleCategoryChange(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Grid de produtos ocupa o espaço restante */}
          <div className="flex-1 min-h-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Selecione um produto {selectedLinha ? `(${filteredProducts.length})` : ''}
            </label>
            <ScrollArea className="h-[calc(100%-1.75rem)] rounded-xl border bg-muted/20 p-3">
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
                    const imageUrl = getProductImage(product.image_url);
                    const isCustomProduct = product.is_custom;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product.id)}
                        className={cn(
                          "relative aspect-square rounded-xl border-2 bg-card overflow-hidden transition-all",
                          "hover:shadow-lg hover:border-primary/50 hover:scale-[1.02] border-border"
                        )}
                      >
                        {isCustomProduct && (
                          <div className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-warning flex items-center justify-center shadow-md" title="Produto Personalizado">
                            <Sparkles className="w-3.5 h-3.5 text-warning-foreground" />
                          </div>
                        )}
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
                        <div className="h-[30%] p-1.5 flex items-center justify-center bg-background">
                          <span className="text-[9px] sm:text-[10px] font-medium text-center line-clamp-2 leading-tight">
                            {product.name}
                          </span>
                        </div>
                        {!isCustomProduct && (
                          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-background" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Rodapé apenas com Cancelar quando ainda não há produto */}
          <div className="shrink-0 pt-4 mt-4 border-t flex justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          </div>
        </>
      )}

      {/* ── Etapa 2: Configuração focada do produto selecionado ── */}
      {selectedProduct && (
        <>
          {/* Header do produto com voltar */}
          <div className="shrink-0 flex items-center gap-3 p-3 rounded-xl bg-muted/40 border mb-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedProductId('')}
              title="Trocar produto"
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-14 h-14 rounded-lg bg-background flex items-center justify-center shrink-0 overflow-hidden border">
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
              <p className="font-semibold text-sm leading-tight truncate">{selectedProduct.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {categoryLabels[selectedProduct.category] || selectedProduct.category}
                {companyProduct?.id && (
                  <span className="ml-1 font-mono">· #{String(companyProduct.id).slice(0, 8).toUpperCase()}</span>
                )}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProductId('')}>
              Trocar
            </Button>
          </div>

          {/* Área de configuração rolável internamente */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
            {/* Dimensões e quantidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Largura {selectedProduct.has_multiple_sides && "(Lado A)"} (mm) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  value={width || ''}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  placeholder="1000"
                  className="bg-background h-10"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Altura {selectedProduct.has_multiple_sides && "(Lado A)"} (mm) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  value={height || ''}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  placeholder="2000"
                  className="bg-background h-10"
                />
              </div>

              {selectedProduct.has_multiple_sides && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Largura Lado B (mm) <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      value={widthB || ''}
                      onChange={(e) => setWidthB(Number(e.target.value))}
                      placeholder="1000"
                      className="bg-background h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Altura Lado B (mm) <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      value={heightB || ''}
                      onChange={(e) => setHeightB(Number(e.target.value))}
                      placeholder="2000"
                      className="bg-background h-10"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Quantidade <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min={1}
                  className="bg-background h-10"
                />
              </div>
            </div>

            {/* Espessura/Cor do vidro e Cor do perfil */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Espessura do vidro</label>
                <Select
                  value={selectedGlassThickness}
                  onValueChange={(v) => { setSelectedGlassThickness(v); setHasGlass(true); }}
                >
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {(glassThicknessOptions.length > 0 ? glassThicknessOptions : defaultGlassThicknessOptions).map((t) => (
                      <SelectItem key={String(t)} value={String(t)}>{t}mm</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Cor do vidro</label>
                <Select
                  value={selectedGlassColor}
                  onValueChange={(v) => { setSelectedGlassColor(v); setHasGlass(true); }}
                >
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {(glassColorOptions.length > 0 ? glassColorOptions : defaultGlassColorOptions).map((c) => {
                      const stockOpt = glassStock.findMatch(selectedGlassThickness, c);
                      return (
                        <SelectItem key={c} value={c}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span>{c}</span>
                            {stockOpt && stockOpt.salePricePerSqm > 0 && (
                              <span className="text-muted-foreground text-xs">{formatCurrency(stockOpt.salePricePerSqm)}/m²</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {stockGlassMatch && (
                  <p className="text-[11px] text-muted-foreground">
                    Estoque: <span className="font-medium">{stockGlassMatch.displayName}</span> · {formatCurrency(stockGlassMatch.salePricePerSqm)}/m²
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Cor do perfil</label>
                <div className="space-y-2">
                  {productUsesAluminum && hasAluminumPrices ? (
                    <Select value={selectedAluminumColor} onValueChange={setSelectedAluminumColor}>
                      <SelectTrigger className="bg-background h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        {aluminumPriceOptions?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span>{opt.label}</span>
                              <span className="text-muted-foreground text-xs">
                                {formatCurrency(opt.pricePerSqm)}/m²
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={selectedAluminumColor} onValueChange={setSelectedAluminumColor}>
                      <SelectTrigger className="bg-background h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        {defaultAluminumColors.map((color) => (
                          <SelectItem key={color} value={color}>{color}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {selectedAluminumColor === 'Outros' && (
                    <Input
                      placeholder="Digite a cor..."
                      value={customAluminumColor}
                      onChange={(e) => setCustomAluminumColor(e.target.value)}
                      className="bg-background h-10"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Valor R$ / m² */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Valor R$ / m² <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                value={customPrice !== null ? customPrice : finalPricePerSqm || ''}
                onChange={(e) => setCustomPrice(e.target.value ? Number(e.target.value) : null)}
                placeholder="0.00"
                min={0}
                step="0.01"
                className="bg-background h-10 font-mono"
              />
            </div>

            {/* Componentes / Acessórios */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  Componentes / Acessórios
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => setShowAddComponent(true)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              {components.length > 0 && (
                <div className="space-y-2">
                  {components.map((comp, compIndex) => (
                    <div key={compIndex} className="flex gap-2 items-end bg-muted/30 p-2 rounded-lg border border-dashed">
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">Descrição</label>
                        <Input
                          value={comp.description}
                          onChange={(e) => {
                            const newComps = [...components];
                            newComps[compIndex].description = e.target.value;
                            setComponents(newComps);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="w-16">
                        <label className="text-[10px] text-muted-foreground block mb-1">Qtd</label>
                        <Input
                          type="number"
                          value={comp.quantity}
                          onChange={(e) => {
                            const newComps = [...components];
                            newComps[compIndex].quantity = Number(e.target.value);
                            setComponents(newComps);
                          }}
                          min={1}
                          className="h-8 text-xs px-1"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] text-muted-foreground block mb-1">Preço Unit.</label>
                        <Input
                          type="number"
                          value={comp.unit_price}
                          onChange={(e) => {
                            const newComps = [...components];
                            newComps[compIndex].unit_price = Number(e.target.value);
                            setComponents(newComps);
                          }}
                          min={0}
                          step={0.01}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setComponents(components.filter((_, i) => i !== compIndex));
                        }}
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Dialog open={showAddComponent} onOpenChange={setShowAddComponent}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                  <DialogHeader className="p-6 pb-4 shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                      <Layers className="w-5 h-5" />
                      Adicionar Componente / Acessório
                    </DialogTitle>
                    <DialogDescription>
                      Selecione um item do estoque para adicionar a este produto.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <AddItemPanel
                      onCancel={() => setShowAddComponent(false)}
                      onAdd={(item) => {
                        const effectiveUnitPrice = item.quantity > 0
                          ? (item.total_price ?? item.unit_price * item.quantity) / item.quantity
                          : item.unit_price;
                        setComponents([...components, {
                          description: item.name,
                          quantity: item.quantity,
                          unit_price: effectiveUnitPrice,
                        }]);
                        setShowAddComponent(false);
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Observações
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes adicionais sobre este item (cor, acabamento especial, local de instalação...)"
                rows={2}
                className="bg-background resize-none"
              />
            </div>
          </div>

          {/* Barra azul fixa de total + ações */}
          <div className="shrink-0 mt-4 overflow-hidden rounded-xl border shadow-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-primary/95 to-primary text-primary-foreground">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{area.toFixed(2)} m²</span>
                <span className="opacity-70">×</span>
                <span>{quantity} un</span>
                {compositionPricing.isReady && (
                  <Badge variant="outline" className="ml-2 text-[10px] bg-white/15 border-white/30 text-primary-foreground">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Composição
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider opacity-80">Total</p>
                <p className="text-xl font-bold leading-tight">{formatCurrency(totalPrice)}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 bg-card px-4 py-3 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
              >
                Adicionar ao orçamento
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
