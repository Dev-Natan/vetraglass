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
import { Trash2, Search, Download, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Produtos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipologiasSheetOpen, setTipologiasSheetOpen] = useState(false);
  const [selectedLinhaForDownload, setSelectedLinhaForDownload] = useState<string | null>(null);
  const [addLinhaSheetOpen, setAddLinhaSheetOpen] = useState(false);
  const [createCustomDialogOpen, setCreateCustomDialogOpen] = useState(false);
  const [createLinhaDialogOpen, setCreateLinhaDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Fetch company activated products
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('product_template_id, is_active, linha, is_custom')
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

  // Calculate activated count per linha (including custom products)
  const linhasWithActivatedCount = useMemo(() => {
    if (!allLinhas) return [];
    
    const activatedIds = new Set(companyProducts.filter(cp => cp.product_template_id).map(cp => cp.product_template_id));
    
    // Get custom product linhas
    const customLinhas = new Map<string, number>();
    companyProducts.filter(cp => (cp as any).is_custom).forEach(cp => {
      const linha = (cp as any).linha || 'Personalizado';
      customLinhas.set(linha, (customLinhas.get(linha) || 0) + 1);
    });
    
    const result = allLinhas.map(linhaItem => {
      const productsInLinha = allProducts.filter(p => (p.linha || 'Sem Linha') === linhaItem.linha);
      const activatedCount = productsInLinha.filter(p => activatedIds.has(p.id)).length;
      const customCount = customLinhas.get(linhaItem.linha) || 0;
      return {
        ...linhaItem,
        activatedCount: activatedCount + customCount,
        hasActivatedProducts: activatedCount > 0 || customCount > 0
      };
    });

    // Add custom-only linhas that don't exist in templates
    customLinhas.forEach((count, linha) => {
      if (!result.find(r => r.linha === linha)) {
        result.push({
          linha,
          count,
          activatedCount: count,
          hasActivatedProducts: true
        });
      }
    });

    return result;
  }, [allLinhas, allProducts, companyProducts]);

  // Filter and sort linhas - only show lines with activated products
  const filteredLinhas = useMemo(() => {
    if (!linhasWithActivatedCount) return [];
    
    let result = linhasWithActivatedCount.filter(item => item.hasActivatedProducts);
    
    // Filter by search
    if (searchTerm) {
      result = result.filter(item => 
        item.linha.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sort alphabetically
    result.sort((a, b) => a.linha.localeCompare(b.linha));
    
    return result;
  }, [linhasWithActivatedCount, searchTerm]);

  // Deactivate all products from a linha
  const deactivateLinhaMutation = useMutation({
    mutationFn: async (linha: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      // Get product template IDs for this linha
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

      // Also deactivate custom products with this linha
      const { error: customError } = await supabase
        .from('company_products')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('linha', linha)
        .eq('is_custom', true);

      if (customError) throw customError;
    },
    onSuccess: (_, linha) => {
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
      <div className="space-y-6 pb-24 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">
              Produtos
            </h1>
            <p className="text-muted-foreground text-sm">
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
              className="max-w-md"
              autoFocus
            />
          </div>
        )}

        {/* Products Grid */}
        <div className="section-card">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
                  />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredLinhas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma linha encontrada.</p>
              <p className="text-sm mt-1">Clique em "Adicionar" para baixar produtos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-40">
        <div className="container mx-auto flex justify-center gap-12 sm:gap-16">
          <button 
            onClick={() => toast.info('Funcionalidade em desenvolvimento')}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <span className="text-xs">Lixeira</span>
          </button>
          
          <button 
            onClick={() => setSearchOpen(!searchOpen)}
            className={`flex flex-col items-center gap-1 transition-colors ${searchOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${searchOpen ? 'bg-primary/10' : 'bg-muted'}`}>
              <Search className="w-5 h-5" />
            </div>
            <span className="text-xs">Buscar</span>
          </button>
          
          <button 
            onClick={() => setAddLinhaSheetOpen(true)}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors relative"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center relative">
              <Download className="w-5 h-5" />
              {totalDownloadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-green-500 hover:bg-green-500">
                  {totalDownloadCount}
                </Badge>
              )}
            </div>
            <span className="text-xs">Baixar tipologias</span>
          </button>

          <button 
            onClick={() => setCreateCustomDialogOpen(true)}
            className="flex flex-col items-center gap-1 text-primary hover:text-primary/80 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xs">Personalizado</span>
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
