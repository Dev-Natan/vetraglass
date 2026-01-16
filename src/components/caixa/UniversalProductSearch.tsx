import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Package, ChevronRight, ChevronLeft,
  Sparkles, SquareStack, Wrench, Layers,
  DoorOpen, LayoutGrid, Square, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemTemplate {
  id: string;
  name: string;
  unit: string;
  type: string;
  price: number;
  image_url?: string | null;
  linha?: string | null;
}

interface CompanyProduct {
  id: string;
  commercial_name: string;
  base_price: number | null;
  product_template_id: string;
  product_template?: {
    name: string;
    category: string;
    linha?: string | null;
    image_url?: string | null;
  };
}

interface UniversalProductSearchProps {
  availableItems: ItemTemplate[];
  availableProducts: CompanyProduct[];
  onSelectMaterial: (item: ItemTemplate) => void;
  onSelectProduct: (product: CompanyProduct) => void;
}

// Category mappings for products
const productCategoryLabels: Record<string, string> = {
  window: 'Janelas',
  door: 'Portas',
  partition: 'Divisórias',
  mirror: 'Espelhos',
  shower: 'Box',
  facade: 'Fachadas',
  guarda_corpo: 'Guarda Corpo',
  other: 'Outros',
};

const productCategoryIcons: Record<string, React.ReactNode> = {
  window: <LayoutGrid className="w-4 h-4" />,
  door: <DoorOpen className="w-4 h-4" />,
  partition: <Square className="w-4 h-4" />,
  mirror: <Square className="w-4 h-4" />,
  shower: <Square className="w-4 h-4" />,
  facade: <Square className="w-4 h-4" />,
  guarda_corpo: <Shield className="w-4 h-4" />,
  other: <Package className="w-4 h-4" />,
};

// Material type mappings
const materialTypeLabels: Record<string, string> = {
  profile: 'Perfis',
  glass: 'Vidros',
  accessory: 'Acessórios',
  service: 'Serviços',
};

const materialTypeIcons: Record<string, React.ReactNode> = {
  profile: <SquareStack className="w-4 h-4" />,
  glass: <Sparkles className="w-4 h-4" />,
  accessory: <Wrench className="w-4 h-4" />,
  service: <Layers className="w-4 h-4" />,
};

type ViewStep = 'linhas' | 'categories' | 'items';

export function UniversalProductSearch({
  availableItems,
  availableProducts,
  onSelectMaterial,
  onSelectProduct,
}: UniversalProductSearchProps) {
  const [step, setStep] = useState<ViewStep>('linhas');
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch product templates for images and categories
  const { data: productTemplates } = useQuery({
    queryKey: ['product-templates-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('id, name, category, linha, image_url')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Get unique linhas with counts
  const linhas = useMemo(() => {
    const linhaMap = new Map<string, { productCount: number; materialCount: number; image: string | null }>();
    
    // From product templates
    productTemplates?.forEach(p => {
      if (p.linha) {
        const existing = linhaMap.get(p.linha);
        linhaMap.set(p.linha, {
          productCount: (existing?.productCount || 0) + 1,
          materialCount: existing?.materialCount || 0,
          image: existing?.image || p.image_url,
        });
      }
    });
    
    // From materials
    availableItems.forEach(item => {
      if (item.linha) {
        const existing = linhaMap.get(item.linha);
        linhaMap.set(item.linha, {
          productCount: existing?.productCount || 0,
          materialCount: (existing?.materialCount || 0) + 1,
          image: existing?.image || item.image_url || null,
        });
      }
    });

    return Array.from(linhaMap.entries())
      .map(([name, data]) => ({
        name,
        productCount: data.productCount,
        materialCount: data.materialCount,
        totalCount: data.productCount + data.materialCount,
        image: data.image,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [productTemplates, availableItems]);

  // Get categories for selected linha (products + materials)
  const categories = useMemo(() => {
    if (!selectedLinha) return [];
    
    const categoryList: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      count: number;
      type: 'product' | 'material';
      image: string | null;
    }> = [];

    // Product categories for this linha
    const productCats = new Map<string, { count: number; image: string | null }>();
    productTemplates?.filter(p => p.linha === selectedLinha).forEach(p => {
      if (p.category) {
        const existing = productCats.get(p.category);
        productCats.set(p.category, {
          count: (existing?.count || 0) + 1,
          image: existing?.image || p.image_url,
        });
      }
    });
    
    productCats.forEach((data, cat) => {
      categoryList.push({
        id: `product:${cat}`,
        label: productCategoryLabels[cat] || cat,
        icon: productCategoryIcons[cat] || <Package className="w-4 h-4" />,
        count: data.count,
        type: 'product',
        image: data.image,
      });
    });

    // Material types for this linha
    const materialTypes = new Map<string, { count: number; image: string | null }>();
    availableItems.filter(item => item.linha === selectedLinha).forEach(item => {
      if (item.type) {
        const existing = materialTypes.get(item.type);
        materialTypes.set(item.type, {
          count: (existing?.count || 0) + 1,
          image: existing?.image || item.image_url || null,
        });
      }
    });

    materialTypes.forEach((data, type) => {
      categoryList.push({
        id: `material:${type}`,
        label: materialTypeLabels[type] || type,
        icon: materialTypeIcons[type] || <Package className="w-4 h-4" />,
        count: data.count,
        type: 'material',
        image: data.image,
      });
    });

    return categoryList;
  }, [productTemplates, availableItems, selectedLinha]);

  // Get items for selected linha and category
  const items = useMemo(() => {
    if (!selectedLinha || !selectedCategory) return { products: [], materials: [] };
    
    const [type, categoryId] = selectedCategory.split(':');
    
    if (type === 'product') {
      const products = availableProducts.filter(product => {
        const template = productTemplates?.find(t => t.id === product.product_template_id);
        return template?.linha === selectedLinha && template?.category === categoryId;
      });
      return { products, materials: [] };
    } else {
      const materials = availableItems.filter(
        item => item.linha === selectedLinha && item.type === categoryId
      );
      return { products: [], materials };
    }
  }, [selectedLinha, selectedCategory, availableProducts, availableItems, productTemplates]);

  const handleSelectLinha = (linha: string) => {
    setSelectedLinha(linha);
    setStep('categories');
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setStep('items');
  };

  const handleBack = () => {
    if (step === 'items') {
      setSelectedCategory(null);
      setStep('categories');
    } else if (step === 'categories') {
      setSelectedLinha(null);
      setStep('linhas');
    }
  };

  const handleSelectProduct = (product: CompanyProduct) => {
    console.log('Selected product:', product);
    onSelectProduct(product);
    // Reset to allow adding more items
    setStep('linhas');
    setSelectedLinha(null);
    setSelectedCategory(null);
  };

  const handleSelectMaterial = (item: ItemTemplate) => {
    console.log('Selected material:', item);
    onSelectMaterial(item);
    // Reset to allow adding more items
    setStep('linhas');
    setSelectedLinha(null);
    setSelectedCategory(null);
  };

  const getImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `/products/${url}`;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="border rounded-xl bg-card overflow-hidden shadow-lg">
      {/* Header with navigation */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
        {step !== 'linhas' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleBack}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
          <button
            onClick={() => { setStep('linhas'); setSelectedLinha(null); setSelectedCategory(null); }}
            className={cn(
              "transition-colors truncate text-base",
              step === 'linhas' ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Linhas
          </button>
          {selectedLinha && (
            <>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <button
                onClick={() => { setStep('categories'); setSelectedCategory(null); }}
                className={cn(
                  "transition-colors truncate text-base",
                  step === 'categories' ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {selectedLinha}
              </button>
            </>
          )}
          {selectedCategory && (
            <>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-primary font-semibold truncate text-base">
                {categories.find(c => c.id === selectedCategory)?.label || selectedCategory}
              </span>
            </>
          )}
        </div>
      </div>

      <ScrollArea className="h-[450px]">
        {/* Step 1: Linhas */}
        {step === 'linhas' && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {linhas.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">Nenhuma linha disponível</p>
              </div>
            ) : (
              linhas.map((linha) => {
                const imageUrl = getImageUrl(linha.image);
                return (
                  <button
                    key={linha.name}
                    onClick={() => handleSelectLinha(linha.name)}
                    className="group relative flex flex-col items-center p-4 rounded-xl border-2 bg-background hover:border-primary hover:shadow-lg transition-all text-center"
                  >
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center mb-3 overflow-hidden">
                      {imageUrl ? (
                        <img src={imageUrl} alt={linha.name} className="w-full h-full object-contain p-2" />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                      {linha.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {linha.totalCount} itens
                    </p>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Step 2: Categories */}
        {step === 'categories' && (
          <div className="p-4 grid grid-cols-2 gap-4">
            {categories.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">Nenhuma categoria nesta linha</p>
              </div>
            ) : (
              categories.map((category) => {
                const imageUrl = getImageUrl(category.image);
                return (
                  <button
                    key={category.id}
                    onClick={() => handleSelectCategory(category.id)}
                    className="group flex flex-col items-center p-4 rounded-xl border-2 bg-background hover:border-primary hover:shadow-lg transition-all"
                  >
                    <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-3 overflow-hidden">
                      {imageUrl ? (
                        <img src={imageUrl} alt={category.label} className="w-full h-full object-contain p-2" />
                      ) : (
                        <span className="text-muted-foreground scale-150">{category.icon}</span>
                      )}
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {category.label}
                      </h3>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <Badge 
                          variant={category.type === 'product' ? 'default' : 'secondary'} 
                          className="text-[10px] px-2 py-0.5"
                        >
                          {category.type === 'product' ? 'Produto' : 'Material'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {category.count} {category.count === 1 ? 'item' : 'itens'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Step 3: Items (Products or Materials) */}
        {step === 'items' && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.products.length === 0 && items.materials.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">Nenhum item disponível</p>
              </div>
            ) : (
              <>
                {/* Products */}
                {items.products.map((product) => {
                  const template = productTemplates?.find(t => t.id === product.product_template_id);
                  const imageUrl = getImageUrl(template?.image_url);
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 bg-background hover:border-primary hover:shadow-lg transition-all group"
                    >
                      <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {imageUrl ? (
                          <img src={imageUrl} alt={product.commercial_name} className="w-full h-full object-contain p-2" />
                        ) : (
                          <Package className="w-7 h-7 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                          {product.commercial_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">Produto</p>
                        <span className="text-base font-bold text-primary mt-1 block">
                          {product.base_price ? formatCurrency(product.base_price) : 'Sob consulta'}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Materials */}
                {items.materials.map((item) => {
                  const imageUrl = getImageUrl(item.image_url);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectMaterial(item)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 bg-background hover:border-primary hover:shadow-lg transition-all group"
                    >
                      <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.name} className="w-full h-full object-contain p-2" />
                        ) : (
                          <span className="text-muted-foreground scale-150">
                            {materialTypeIcons[item.type] || <Package className="w-6 h-6" />}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{materialTypeLabels[item.type] || item.type}</span>
                          <span>•</span>
                          <span>{item.unit}</span>
                        </div>
                        <span className="text-base font-bold text-primary mt-1 block">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
