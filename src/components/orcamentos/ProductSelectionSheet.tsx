import { useState, useMemo } from 'react';
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

const categoryIcons: Record<string, string> = {
  window: '🪟',
  door: '🚪',
  partition: '🧱',
  mirror: '🪞',
  shower: '🚿',
  facade: '🏢',
  guarda_corpo: '🛡️',
  other: '📦',
};

export function ProductSelectionSheet({ open, onOpenChange, onSelectProduct }: ProductSelectionSheetProps) {
  const { currentCompany } = useAuth();
  const [step, setStep] = useState<SelectionStep>('linha');
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    enabled: open
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
    enabled: !!currentCompany?.id && open
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

  // Get products for selected linha and category
  const products = useMemo(() => {
    if (!selectedLinha || !selectedCategory) return [];
    return productTemplates?.filter(
      p => p.linha === selectedLinha && p.category === selectedCategory
    ) || [];
  }, [productTemplates, selectedLinha, selectedCategory]);

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

  const handleSelectProduct = (templateId: string) => {
    const template = productTemplates?.find(p => p.id === templateId);
    if (!template) return;

    const existingProduct = companyProducts?.find(p => p.product_template_id === templateId);
    const basePrice = Number(existingProduct?.base_price) || 0;

    onSelectProduct({
      product_template_id: templateId,
      company_product_id: existingProduct?.id,
      name: existingProduct?.commercial_name || template.name,
      base_price: basePrice,
      image_url: template.image_url,
      linha: template.linha,
      category: template.category,
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

  const getProductImage = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `/products/${imageUrl}`;
  };

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
                      {linhas.map((linha) => {
                        const count = productTemplates?.filter(p => p.linha === linha).length || 0;
                        return (
                          <button
                            key={linha}
                            onClick={() => handleSelectLinha(linha!)}
                            className="group relative p-5 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
                          >
                            <div className="text-2xl mb-2">📐</div>
                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                              {linha}
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
                        const count = productTemplates?.filter(
                          p => p.linha === selectedLinha && p.category === category
                        ).length || 0;
                        return (
                          <button
                            key={category}
                            onClick={() => handleSelectCategory(category!)}
                            className="group relative p-5 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
                          >
                            <div className="text-2xl mb-2">
                              {categoryIcons[category!] || '📦'}
                            </div>
                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                              {categoryLabels[category!] || category}
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
                          const companyProduct = companyProducts?.find(
                            cp => cp.product_template_id === product.id
                          );
                          const hasPrice = !!companyProduct?.base_price;
                          const imageUrl = getProductImage(product.image_url);

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
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-12 h-12 text-muted-foreground/30" />
                                  </div>
                                )}
                                
                                {companyProduct && (
                                  <div className="absolute top-2 right-2">
                                    <Badge className="bg-green-500/90 text-white gap-1 text-xs">
                                      <Check className="w-3 h-3" />
                                      Ativo
                                    </Badge>
                                  </div>
                                )}
                              </div>

                              {/* Product Info */}
                              <div className="p-3">
                                <h3 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                                  {companyProduct?.commercial_name || product.name}
                                </h3>
                                <div className="mt-2 flex items-center justify-between">
                                  {hasPrice ? (
                                    <span className="text-sm font-bold text-primary">
                                      R$ {Number(companyProduct.base_price).toFixed(2)}/m²
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
