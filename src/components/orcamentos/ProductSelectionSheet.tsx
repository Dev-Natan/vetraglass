import { useState, useMemo } from 'react';
import { resolveProductImageUrl } from '@/utils/imageUrl';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Search, Package, Check, ChevronRight, Home, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';
import { useProductLinhas } from '@/hooks/useProductLinhas';

interface ProductSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProduct: (product: {
    product_template_id: string;
    company_product_id?: string;
    name: string;
    base_price: number;
    image_url?: string | null;
    linha?: string | null;
    category?: string;
  }) => void;
}

type SelectionStep = 'linha' | 'category' | 'product';

const categoryIcons: Record<string, string> = {
  janelas: '🪟',
  portas: '🚪',
  box: '🚿',
  espelhos: '🪞',
  fachadas: '🏢',
  'guarda-corpo': '🛡️',
  'maxim-ar': '🪟',
  portao: '🚪',
  basculante: '🪟',
  corrimao: '🛡️',
  other: '📦',
};

export function ProductSelectionSheet({ open, onOpenChange, onSelectProduct }: ProductSelectionSheetProps) {
  const { currentCompany } = useAuth();
  const { labels: categoryLabels } = useProductCategoryLabels();
  const { data: productLinhas } = useProductLinhas();
  const [step, setStep] = useState<SelectionStep>('linha');
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    enabled: !!currentCompany?.id && open
  });

  // Transform company products to a unified format
  const activeProducts = useMemo(() => {
    return (companyProducts || []).map(cp => {
      const template = cp.product_template as any;
      return {
        id: cp.id,
        name: cp.commercial_name || template?.name || 'Produto',
        description: cp.description || template?.description,
        category: cp.category || template?.category || 'other',
        linha: cp.linha || template?.linha || 'Personalizado',
        image_url: cp.image_url || template?.image_url || null,
        is_custom: cp.is_custom ?? false,
        base_price: cp.base_price,
        price_per_sqm: cp.price_per_sqm,
        company_product: cp,
        product_template_id: cp.product_template_id
      };
    });
  }, [companyProducts]);

  // Mapa slug -> nome oficial (fonte: product_linhas). Aceita nome como chave para dados legados.
  const linhaSlugToName = useMemo(() => {
    const map = new Map<string, string>();
    (productLinhas || []).forEach(l => {
      if (l.slug) map.set(l.slug.toLowerCase(), l.name || l.slug);
      if (l.name) map.set(l.name.toLowerCase(), l.name);
    });
    return map;
  }, [productLinhas]);

  const productMatchesLinha = (rawLinha: string | null | undefined, slug: string) => {
    if (!rawLinha) return false;
    const key = String(rawLinha).toLowerCase();
    if (slug === 'personalizado') return key === 'personalizado';
    const officialName = linhaSlugToName.get(key);
    if (!officialName) return false;
    const officialSlug = (productLinhas || []).find(l => l.name === officialName)?.slug?.toLowerCase();
    return officialSlug === slug;
  };

  // Dedupe por slug oficial: variações textuais colapsam no mesmo card.
  const linhas = useMemo(() => {
    const bySlug = new Map<string, string>();
    activeProducts.forEach(p => {
      if (!p.linha) return;
      const key = String(p.linha).toLowerCase();
      if (key === 'personalizado') {
        bySlug.set('personalizado', 'Personalizado');
        return;
      }
      const officialName = linhaSlugToName.get(key);
      if (officialName) {
        const officialSlug = (productLinhas || []).find(l => l.name === officialName)?.slug?.toLowerCase() || key;
        bySlug.set(officialSlug, officialName);
      }
    });
    return Array.from(bySlug.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeProducts, linhaSlugToName, productLinhas]);


  // Get categories for selected linha (by slug)
  const categories = useMemo(() => {
    if (!selectedLinha) return [];
    const catSet = new Set<string>();
    activeProducts
      .filter(p => productMatchesLinha(p.linha, selectedLinha))
      .forEach(p => {
        if (p.category) catSet.add(p.category);
      });
    return Array.from(catSet).sort();
  }, [activeProducts, selectedLinha, linhaSlugToName, productLinhas]);

  // Get products for selected linha and category
  const products = useMemo(() => {
    if (!selectedLinha || !selectedCategory) return [];
    return activeProducts.filter(
      p => productMatchesLinha(p.linha, selectedLinha) && p.category === selectedCategory
    );
  }, [activeProducts, selectedLinha, selectedCategory, linhaSlugToName, productLinhas]);


  // Filtered products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const handleSelectLinha = (linha: string) => {
    setSelectedLinha(linha);
    setStep('category');
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setStep('product');
  };

  const handleSelectProduct = (productId: string) => {
    const product = activeProducts.find(p => p.id === productId);
    if (!product) return;

    const basePrice = Number(product.price_per_sqm) || Number(product.base_price) || 0;

    onSelectProduct({
      product_template_id: product.is_custom ? '' : (product.product_template_id || ''),
      company_product_id: product.company_product?.id,
      name: product.name,
      base_price: basePrice,
      image_url: product.image_url,
      linha: product.linha,
      category: product.category,
    });

    resetSelection();
    onOpenChange(false);
  };

  const goToStep = (targetStep: SelectionStep) => {
    if (targetStep === 'linha') {
      setStep('linha');
      setSelectedLinha(null);
      setSelectedCategory(null);
      setSearchQuery('');
    } else if (targetStep === 'category') {
      setStep('category');
      setSelectedCategory(null);
      setSearchQuery('');
    }
  };

  const resetSelection = () => {
    setStep('linha');
    setSelectedLinha(null);
    setSelectedCategory(null);
    setSearchQuery('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetSelection();
    }
    onOpenChange(open);
  };

  const getProductImage = resolveProductImageUrl;

  const stepNumber = step === 'linha' ? 1 : step === 'category' ? 2 : 3;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col bg-background">
        {/* Header with Progress */}
        <SheetHeader className="p-4 sm:p-6 border-b bg-card">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Selecionar Produto</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    num < stepNumber && "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/80",
                    num === stepNumber && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    num > stepNumber && "bg-muted text-muted-foreground"
                  )}
                  onClick={() => {
                    if (num < stepNumber) {
                      if (num === 1) goToStep('linha');
                      else if (num === 2) goToStep('category');
                    }
                  }}
                >
                  {num < stepNumber ? <Check className="w-4 h-4" /> : num}
                </div>
                {num < 3 && (
                  <div className={cn(
                    "w-8 sm:w-12 h-0.5",
                    num < stepNumber ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-1 mt-4 text-sm flex-wrap">
            <button
              onClick={() => goToStep('linha')}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md transition-colors",
                step === 'linha' 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Linhas</span>
            </button>

            {selectedLinha && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <button
                  onClick={() => goToStep('category')}
                  className={cn(
                    "px-2 py-1 rounded-md transition-colors truncate max-w-[120px]",
                    step === 'category' 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {selectedLinha}
                </button>
              </>
            )}

            {selectedCategory && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-medium truncate max-w-[120px]">
                  {categoryLabels[selectedCategory] || selectedCategory}
                </span>
              </>
            )}
          </nav>
          
          {/* Search - Only on product step */}
          {step === 'product' && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Step 1: Select Linha */}
                {step === 'linha' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Escolha uma linha de produtos para começar
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {linhas.map(({ slug, name }) => {
                        const count = activeProducts.filter(p => productMatchesLinha(p.linha, slug)).length;
                        return (
                          <button
                            key={slug}
                            onClick={() => handleSelectLinha(slug)}
                            className="group relative p-5 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
                          >
                            <div className="text-2xl mb-2">📐</div>
                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                              {name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {count} {count === 1 ? 'produto' : 'produtos'}
                            </p>
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                          </button>
                        );
                      })}

                    </div>
                  </div>
                )}

                {/* Step 2: Select Category */}
                {step === 'category' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecione a categoria do produto
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {categories.map((category) => {
                        const count = activeProducts.filter(
                          p => p.linha === selectedLinha && p.category === category
                        ).length;
                        return (
                          <button
                            key={category}
                            onClick={() => handleSelectCategory(category)}
                            className="group relative p-5 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
                          >
                            <div className="text-2xl mb-2">
                              {categoryIcons[category] || '📦'}
                            </div>
                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                              {categoryLabels[category] || category}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {count} {count === 1 ? 'produto' : 'produtos'}
                            </p>
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 3: Select Product */}
                {step === 'product' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        {filteredProducts.length} {filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
                      </p>
                    </div>
                    
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Nenhum produto encontrado</p>
                        <p className="text-sm mt-1">Tente buscar por outro termo</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filteredProducts.map((product) => {
                          const hasPrice = Number(product.price_per_sqm) > 0 || Number(product.base_price) > 0;
                          const imageUrl = getProductImage(product.image_url);
                          const isCustomProduct = product.is_custom;

                          return (
                            <button
                              key={product.id}
                              onClick={() => handleSelectProduct(product.id)}
                              className={cn(
                                "group relative rounded-xl border-2 bg-card overflow-hidden text-left transition-all",
                                "hover:border-primary hover:shadow-lg",
                                hasPrice ? "border-border" : "border-dashed border-muted-foreground/30"
                              )}
                            >
                              {/* Product Image */}
                              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={product.name}
                                    className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling;
                                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={cn("w-full h-full items-center justify-center", imageUrl ? "hidden" : "flex")}>
                                  <Package className="w-12 h-12 text-muted-foreground/30" />
                                </div>
                                
                                <div className="absolute top-2 right-2 flex gap-1">
                                  {isCustomProduct && (
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                      ✨ Personalizado
                                    </Badge>
                                  )}
                                  <Badge variant="default" className="bg-success text-success-foreground gap-1 text-xs">
                                    <Check className="w-3 h-3" />
                                    Ativo
                                  </Badge>
                                </div>
                              </div>

                              {/* Product Info */}
                              <div className="p-3">
                                <h3 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                                  {product.name}
                                </h3>
                                <div className="mt-2 flex items-center justify-between">
                                  {hasPrice ? (
                                    <span className="text-sm font-bold text-primary">
                                      R$ {(Number(product.price_per_sqm) || Number(product.base_price)).toFixed(2)}/m²
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Sem preço
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
