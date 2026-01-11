import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, Package, ChevronRight, Layers, 
  Sparkles, SquareStack, Wrench, X 
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

interface SearchResult {
  type: 'linha' | 'category' | 'material' | 'product';
  id: string;
  name: string;
  image?: string | null;
  linha?: string | null;
  category?: string;
  count?: number;
  price?: number;
  unit?: string;
  itemType?: string;
  companyProduct?: CompanyProduct;
  itemTemplate?: ItemTemplate;
}

interface UniversalProductSearchProps {
  availableItems: ItemTemplate[];
  availableProducts: CompanyProduct[];
  onSelectMaterial: (item: ItemTemplate) => void;
  onSelectProduct: (product: CompanyProduct) => void;
  placeholder?: string;
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

const typeIcons: Record<string, React.ReactNode> = {
  profile: <SquareStack className="w-4 h-4" />,
  glass: <Sparkles className="w-4 h-4" />,
  accessory: <Wrench className="w-4 h-4" />,
  service: <Layers className="w-4 h-4" />,
};

const typeLabels: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  accessory: 'Acessório',
  service: 'Serviço',
};

export function UniversalProductSearch({
  availableItems,
  availableProducts,
  onSelectMaterial,
  onSelectProduct,
  placeholder = "Buscar linha, categoria ou produto...",
}: UniversalProductSearchProps) {
  const { currentCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch product templates for images
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get unique linhas with images
  const linhas = useMemo(() => {
    const linhaMap = new Map<string, { count: number; image: string | null }>();
    
    // From product templates
    productTemplates?.forEach(p => {
      if (p.linha) {
        const existing = linhaMap.get(p.linha);
        linhaMap.set(p.linha, {
          count: (existing?.count || 0) + 1,
          image: existing?.image || p.image_url,
        });
      }
    });
    
    // From materials
    availableItems.forEach(item => {
      if (item.linha) {
        const existing = linhaMap.get(item.linha);
        linhaMap.set(item.linha, {
          count: (existing?.count || 0) + 1,
          image: existing?.image || item.image_url || null,
        });
      }
    });

    return Array.from(linhaMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      image: data.image,
    }));
  }, [productTemplates, availableItems]);

  // Get categories for selected linha
  const categories = useMemo(() => {
    if (!selectedLinha) return [];
    
    const catMap = new Map<string, { count: number; image: string | null }>();
    
    productTemplates?.filter(p => p.linha === selectedLinha).forEach(p => {
      if (p.category) {
        const existing = catMap.get(p.category);
        catMap.set(p.category, {
          count: (existing?.count || 0) + 1,
          image: existing?.image || p.image_url,
        });
      }
    });

    return Array.from(catMap.entries()).map(([name, data]) => ({
      name,
      label: categoryLabels[name] || name,
      icon: categoryIcons[name] || '📦',
      count: data.count,
      image: data.image,
    }));
  }, [productTemplates, selectedLinha]);

  // Build search results
  const searchResults = useMemo((): SearchResult[] => {
    const results: SearchResult[] = [];
    const query = searchTerm.toLowerCase().trim();

    // If navigating into a linha
    if (selectedLinha && !selectedCategory) {
      // Show categories for this linha
      categories.forEach(cat => {
        if (!query || cat.label.toLowerCase().includes(query) || cat.name.toLowerCase().includes(query)) {
          results.push({
            type: 'category',
            id: cat.name,
            name: cat.label,
            image: cat.image,
            linha: selectedLinha,
            count: cat.count,
          });
        }
      });
      return results;
    }

    // If navigating into a category
    if (selectedLinha && selectedCategory) {
      // Show products in this category
      availableProducts.forEach(product => {
        const template = productTemplates?.find(t => t.id === product.product_template_id);
        if (template?.linha === selectedLinha && template?.category === selectedCategory) {
          if (!query || product.commercial_name.toLowerCase().includes(query)) {
            results.push({
              type: 'product',
              id: product.id,
              name: product.commercial_name,
              image: template?.image_url,
              linha: selectedLinha,
              category: selectedCategory,
              price: product.base_price || undefined,
              companyProduct: product,
            });
          }
        }
      });
      return results;
    }

    // Default: show everything based on search
    if (!query) {
      // Show linhas by default
      linhas.slice(0, 6).forEach(linha => {
        results.push({
          type: 'linha',
          id: linha.name,
          name: linha.name,
          image: linha.image,
          count: linha.count,
        });
      });
    } else {
      // Search across everything
      
      // Search linhas
      linhas.filter(l => l.name.toLowerCase().includes(query)).slice(0, 3).forEach(linha => {
        results.push({
          type: 'linha',
          id: linha.name,
          name: linha.name,
          image: linha.image,
          count: linha.count,
        });
      });

      // Search categories
      Object.entries(categoryLabels).filter(([key, label]) => 
        label.toLowerCase().includes(query) || key.toLowerCase().includes(query)
      ).slice(0, 3).forEach(([key, label]) => {
        const template = productTemplates?.find(t => t.category === key);
        if (template) {
          results.push({
            type: 'category',
            id: key,
            name: label,
            image: template.image_url,
            linha: template.linha || undefined,
          });
        }
      });

      // Search products
      availableProducts.filter(p => 
        p.commercial_name.toLowerCase().includes(query)
      ).slice(0, 5).forEach(product => {
        const template = productTemplates?.find(t => t.id === product.product_template_id);
        results.push({
          type: 'product',
          id: product.id,
          name: product.commercial_name,
          image: template?.image_url,
          linha: template?.linha || undefined,
          category: template?.category,
          price: product.base_price || undefined,
          companyProduct: product,
        });
      });

      // Search materials
      availableItems.filter(item => 
        item.name.toLowerCase().includes(query)
      ).slice(0, 5).forEach(item => {
        results.push({
          type: 'material',
          id: item.id,
          name: item.name,
          image: item.image_url,
          linha: item.linha || undefined,
          price: item.price,
          unit: item.unit,
          itemType: item.type,
          itemTemplate: item,
        });
      });
    }

    return results;
  }, [searchTerm, selectedLinha, selectedCategory, linhas, categories, availableProducts, availableItems, productTemplates]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'linha') {
      setSelectedLinha(result.id);
      setSearchTerm('');
    } else if (result.type === 'category') {
      if (result.linha) {
        setSelectedLinha(result.linha);
      }
      setSelectedCategory(result.id);
      setSearchTerm('');
    } else if (result.type === 'product' && result.companyProduct) {
      onSelectProduct(result.companyProduct);
      resetSearch();
    } else if (result.type === 'material' && result.itemTemplate) {
      onSelectMaterial(result.itemTemplate);
      resetSearch();
    }
  };

  const resetSearch = () => {
    setSearchTerm('');
    setSelectedLinha(null);
    setSelectedCategory(null);
    setIsOpen(false);
  };

  const goBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
    } else if (selectedLinha) {
      setSelectedLinha(null);
    }
    setSearchTerm('');
  };

  const getImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `/products/${url}`;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (selectedLinha) parts.push(selectedLinha);
    if (selectedCategory) parts.push(categoryLabels[selectedCategory] || selectedCategory);
    return parts;
  }, [selectedLinha, selectedCategory]);

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-9 pr-9"
        />
        {(searchTerm || selectedLinha) && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
            onClick={resetSearch}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Breadcrumb Navigation */}
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-2 bg-muted/50 border-b text-sm">
              <button
                onClick={resetSearch}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Início
              </button>
              {breadcrumb.map((part, index) => (
                <div key={index} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <button
                    onClick={() => {
                      if (index === 0) {
                        setSelectedCategory(null);
                      }
                    }}
                    className={cn(
                      "transition-colors",
                      index === breadcrumb.length - 1 
                        ? "text-primary font-medium" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {part}
                  </button>
                </div>
              ))}
            </div>
          )}

          <ScrollArea className="max-h-80">
            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum resultado encontrado</p>
              </div>
            ) : (
              <div className="py-1">
                {/* Group results by type when searching */}
                {!selectedLinha && searchTerm && (
                  <>
                    {/* Linhas Section */}
                    {searchResults.filter(r => r.type === 'linha').length > 0 && (
                      <div className="px-2 py-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground px-2 mb-1">Linhas</p>
                        {searchResults.filter(r => r.type === 'linha').map(result => (
                          <ResultItem key={result.id} result={result} onSelect={handleSelect} getImageUrl={getImageUrl} formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}

                    {/* Categories Section */}
                    {searchResults.filter(r => r.type === 'category').length > 0 && (
                      <div className="px-2 py-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground px-2 mb-1">Categorias</p>
                        {searchResults.filter(r => r.type === 'category').map(result => (
                          <ResultItem key={result.id} result={result} onSelect={handleSelect} getImageUrl={getImageUrl} formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}

                    {/* Products Section */}
                    {searchResults.filter(r => r.type === 'product').length > 0 && (
                      <div className="px-2 py-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground px-2 mb-1">Produtos</p>
                        {searchResults.filter(r => r.type === 'product').map(result => (
                          <ResultItem key={result.id} result={result} onSelect={handleSelect} getImageUrl={getImageUrl} formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}

                    {/* Materials Section */}
                    {searchResults.filter(r => r.type === 'material').length > 0 && (
                      <div className="px-2 py-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground px-2 mb-1">Materiais</p>
                        {searchResults.filter(r => r.type === 'material').map(result => (
                          <ResultItem key={result.id} result={result} onSelect={handleSelect} getImageUrl={getImageUrl} formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Default grid layout for browsing */}
                {(!searchTerm || selectedLinha) && (
                  <div className="p-2">
                    {searchResults.map(result => (
                      <ResultItem key={result.id} result={result} onSelect={handleSelect} getImageUrl={getImageUrl} formatCurrency={formatCurrency} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// Separate component for result items
function ResultItem({ 
  result, 
  onSelect, 
  getImageUrl,
  formatCurrency,
}: { 
  result: SearchResult; 
  onSelect: (result: SearchResult) => void;
  getImageUrl: (url: string | null | undefined) => string | null;
  formatCurrency: (value: number) => string;
}) {
  const imageUrl = getImageUrl(result.image);
  const isNavigable = result.type === 'linha' || result.type === 'category';

  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors text-left",
        "hover:bg-muted/80 group"
      )}
    >
      {/* Image/Icon */}
      <div className={cn(
        "shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center",
        result.type === 'material' ? "w-10 h-10" : "w-12 h-12"
      )}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={result.name}
            className="w-full h-full object-contain p-1"
          />
        ) : result.type === 'category' ? (
          <span className="text-lg">{categoryIcons[result.id] || '📦'}</span>
        ) : result.type === 'material' && result.itemType ? (
          <span className="text-muted-foreground">{typeIcons[result.itemType] || <Package className="w-4 h-4" />}</span>
        ) : (
          <Package className="w-5 h-5 text-muted-foreground/50" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {result.name}
          </p>
          {result.type === 'linha' && (
            <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">Linha</Badge>
          )}
          {result.type === 'category' && (
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">Categoria</Badge>
          )}
          {result.type === 'material' && result.itemType && (
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
              {typeLabels[result.itemType] || result.itemType}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {result.linha && result.type !== 'linha' && (
            <span>{result.linha}</span>
          )}
          {result.count !== undefined && (
            <span>{result.count} {result.count === 1 ? 'item' : 'itens'}</span>
          )}
          {result.unit && (
            <span>{result.unit}</span>
          )}
        </div>
      </div>

      {/* Price or Arrow */}
      {result.price !== undefined ? (
        <span className="text-sm font-semibold text-primary shrink-0">
          {formatCurrency(result.price)}
        </span>
      ) : isNavigable ? (
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      ) : null}
    </button>
  );
}
