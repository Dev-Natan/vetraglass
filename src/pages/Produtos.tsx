import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LinhaCardModern } from '@/components/produtos/LinhaCardModern';
import { ProductsHeader } from '@/components/produtos/ProductsHeader';
import { ProductsSearchBar } from '@/components/produtos/ProductsSearchBar';
import { ProductsGridSkeleton } from '@/components/produtos/ProductsGridSkeleton';
import { EmptyProductsState } from '@/components/produtos/EmptyProductsState';
import { TipologiasSheet } from '@/components/produtos/TipologiasSheet';
import { AddLinhaSheet } from '@/components/produtos/AddLinhaSheet';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Local storage key for favorites
const FAVORITES_KEY = 'produtos-favoritos';

export default function Produtos() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tipologiasSheetOpen, setTipologiasSheetOpen] = useState(false);
  const [selectedLinhaForDownload, setSelectedLinhaForDownload] = useState<string | null>(null);
  const [addLinhaSheetOpen, setAddLinhaSheetOpen] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    }
  }, []);

  // Save favorites to localStorage
  const toggleFavorite = (linha: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(linha)
        ? prev.filter(f => f !== linha)
        : [...prev, linha];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // Fetch company activated products to filter linhas
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('product_template_id, is_active')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch ALL unique linhas with product count
  const { data: allLinhas, isLoading } = useQuery({
    queryKey: ['all-product-linhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('id, linha')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Group by linha and count
      const linhaMap = new Map<string, number>();
      data?.forEach((item) => {
        const linha = item.linha || 'Sem Linha';
        linhaMap.set(linha, (linhaMap.get(linha) || 0) + 1);
      });
      
      return Array.from(linhaMap.entries())
        .map(([linha, count]) => ({ linha, count }));
    },
  });

  // Count activated products per linha
  const getActivatedCountForLinha = (linha: string) => {
    // We need to check how many products from this linha are activated
    return companyProducts.length; // This will be refined below
  };

  // Fetch product templates to map linha to products
  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products-for-linhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('id, linha')
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate activated count per linha
  const linhasWithActivatedCount = useMemo(() => {
    if (!allLinhas) return [];
    
    const activatedIds = new Set(companyProducts.map(cp => cp.product_template_id));
    
    return allLinhas.map(linhaItem => {
      const productsInLinha = allProducts.filter(p => (p.linha || 'Sem Linha') === linhaItem.linha);
      const activatedCount = productsInLinha.filter(p => activatedIds.has(p.id)).length;
      return {
        ...linhaItem,
        activatedCount,
        hasActivatedProducts: activatedCount > 0
      };
    });
  }, [allLinhas, allProducts, companyProducts]);

  // Filter and sort linhas
  const filteredLinhas = useMemo(() => {
    if (!linhasWithActivatedCount) return [];
    
    // Only show lines that have activated products
    let result = linhasWithActivatedCount.filter(item => item.hasActivatedProducts);
    
    // Filter by search
    if (searchTerm) {
      result = result.filter(item => 
        item.linha.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by favorites
    if (showFavoritesOnly) {
      result = result.filter(item => favorites.includes(item.linha));
    }
    
    // Sort
    result.sort((a, b) => {
      const comparison = a.linha.localeCompare(b.linha);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [linhasWithActivatedCount, searchTerm, showFavoritesOnly, sortOrder, favorites]);

  const handleDownloadLinha = (linha: string) => {
    setSelectedLinhaForDownload(linha);
    setTipologiasSheetOpen(true);
  };

  const handleSelectLinhaFromSheet = (linha: string) => {
    setSelectedLinhaForDownload(linha);
    setTipologiasSheetOpen(true);
  };

  const handleViewProducts = (linha: string) => {
    navigate(`/produtos/linha/${encodeURIComponent(linha)}`);
  };

  const getEmptyStateType = () => {
    if (searchTerm) return 'no-results';
    if (showFavoritesOnly) return 'no-favorites';
    return 'empty';
  };

  // Get list of activated linhas for the AddLinhaSheet
  const activatedLinhas = filteredLinhas.map(l => l.linha);

  return (
    <MainLayout>
      <div className="space-y-6 pb-8 animate-fade-in">
        {/* Header */}
        <ProductsHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
          totalCount={linhasWithActivatedCount?.length || 0}
          sortOrder={sortOrder}
          onSortChange={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
        />

        {/* Search and Add Button */}
        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 w-full sm:w-auto">
              <ProductsSearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                resultsCount={filteredLinhas.length}
                totalCount={linhasWithActivatedCount?.length || 0}
              />
            </div>
            <Button 
              onClick={() => setAddLinhaSheetOpen(true)}
              className="gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Baixar Linha
            </Button>
          </div>

          {/* Content */}
          <div className={cn("mt-8", searchTerm && "mt-10")}>
            {isLoading ? (
              <ProductsGridSkeleton viewMode={viewMode} />
            ) : filteredLinhas.length > 0 ? (
              <div className={cn(
                viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" 
                  : "space-y-3"
              )}>
                {filteredLinhas.map((item, index) => (
                  <div 
                    key={item.linha}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <LinhaCardModern
                      linha={item.linha}
                      productCount={item.activatedCount}
                      onViewProducts={() => handleViewProducts(item.linha)}
                      onDownloadLinha={() => handleDownloadLinha(item.linha)}
                      isFavorite={favorites.includes(item.linha)}
                      onToggleFavorite={() => toggleFavorite(item.linha)}
                      viewMode={viewMode}
                      hasActivatedProducts={item.hasActivatedProducts}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyProductsState
                type={getEmptyStateType()}
                searchTerm={searchTerm}
                onClearSearch={() => setSearchTerm('')}
                onClearFavorites={() => setShowFavoritesOnly(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tipologias Sheet for downloading products */}
      <TipologiasSheet
        open={tipologiasSheetOpen}
        onOpenChange={setTipologiasSheetOpen}
        linha={selectedLinhaForDownload || ''}
      />

      {/* Add Linha Sheet */}
      <AddLinhaSheet
        open={addLinhaSheetOpen}
        onOpenChange={setAddLinhaSheetOpen}
        onSelectLinha={handleSelectLinhaFromSheet}
        activatedLinhas={activatedLinhas}
      />
    </MainLayout>
  );
}
