import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LinhaCardSimple } from '@/components/produtos/LinhaCardSimple';
import { AddLinhaCard } from '@/components/produtos/AddLinhaCard';
import { TipologiasSheet } from '@/components/produtos/TipologiasSheet';
import { AddLinhaSheet } from '@/components/produtos/AddLinhaSheet';
import { CreateCustomProductDialog } from '@/components/produtos/CreateCustomProductDialog';
import { CreateLinhaDialog } from '@/components/produtos/CreateLinhaDialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Search, Download, Sparkles, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';

export default function Produtos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();
  
  // Module tutorial trigger
  useModuleTutorialTrigger('produtos');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tipologiasSheetOpen, setTipologiasSheetOpen] = useState(false);
  const [selectedLinhaForDownload, setSelectedLinhaForDownload] = useState<string | null>(null);
  const [addLinhaSheetOpen, setAddLinhaSheetOpen] = useState(false);
  const [createCustomDialogOpen, setCreateCustomDialogOpen] = useState(false);
  const [createLinhaDialogOpen, setCreateLinhaDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { labels: categoryLabels, categories } = useProductCategoryLabels();

  // Fetch company linhas (linhas criadas pela empresa)
  const { data: companyLinhas = [] } = useQuery({
    queryKey: ['company-linhas', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_linhas')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch company activated products
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, product_template_id, is_active, linha, is_custom, category')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch ALL unique linhas with product count (from templates - for download)
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

  // Fetch product templates to map linha to products
  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products-for-linhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('id, linha, category')
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Build combined linhas list (company_linhas + linhas with products)
  const filteredLinhas = useMemo(() => {
    const linhasMap = new Map<string, { linha: string; productCount: number; isFromCompanyLinhas: boolean; categories: Set<string> }>();
    
    // 1. Add all company_linhas first (user-created lines)
    companyLinhas.forEach((cl) => {
      linhasMap.set(cl.name, {
        linha: cl.name,
        productCount: 0,
        isFromCompanyLinhas: true,
        categories: new Set(),
      });
    });

    // 2. Count products per linha (from company_products)
    const activatedTemplateIds = new Set(
      companyProducts.filter(cp => cp.product_template_id).map(cp => cp.product_template_id)
    );
    
    // Count activated template products per linha
    allProducts.forEach((p) => {
      if (activatedTemplateIds.has(p.id)) {
        const linhaName = p.linha || 'Sem Linha';
        const existing = linhasMap.get(linhaName);
        if (existing) {
          existing.productCount += 1;
          existing.categories.add(p.category);
        } else {
          linhasMap.set(linhaName, {
            linha: linhaName,
            productCount: 1,
            isFromCompanyLinhas: false,
            categories: new Set([p.category]),
          });
        }
      }
    });

    // Count custom products per linha
    companyProducts.filter(cp => cp.is_custom).forEach((cp) => {
      const linhaName = cp.linha || 'Personalizado';
      const existing = linhasMap.get(linhaName);
      if (existing) {
        existing.productCount += 1;
        if (cp.category) existing.categories.add(cp.category);
      } else {
        linhasMap.set(linhaName, {
          linha: linhaName,
          productCount: 1,
          isFromCompanyLinhas: false,
          categories: new Set(cp.category ? [cp.category] : []),
        });
      }
    });

    // 3. Convert to array and filter
    let result = Array.from(linhasMap.values());
    
    // Filter by search
    if (searchTerm) {
      result = result.filter(item => 
        item.linha.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter(item => item.categories.has(selectedCategory));
    }
    
    // Sort alphabetically
    result.sort((a, b) => a.linha.localeCompare(b.linha));
    
    return result;
  }, [companyLinhas, companyProducts, allProducts, searchTerm]);

  // Deactivate/remove a linha
  const deactivateLinhaMutation = useMutation({
    mutationFn: async (linha: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      // 1. Deactivate company_linha if exists
      await supabase
        .from('company_linhas')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('name', linha);

      // 2. Get product template IDs for this linha
      const templateIds = allProducts
        .filter(p => p.linha === linha)
        .map(p => p.id);
      
      if (templateIds.length > 0) {
        const { error } = await supabase
          .from('company_products')
          .update({ is_active: false })
          .eq('company_id', currentCompany.id)
          .in('product_template_id', templateIds);
        
        if (error) throw error;
      }

      // 3. Also deactivate custom products with this linha
      const { error: customError } = await supabase
        .from('company_products')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('linha', linha)
        .eq('is_custom', true);

      if (customError) throw customError;
    },
    onSuccess: (_, linha) => {
      queryClient.invalidateQueries({ queryKey: ['company-linhas'] });
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success(`Linha "${linha}" removida`);
    },
    onError: (error) => {
      toast.error('Erro ao remover linha: ' + error.message);
    },
  });

  const handleRemoveLinha = (linha: string) => {
    if (confirm(`Deseja remover todos os produtos da linha "${linha}"?`)) {
      deactivateLinhaMutation.mutate(linha);
    }
  };

  const handleSelectLinhaFromSheet = (linha: string) => {
    setSelectedLinhaForDownload(linha);
    setTipologiasSheetOpen(true);
  };

  const handleViewProducts = (linha: string) => {
    navigate(`/produtos/linha/${encodeURIComponent(linha)}`);
  };

  // Count total download available
  const totalDownloadCount = allLinhas?.reduce((acc, l) => acc + l.count, 0) || 0;

  // Get list of activated linhas for the AddLinhaSheet
  const activatedLinhas = filteredLinhas.map(l => l.linha);

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 pb-28 sm:pb-24 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground">
              Produtos
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {filteredLinhas.length} linhas ativas
            </p>
          </div>
        </div>

        {/* Search Bar (conditional) */}
        {searchOpen && (
          <div className="animate-fade-in">
            <Input
              placeholder="Buscar linha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-md h-10"
              autoFocus
            />
          </div>
        )}

        {/* Categories Bar */}
        <div className="section-card p-3 sm:p-4 mb-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="rounded-full h-8 text-xs"
              >
                Todas Linhas
              </Button>
              {categories?.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.slug ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                  className="rounded-full h-8 text-xs whitespace-nowrap"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Products Grid */}
        <div className="section-card p-3 sm:p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-28 sm:h-36 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {/* Add Card - First Position */}
              <AddLinhaCard onClick={() => setCreateLinhaDialogOpen(true)} />

              {/* Linha Cards */}
              {filteredLinhas.map((item, index) => (
                <div 
                  key={item.linha}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <LinhaCardSimple
                    linha={item.linha}
                    onViewProducts={() => handleViewProducts(item.linha)}
                    onRemove={() => handleRemoveLinha(item.linha)}
                    isRemovable={true}
                    categories={Array.from(item.categories)}
                    categoryLabels={categoryLabels}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredLinhas.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <p className="text-sm sm:text-base">Nenhuma linha encontrada.</p>
              <p className="text-xs sm:text-sm mt-1">Clique em "Adicionar" para baixar produtos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-background/95 backdrop-blur border-t p-3 sm:p-4 z-40">
        <div className="container mx-auto flex justify-center gap-4 sm:gap-16">
          <button 
            onClick={() => toast.info('Funcionalidade em desenvolvimento')}
            className="flex flex-col items-center gap-0.5 sm:gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center">
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-xs">Lixeira</span>
          </button>
          
          <button 
            onClick={() => setSearchOpen(!searchOpen)}
            className={`flex flex-col items-center gap-0.5 sm:gap-1 transition-colors ${searchOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${searchOpen ? 'bg-primary/10' : 'bg-muted'}`}>
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-xs">Buscar</span>
          </button>
          
          <button 
            onClick={() => setAddLinhaSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 sm:gap-1 text-muted-foreground hover:text-foreground transition-colors relative"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center relative">
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              {totalDownloadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[9px] sm:text-[10px] bg-green-500 hover:bg-green-500">
                  {totalDownloadCount}
                </Badge>
              )}
            </div>
            <span className="text-[10px] sm:text-xs">Baixar</span>
          </button>

          <button 
            onClick={() => setCreateCustomDialogOpen(true)}
            className="flex flex-col items-center gap-0.5 sm:gap-1 text-primary hover:text-primary/80 transition-colors"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <span className="text-[10px] sm:text-xs">Novo</span>
          </button>
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

      {/* Create Custom Product Dialog */}
      <CreateCustomProductDialog
        open={createCustomDialogOpen}
        onOpenChange={setCreateCustomDialogOpen}
      />

      {/* Create Linha Dialog */}
      <CreateLinhaDialog
        open={createLinhaDialogOpen}
        onOpenChange={setCreateLinhaDialogOpen}
      />
    </MainLayout>
  );
}
