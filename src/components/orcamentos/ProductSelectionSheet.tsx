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
import { ArrowLeft, Search, Package, Check } from 'lucide-react';
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
  const { data: productTemplates } = useQuery({
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

    // Reset and close
    resetSelection();
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'product') {
      setStep('category');
      setSelectedCategory(null);
      setSearchQuery('');
    } else if (step === 'category') {
      setStep('linha');
      setSelectedLinha(null);
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

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            {step !== 'linha' && (
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex-1">
              <SheetTitle className="text-left">
                {step === 'linha' && 'Selecione a Linha'}
                {step === 'category' && `${selectedLinha} - Categoria`}
                {step === 'product' && `${categoryLabels[selectedCategory!] || selectedCategory}`}
              </SheetTitle>
              {step !== 'linha' && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{selectedLinha}</Badge>
                  {selectedCategory && (
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[selectedCategory] || selectedCategory}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {step === 'product' && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {/* Step 1: Select Linha */}
            {step === 'linha' && (
              <div className="grid grid-cols-2 gap-4">
                {linhas.map((linha) => (
                  <button
                    key={linha}
                    onClick={() => handleSelectLinha(linha!)}
                    className="group relative p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
                  >
                    <div className="text-3xl mb-3">📐</div>
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {linha}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {productTemplates?.filter(p => p.linha === linha).length} produtos
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Select Category */}
            {step === 'category' && (
              <div className="grid grid-cols-2 gap-4">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleSelectCategory(category!)}
                    className="group relative p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all text-left"
                  >
                    <div className="text-3xl mb-3">
                      {categoryIcons[category!] || '📦'}
                    </div>
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {categoryLabels[category!] || category}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {productTemplates?.filter(
                        p => p.linha === selectedLinha && p.category === category
                      ).length} produtos
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Select Product */}
            {step === 'product' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum produto encontrado</p>
                  </div>
                ) : (
                  filteredProducts.map((product) => {
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
                              className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-16 h-16 text-muted-foreground/30" />
                            </div>
                          )}
                          
                          {/* Has company product badge */}
                          {companyProduct && (
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-green-500/90 text-white gap-1">
                                <Check className="w-3 h-3" />
                                Ativo
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
                            {companyProduct?.commercial_name || product.name}
                          </h3>
                          {product.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between">
                            {hasPrice ? (
                              <span className="text-sm font-bold text-primary">
                                R$ {Number(companyProduct.base_price).toFixed(2)}/m²
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Sem preço configurado
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
