import { useState, useMemo, useEffect } from 'react';
import { useDynamicCompositionPricing } from '@/hooks/useDynamicCompositionPricing';
import { useProductsProfileStock } from '@/hooks/useProductsProfileStock';
import { resolveProductImageUrl, resolveItemImageUrl } from '@/utils/imageUrl';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Check, ArrowLeft, Ruler, DollarSign, Sparkles, Info, GlassWater, Layers, LayoutGrid, Palette, Frame, Maximize2, FileText, Plus, X, DoorOpen, Square, AppWindow, Columns3, Box as BoxIcon, Minus, RectangleHorizontal, RotateCcw, AlertTriangle } from 'lucide-react';

// Ícone específico por categoria (slug ou nome normalizado)
function getCategoryIcon(value?: string) {
  const key = (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (key.includes('janela')) return AppWindow;
  if (key.includes('porta')) return DoorOpen;
  if (key.includes('box')) return BoxIcon;
  if (key.includes('espelho')) return Square;
  if (key.includes('divisor')) return Columns3;
  if (key.includes('guarda')) return RectangleHorizontal;
  if (key.includes('corrimao') || key.includes('corrimão')) return Minus;
  if (key.includes('basculante')) return RectangleHorizontal;
  if (key.includes('tampo')) return Square;
  return Frame;
}
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useProductCategoryLabels, useProductCategories } from '@/hooks/useProductCategories';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProductAluminumPriceOptions } from '@/hooks/useProductAluminumPrices';
import { useGlassStockOptions } from '@/hooks/useGlassStockOptions';
import { useAvailableColorsForTemplates } from '@/hooks/useItemColorPrices';
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

interface ProductTemplateRef {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  linha?: string | null;
  image_url?: string | null;
  has_multiple_sides?: boolean | null;
  has_cutting_plan?: boolean | null;
  default_leaves_count?: number | null;
  default_glasses_count?: number | null;
  default_panels_count?: number | null;
  default_sides_count?: number | null;
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
  mode?: 'quote' | 'cutting';
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  onLiveChange?: (payload: {
    product_template_id: string | null;
    name: string;
    image_url: string | null;
    width: number;
    height: number;
    /** Largura do Lado B (produtos com múltiplos lados) */
    width_b?: number;
    /** Altura do Lado B (produtos com múltiplos lados) */
    height_b?: number;
    has_multiple_sides?: boolean;
    quantity: number;
  }) => void;
}

export function AddProductPanel({ onAdd, onCancel, mode = 'quote', submitLabel, submitIcon, onLiveChange }: AddProductPanelProps) {
  const { currentCompany } = useAuth();
  const { labels: categoryLabels } = useProductCategoryLabels();
  const { data: adminCategories } = useProductCategories();
  const categoryNormalizer = useMemo(
    () => buildCategoryNormalizer(adminCategories?.map(c => ({ slug: c.slug, name: c.name }))),
    [adminCategories]
  );
  const { data: productLinhas } = useCompanyLinhas();
  
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
  const [manualTotalOverride, setManualTotalOverride] = useState<number | null>(null);
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
            id, name, description, category, linha, image_url, has_multiple_sides, has_cutting_plan,
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

  // No simulador de plano de corte, o catálogo precisa funcionar mesmo sem
  // produtos ativados para a empresa. Nesse modo, os templates globais entram
  // como fallback apenas para geração técnica do plano.
  const { data: globalCuttingTemplates, isLoading: isLoadingGlobalCuttingTemplates } = useQuery({
    queryKey: ['global-cutting-product-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select(`
          id,
          name,
          description,
          category,
          linha,
          image_url,
          has_multiple_sides,
          has_cutting_plan,
          default_leaves_count,
          default_glasses_count,
          default_panels_count,
          default_sides_count
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: mode === 'cutting',
  });

  const isCatalogLoading = isLoading || (mode === 'cutting' && isLoadingGlobalCuttingTemplates);

  // Mapa slug -> nome oficial (fonte: product_linhas). Também aceita nome como chave para dados legados.
  const linhaSlugToName = useMemo(() => {
    const map = new Map<string, string>();
    (productLinhas || []).forEach(l => {
      if (l.slug) map.set(l.slug.toLowerCase(), l.name || l.slug);
      if (l.name) map.set(l.name.toLowerCase(), l.name);
    });
    return map;
  }, [productLinhas]);

  const catalogProducts = useMemo(() => {
    const companyCatalog = (companyProducts || []).map(cp => {
      const template = cp.product_template as ProductTemplateRef | null;
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
        has_multiple_sides: template?.has_multiple_sides ?? false,
        has_cutting_plan: template?.has_cutting_plan ?? true,
        leaves_count: cp.leaves_count || template?.default_leaves_count || 1,
        glasses_count: cp.glasses_count || template?.default_glasses_count || 1,
        panels_count: cp.panels_count || template?.default_panels_count || 1,
        sides_count: cp.sides_count || template?.default_sides_count || 1,
      };
    });

    if (mode !== 'cutting') return companyCatalog;

    const companyTemplateIds = new Set(
      companyCatalog
        .map(product => product.product_template_id)
        .filter((id): id is string => Boolean(id))
    );

    const templateCatalog = (globalCuttingTemplates || [])
      .filter(template => !companyTemplateIds.has(template.id))
      .map(template => ({
        id: `template:${template.id}`,
        name: template.name || 'Produto',
        description: template.description,
        category: template.category || 'other',
        linha: template.linha || 'Universal',
        image_url: template.image_url || null,
        is_custom: false,
        uses_glass: true,
        company_product: null,
        product_template_id: template.id,
        has_multiple_sides: template.has_multiple_sides ?? false,
        has_cutting_plan: template.has_cutting_plan ?? true,
        leaves_count: template.default_leaves_count || 1,
        glasses_count: template.default_glasses_count || 1,
        panels_count: template.default_panels_count || 1,
        sides_count: template.default_sides_count || 1,
      }));

    return [...companyCatalog, ...templateCatalog];
  }, [companyProducts, globalCuttingTemplates, mode]);

  // Dedupe por slug oficial: qualquer variação textual (com/sem acento, com/sem underscore)
  // colapsa no mesmo card. Só linhas ativas em product_linhas aparecem (+ Personalizado).
  const linhas = useMemo(() => {
    const bySlug = new Map<string, string>(); // slug -> display name
    catalogProducts.forEach(p => {
      const raw = p.linha;
      if (!raw) return;
      const key = String(raw).toLowerCase();
      if (key === 'personalizado') {
        bySlug.set('personalizado', 'Personalizado');
        return;
      }
      const officialName = linhaSlugToName.get(key);
      if (officialName) {
        bySlug.set(key, officialName);
      }
    });
    return Array.from(bySlug.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogProducts, linhaSlugToName]);

  // Helper: compara se um produto pertence à linha selecionada (por slug oficial)
  const productMatchesLinha = (rawLinha: string | null | undefined, slug: string) => {
    if (!rawLinha) return false;
    const key = String(rawLinha).toLowerCase();
    if (slug === 'personalizado') return key === 'personalizado';
    // resolve raw para slug oficial via nome/slug lookup
    const officialName = linhaSlugToName.get(key);
    if (!officialName) return false;
    const officialSlug = (productLinhas || []).find(l => l.name === officialName)?.slug?.toLowerCase();
    return officialSlug === slug;
  };

  // Get categories for selected linha (normalized via Admin dictionary)
  const categories = useMemo(() => {
    if (!selectedLinha) return [];
    const catMap = new Map<string, string>();
    catalogProducts
      .filter(p => productMatchesLinha(p.linha, selectedLinha))
      .forEach(p => {
        const raw = p.category;
        const key = categoryNormalizer.key(raw);
        const label = categoryNormalizer.normalize(raw);
        if (label && !catMap.has(key)) catMap.set(key, label);
      });
    return Array.from(catMap.values()).sort();
  }, [catalogProducts, selectedLinha, categoryNormalizer, linhaSlugToName, productLinhas]);

  // Get filtered products from active company products
  const filteredProducts = useMemo(() => {
    if (!selectedLinha) return [];

    let products = [...catalogProducts];

    products = products.filter(p => productMatchesLinha(p.linha, selectedLinha));

    if (selectedCategory && selectedCategory !== '__all__') {
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
  }, [catalogProducts, selectedLinha, selectedCategory, searchQuery, linhaSlugToName, productLinhas, mode]);


  // Saldo de perfis por produto listado — para alertar o vendedor sobre falta de estoque.
  const filteredProductIds = useMemo(
    () => filteredProducts
      .filter(p => Boolean(p.company_product?.id))
      .map(p => p.id)
      .filter(Boolean),
    [filteredProducts],
  );
  const { data: productsProfileStock } = useProductsProfileStock(filteredProductIds);

  const selectedProduct = filteredProducts?.find(p => p.id === selectedProductId);
  const selectedProductTemplateId = selectedProduct?.product_template_id
    || (selectedProductId.startsWith('template:') ? selectedProductId.replace('template:', '') : null);
  const companyProduct = selectedProduct?.company_product;

  // Para o Plano de Corte: produtos customizados da empresa (sem product_template_id)
  // devem passar o próprio company_products.id — a RPC get_cutting_plan_items aceita
  // tanto template_id quanto company_products.id como _template_id.
  const cuttingPlanProductId = mode === 'cutting'
    ? (selectedProductTemplateId || companyProduct?.id || null)
    : (selectedProduct?.is_custom ? null : selectedProductTemplateId);

  // Live change: emite mudanças em tempo real (usado pelo Simulador de Plano de Corte)
  useEffect(() => {
    if (!onLiveChange) return;
    onLiveChange({
      product_template_id: cuttingPlanProductId,
      name: selectedProduct?.name || '',
      image_url: selectedProduct?.image_url || null,
      width,
      height,
      width_b: selectedProduct?.has_multiple_sides ? widthB : undefined,
      height_b: selectedProduct?.has_multiple_sides ? heightB : undefined,
      has_multiple_sides: !!selectedProduct?.has_multiple_sides,
      quantity,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, cuttingPlanProductId, selectedProduct?.name, selectedProduct?.image_url, selectedProduct?.has_multiple_sides, width, height, widthB, heightB, quantity]);

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

  // Perfis (item_templates) usados na composição deste produto — dirige as cores disponíveis.
  const { data: productProfileTemplateIds = [] } = useQuery({
    queryKey: ['product-profile-template-ids', companyProduct?.id],
    queryFn: async () => {
      if (!companyProduct?.id) return [] as string[];
      const { data, error } = await supabase
        .from('company_product_items')
        .select('item_template:item_templates(id, type)')
        .eq('company_product_id', companyProduct.id);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.item_template)
        .filter((t: { type: string } | null) => t && t.type === 'profile')
        .map((t: { id: string }) => t.id);
    },
    enabled: !!companyProduct?.id,
    staleTime: 60_000,
  });
  const { data: profileAvailableColors = [] } = useAvailableColorsForTemplates(productProfileTemplateIds);
  const hasProfileColorPrices = profileAvailableColors.length > 0;

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
  
  // Composition-based dynamic pricing (Fase 2: variáveis dinâmicas)
  const compositionPricing = useDynamicCompositionPricing({
    companyProductId: companyProduct?.id,
    width: width || 1000,
    height: height || 1000,
    widthB: widthB || 0,
    heightB: heightB || 0,
    leaves_count: selectedProduct?.leaves_count || companyProduct?.leaves_count || 1,
    glasses_count: selectedProduct?.glasses_count || companyProduct?.glasses_count || 1,
    panels_count: selectedProduct?.panels_count || companyProduct?.panels_count || 1,
    sides_count: selectedProduct?.sides_count || companyProduct?.sides_count || 1,
    quantity: quantity || 1,
    enabled: !!companyProduct?.id && width > 0 && height > 0,
    excludeOptionalIds: excludedOptionalIds,
    glassColor: selectedGlassColor || null,
    glassThicknessMm: selectedGlassThickness ? Number(selectedGlassThickness) : null,
    aluminumColor: selectedAluminumColor || customAluminumColor || null,
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
  const computedTotalPrice = ((productUsesComposition && compositionPricing.isReady)
    ? compositionPricing.totalCost
    : unitPrice * quantity) + componentsTotal;
  const isPriceOverridden = manualTotalOverride !== null && Math.abs(manualTotalOverride - computedTotalPrice) > 0.005;
  const totalPrice = manualTotalOverride !== null ? manualTotalOverride : computedTotalPrice;
  const effectiveUnitPrice = quantity > 0
    ? Math.max(0, (totalPrice - componentsTotal) / quantity)
    : unitPrice;

  // Check if the selected product is from "Temperado" line (always has glass)
  const isTemperadoLine = selectedProduct?.linha?.toLowerCase().includes('temperado');

  // Reset custom price when product changes and set glass based on line
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setCustomPrice(null);
    setManualTotalOverride(null);
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
      product_template_id: cuttingPlanProductId,
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
      leaves_count: selectedProduct.leaves_count || companyProduct?.leaves_count || 1,
      glasses_count: selectedProduct.glasses_count || companyProduct?.glasses_count || 1,
      panels_count: selectedProduct.panels_count || companyProduct?.panels_count || 1,
      sides_count: selectedProduct.sides_count || companyProduct?.sides_count || 1,
      unit_price: effectiveUnitPrice,
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
      {/* ── Etapa 1: Catálogo (Wizard: Linha → Categoria → Produto) ── */}
      {!selectedProduct && (() => {
        // Sub-passo do wizard de catálogo
        const catalogStep: 1 | 2 | 3 = !selectedLinha ? 1 : !selectedCategory ? 2 : 3;

        const StepChip = ({ n, label, state }: { n: number; label: string; state: 'done' | 'active' | 'pending' }) => (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full font-medium transition-colors",
            state === 'active' && "bg-primary text-primary-foreground",
            state === 'done' && "bg-success/15 text-success",
            state === 'pending' && "bg-muted text-muted-foreground"
          )}>
            {state === 'done' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
                state === 'active' ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
              )}>{n}</span>
            )}
            <span className="hidden sm:inline">{label}</span>
          </div>
        );

        const handleBack = () => {
          if (catalogStep === 3) setSelectedCategory('');
          else if (catalogStep === 2) setSelectedLinha('');
        };

        return (
          <>
            {/* Stepper visual: 3 passos do catálogo + Dimensões */}
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 mb-3 text-xs">
              <StepChip n={1} label="Linha" state={catalogStep === 1 ? 'active' : 'done'} />
              <div className="h-px flex-1 bg-border" />
              <StepChip n={2} label="Categoria" state={catalogStep === 2 ? 'active' : catalogStep > 2 ? 'done' : 'pending'} />
              <div className="h-px flex-1 bg-border" />
              <StepChip n={3} label="Produto" state={catalogStep === 3 ? 'active' : 'pending'} />
              <div className="h-px flex-1 bg-border" />
              <StepChip n={4} label="Dimensões" state="pending" />
            </div>

            {/* Voltar + breadcrumb */}
            {catalogStep > 1 && (
              <div className="shrink-0 flex items-center justify-between mb-3 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
                <div className="text-xs text-muted-foreground truncate">
                  {linhas.find(l => l.slug === selectedLinha)?.name || selectedLinha}
                  {selectedCategory && <> · <span className="text-foreground font-medium">{selectedCategory === '__all__' ? 'Todos' : selectedCategory}</span></>}
                </div>
              </div>
            )}

            {/* Busca apenas no passo 3 */}
            {catalogStep === 3 && (
              <div className="shrink-0 relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto pelo nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background h-11"
                />
              </div>
            )}

            {/* Conteúdo do passo */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full rounded-xl">
                {isCatalogLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="rounded-2xl bg-muted animate-pulse h-44" />
                    ))}
                  </div>
                ) : catalogStep === 1 ? (
                  // ── Passo 1: Linhas ──
                  linhas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 px-6">
                      <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-dashed flex items-center justify-center mb-4">
                        <Frame className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-medium text-foreground">Nenhuma linha disponível</p>
                      <p className="text-xs mt-1 text-center">Ative produtos no catálogo da empresa.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1 pb-3">
                      {linhas.map(({ slug, name }) => {
                        const count = catalogProducts.filter(p => productMatchesLinha(p.linha, slug)).length;
                        return (
                          <button
                            key={slug}
                            type="button"
                            onClick={() => handleLinhaChange(slug)}
                            className={cn(
                              "group relative flex flex-col items-start gap-4 rounded-2xl border border-border/60 bg-card p-5 text-left min-h-[140px]",
                              "transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 hover:-translate-y-0.5",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            )}
                          >
                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                              <LayoutGrid className="w-5 h-5 text-primary" strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-semibold text-foreground leading-tight">{name}</p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {count} {count === 1 ? 'produto' : 'produtos'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                  )
                ) : catalogStep === 2 ? (
                  // ── Passo 2: Categorias ──
                  categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 px-6">
                      <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-dashed flex items-center justify-center mb-4">
                        <Package className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-medium text-foreground">Nenhuma categoria nesta linha</p>
                      <p className="text-xs mt-1 text-center">Esta linha ainda não possui produtos categorizados.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1 pb-3">
                      <button
                        type="button"
                        onClick={() => handleCategoryChange('__all__' as any)}
                        className={cn(
                          "group relative flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-card p-5 text-left min-h-[140px]",
                          "transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 hover:-translate-y-0.5",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        )}
                      >
                        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                          <LayoutGrid className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-semibold text-foreground leading-tight">Todos</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">Ver todos os produtos</p>
                        </div>
                      </button>
                        {categories.map((cat) => {
                        const count = catalogProducts.filter(p => (
                          productMatchesLinha(p.linha, selectedLinha) && categoryNormalizer.match(p.category, cat)
                        )).length;
                        const CategoryIcon = getCategoryIcon(cat);
                        const displayName = (cat || '').replace(/^#/, '');
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleCategoryChange(cat)}
                            className={cn(
                              "group relative flex flex-col items-start gap-4 rounded-2xl border border-border/60 bg-card p-5 text-left min-h-[140px]",
                              "transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 hover:-translate-y-0.5",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            )}
                          >
                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                              <CategoryIcon className="w-5 h-5 text-primary" strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-semibold text-foreground leading-tight">{displayName}</p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {count} {count === 1 ? 'produto' : 'produtos'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  // ── Passo 3: Produtos ──
                  filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 px-6">
                      <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-dashed flex items-center justify-center mb-4">
                        <Search className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-medium text-foreground">Nenhum produto encontrado nesta categoria</p>
                      <p className="text-xs mt-1 text-center">Tente ajustar a busca ou voltar e escolher outra categoria.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2 px-1">
                        <span className="font-semibold text-foreground">{filteredProducts.length}</span> {filteredProducts.length === 1 ? 'produto disponível' : 'produtos disponíveis'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1 pb-3">
                        {filteredProducts.map((product) => {
                          const imageUrl = getProductImage(product.image_url);
                          const isCustomProduct = product.is_custom;
                          const stockInfo = productsProfileStock?.get(product.id);
                          const stockBadge = stockInfo && stockInfo.totalProfiles > 0
                            ? stockInfo.withStock === 0
                              ? { label: 'Sem estoque de perfis', tone: 'danger' as const }
                              : stockInfo.withStock < stockInfo.totalProfiles
                                ? { label: `${stockInfo.withStock}/${stockInfo.totalProfiles} perfis c/ saldo`, tone: 'warning' as const }
                                : { label: 'Perfis em estoque', tone: 'ok' as const }
                            : null;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => handleProductSelect(product.id)}
                              className={cn(
                                "group relative flex flex-col rounded-2xl border bg-card overflow-hidden text-left",
                                "transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/60 hover:-translate-y-0.5",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              )}
                            >
                              {isCustomProduct && (
                                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/95 text-warning-foreground text-[10px] font-medium shadow-sm">
                                  <Sparkles className="w-3 h-3" />
                                  Custom
                                </div>
                              )}
                              <div className="aspect-[4/3] w-full bg-gradient-to-br from-muted/40 via-muted/20 to-background flex items-center justify-center p-3 border-b overflow-hidden">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={product.name}
                                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling;
                                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={cn(
                                  "flex-col items-center justify-center gap-1.5 text-muted-foreground/40",
                                  imageUrl ? "hidden" : "flex"
                                )}>
                                  <Frame className="w-10 h-10" strokeWidth={1.25} />
                                  <span className="text-[10px] uppercase tracking-wider">Sem imagem</span>
                                </div>
                              </div>
                              <div className="p-2.5 flex-1 flex flex-col justify-between gap-1">
                                <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                                  {product.name}
                                </p>
                                {product.category && (
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                                    {categoryLabels[product.category] || product.category}
                                  </p>
                                )}
                                {stockBadge && (
                                  <div
                                    className={cn(
                                      "mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit",
                                      stockBadge.tone === 'ok' && "bg-success/15 text-success",
                                      stockBadge.tone === 'warning' && "bg-warning/15 text-warning",
                                      stockBadge.tone === 'danger' && "bg-destructive/15 text-destructive",
                                    )}
                                  >
                                    <Package className="w-3 h-3" />
                                    {stockBadge.label}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )
                )}
              </ScrollArea>
            </div>

            <div className="shrink-0 pt-4 mt-4 border-t flex justify-end">
              <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            </div>
          </>
        );
      })()}

      {/* ── Etapa 2: Configuração das dimensões ── */}
      {selectedProduct && (
        <>
          {/* Stepper + Voltar */}
          <div className="shrink-0 mb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedProductId('')}
              className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o catálogo
            </Button>
          </div>
          <div className="shrink-0 flex items-center gap-2 mb-4 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/15 text-success font-medium">
              <Check className="w-3.5 h-3.5" />
              Catálogo
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-medium">
              <span className="w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px]">2</span>
              Dimensões
            </div>
          </div>

          {/* Header do produto selecionado */}
          <div className="shrink-0 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border mb-4">
            <div className="w-16 h-16 rounded-lg bg-background flex items-center justify-center shrink-0 overflow-hidden border">
              {getProductImage(selectedProduct.image_url) ? (
                <img
                  src={getProductImage(selectedProduct.image_url)!}
                  alt={selectedProduct.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Frame className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{selectedProduct.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {selectedProduct.linha}
                {selectedProduct.category && (
                  <> · {categoryLabels[selectedProduct.category] || selectedProduct.category}</>
                )}
              </p>
            </div>
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

            {/* Linhas de Preço (Variações) do produto */}
            {mode !== 'cutting' && priceLines.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-3">
                <label className="text-xs font-medium text-foreground">
                  Variação / Linha de preço <span className="text-destructive">*</span>
                </label>
                <Select value={selectedPriceLineId} onValueChange={setSelectedPriceLineId}>
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Escolha a variação..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {priceLines.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{pl.description}</span>
                          <span className="text-muted-foreground text-xs">
                            {formatCurrency(Number(pl.price))}/{formatUnitLabel(pl.unit)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPriceLine && (
                  <p className="text-[11px] text-muted-foreground">
                    Preço aplicado: <strong>{formatCurrency(Number(selectedPriceLine.price))}</strong> por{' '}
                    {formatUnitLabel(selectedPriceLine.unit)}
                    {selectedPriceLine.cost != null && Number(selectedPriceLine.cost) > 0 && (
                      <> · Margem: {(((Number(selectedPriceLine.price) - Number(selectedPriceLine.cost)) / Number(selectedPriceLine.price)) * 100).toFixed(1)}%</>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Espessura/Cor do vidro e Cor do perfil — ocultos no modo Plano de Corte */}
            {mode !== 'cutting' && (

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
                  {hasProfileColorPrices ? (
                    <Select value={selectedAluminumColor} onValueChange={setSelectedAluminumColor}>
                      <SelectTrigger className="bg-background h-10">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        {profileAvailableColors.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : productUsesAluminum && hasAluminumPrices ? (
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
            )}

            {/* Valor R$ / m² — oculto no modo Plano de Corte */}
            {mode !== 'cutting' && (
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
            )}

            {/* Componentes / Acessórios — ocultos no modo Plano de Corte */}
            {mode !== 'cutting' && (
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
            )}

            {/* Observações — oculto no modo Plano de Corte */}
            {mode !== 'cutting' && (
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
            )}
          </div>

          {mode === 'cutting' ? (
            /* Rodapé limpo — modo Plano de Corte (omitido se onLiveChange estiver ativo) */
            onLiveChange ? null : (
              <div className="shrink-0 mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 gap-2"
                >
                  {submitIcon}
                  {submitLabel || 'Gerar Plano de Corte'}
                </Button>
              </div>
            )
          ) : (
            /* Barra azul fixa de total + ações (Orçamento) */
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
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm font-semibold opacity-90">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={totalPrice.toFixed(2)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setManualTotalOverride(Number.isFinite(v) ? v : 0);
                      }}
                      className="h-8 w-28 text-right text-lg font-bold bg-white/15 border-white/30 text-primary-foreground placeholder:text-primary-foreground/60"
                    />
                    {isPriceOverridden && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                        title="Restaurar preço original"
                        onClick={() => setManualTotalOverride(null)}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {isPriceOverridden && (
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-90">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Preço alterado manualmente · original {formatCurrency(computedTotalPrice)}</span>
                    </div>
                  )}
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
          )}

        </>
      )}
    </div>
  );
}
