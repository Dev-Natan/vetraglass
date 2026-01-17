import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LinhaCardModern } from '@/components/produtos/LinhaCardModern';
import { ProductsHeader } from '@/components/produtos/ProductsHeader';
import { ProductsSearchBar } from '@/components/produtos/ProductsSearchBar';
import { ProductsGridSkeleton } from '@/components/produtos/ProductsGridSkeleton';
import { EmptyProductsState } from '@/components/produtos/EmptyProductsState';
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

  // Fetch unique linhas with product count (only activated products)
  const { data: linhas, isLoading } = useQuery({
    queryKey: ['product-linhas', companyProducts],
    queryFn: async () => {
      if (companyProducts.length === 0) return [];
      
      const activatedTemplateIds = companyProducts.map(cp => cp.product_template_id);
      
      const { data, error } = await supabase
        .from('product_templates')
        .select('linha')
        .eq('is_active', true)
        .in('id', activatedTemplateIds);
      
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
    enabled: companyProducts.length > 0,
  });

  // Filter and sort linhas
  const filteredLinhas = useMemo(() => {
    if (!linhas) return [];
    
    let result = [...linhas];
    
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
  }, [linhas, searchTerm, showFavoritesOnly, sortOrder, favorites]);

  const handleViewProducts = (linha: string) => {
    navigate(`/produtos/linha/${encodeURIComponent(linha)}`);
  };

  const getEmptyStateType = () => {
    if (searchTerm) return 'no-results';
    if (showFavoritesOnly) return 'no-favorites';
    return 'empty';
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-8 animate-fade-in">
        {/* Header */}
        <ProductsHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
          totalCount={linhas?.length || 0}
          sortOrder={sortOrder}
          onSortChange={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
        />

        {/* Search */}
        <div className="section-card">
          <ProductsSearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            resultsCount={filteredLinhas.length}
            totalCount={linhas?.length || 0}
          />

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
                      productCount={item.count}
                      onViewProducts={() => handleViewProducts(item.linha)}
                      isFavorite={favorites.includes(item.linha)}
                      onToggleFavorite={() => toggleFavorite(item.linha)}
                      viewMode={viewMode}
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
    </MainLayout>
  );
}
