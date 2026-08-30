import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LinhaCardSimple } from '@/components/produtos/LinhaCardSimple';
import { AddLinhaCard } from '@/components/produtos/AddLinhaCard';
import { CreateCustomProductDialog } from '@/components/produtos/CreateCustomProductDialog';
import { CreateLinhaDialog } from '@/components/produtos/CreateLinhaDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Sparkles, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { ManageLinhasDialog } from '@/components/produtos/ManageLinhasDialog';

export default function Produtos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();
  
  useModuleTutorialTrigger('produtos');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showActive, setShowActive] = useState(true);
  const [createCustomDialogOpen, setCreateCustomDialogOpen] = useState(false);
  const [createLinhaDialogOpen, setCreateLinhaDialogOpen] = useState(false);
  const [manageLinhasOpen, setManageLinhasOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { labels: categoryLabels, categories } = useProductCategoryLabels();
  const { data: productLinhas } = useCompanyLinhas();
  const getLinhaLabel = (slug: string) => productLinhas?.find(l => l.slug.toLowerCase() === slug.toLowerCase() || l.name.toLowerCase() === slug.toLowerCase())?.name || slug;
  const activeLinhaKeys = useMemo(() => {
    const set = new Set<string>();
    (productLinhas || []).forEach(l => {
      if (l.slug) set.add(l.slug.toLowerCase());
      if (l.name) set.add(l.name.toLowerCase());
    });
    return set;
  }, [productLinhas]);

  // Empresa: linhas explicitamente ativadas. Se vazio → considera todas.
  const { data: enabledLinhaSlugs = [] } = useQuery({
    queryKey: ['company-enabled-linhas', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [] as string[];
      const { data, error } = await supabase
        .from('company_enabled_linhas')
        .select('linha_slug')
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      return (data || []).map((row) => row.linha_slug.toLowerCase());
    },
    enabled: !!currentCompany?.id,
  });
  const enabledSet = useMemo(() => new Set(enabledLinhaSlugs), [enabledLinhaSlugs]);
  const hasEnabledFilter = enabledSet.size > 0;

  const isLinhaAllowed = (linhaName: string) => {
    if (linhaName === 'Sem Linha' || linhaName === 'Personalizado') return true;
    if (!activeLinhaKeys.has(linhaName.toLowerCase())) return false;
    if (hasEnabledFilter) {
      const slug = productLinhas?.find(l => l.name.toLowerCase() === linhaName.toLowerCase() || l.slug.toLowerCase() === linhaName.toLowerCase())?.slug?.toLowerCase();
      return slug ? enabledSet.has(slug) : false;
    }
    return true;
  };


  // Fetch company activated products
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { error: catalogError } = await supabase.rpc('ensure_company_catalog', { _company_id: currentCompany.id });
      if (catalogError) throw catalogError;
      const { data, error } = await supabase
        .from('company_products')
        .select('id, product_template_id, is_active, linha, is_custom, category')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch product templates to map system linhas
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

  const filteredLinhas = useMemo(() => {
    const activeLinhasMap = new Map<string, { linha: string; productCount: number; categories: Set<string> }>();
    const inactiveLinhasMap = new Map<string, { linha: string; productCount: number; categories: Set<string> }>();
    
    // Process system templates
    allProducts.forEach(p => {
      const linhaName = p.linha || 'Sem Linha';
      const isActivated = companyProducts.some(cp => cp.product_template_id === p.id && cp.is_active);
      
      const targetMap = isActivated ? activeLinhasMap : inactiveLinhasMap;
      
      if (!targetMap.has(linhaName)) {
        targetMap.set(linhaName, { linha: linhaName, productCount: 0, categories: new Set() });
      }
      const entry = targetMap.get(linhaName)!;
      entry.productCount++;
      if (p.category) entry.categories.add(p.category);
    });

    // Process custom products
    companyProducts.filter(cp => cp.is_custom).forEach(cp => {
      const linhaName = cp.linha || 'Personalizado';
      const targetMap = cp.is_active ? activeLinhasMap : inactiveLinhasMap;

      if (!targetMap.has(linhaName)) {
        targetMap.set(linhaName, { linha: linhaName, productCount: 0, categories: new Set() });
      }
      const entry = targetMap.get(linhaName)!;
      entry.productCount++;
      if (cp.category) entry.categories.add(cp.category);
    });

    let result = Array.from((showActive ? activeLinhasMap : inactiveLinhasMap).values());

    // Ocultar grupos cuja linha esteja desativada no dicionário do Admin SaaS
    result = result.filter(item => isLinhaAllowed(item.linha));

    if (searchTerm) {
      result = result.filter(item => item.linha.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (selectedCategory) {
      result = result.filter(item => item.categories.has(selectedCategory));
    }

    return result.sort((a, b) => a.linha.localeCompare(b.linha));
  }, [companyProducts, allProducts, searchTerm, selectedCategory, showActive, activeLinhaKeys, enabledSet, productLinhas]);

  const handleRemoveLinha = async (linha: string) => {
    if (!currentCompany?.id) return;
    if (confirm(`Deseja ocultar todos os produtos da linha "${linha}"?`)) {
      const { error } = await supabase
        .from('company_products')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('linha', linha);
      
      if (error) toast.error('Erro ao remover: ' + error.message);
      else {
        queryClient.invalidateQueries({ queryKey: ['company-products'] });
        toast.success(`Linha "${linha}" ocultada`);
      }
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 pb-28 sm:pb-24 animate-fade-in">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground">Produtos</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {filteredLinhas.length} linhas {showActive ? 'disponíveis' : 'ocultas'}
              {hasEnabledFilter && <span className="ml-1">· {enabledSet.size} linhas habilitadas</span>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setManageLinhasOpen(true)} className="gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Gerenciar Linhas</span>
          </Button>
        </div>

        <div className="flex rounded-lg overflow-hidden border w-full sm:w-auto">
          <button
            onClick={() => setShowActive(true)}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium transition-colors ${showActive ? 'bg-sky-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            Disponíveis
          </button>
          <button
            onClick={() => setShowActive(false)}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium transition-colors ${!showActive ? 'bg-gray-400 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            Ocultos
          </button>
        </div>

        {searchOpen && (
          <Input
            placeholder="Buscar linha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-md h-10"
            autoFocus
          />
        )}

        <div className="section-card p-3 sm:p-4 mb-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2">
              <Button variant={selectedCategory === null ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(null)} className="rounded-full h-8 text-xs">Todas Linhas</Button>
              {categories?.map((cat) => (
                <Button key={cat.id} variant={selectedCategory === cat.slug ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)} className="rounded-full h-8 text-xs whitespace-nowrap">{cat.name}</Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="section-card p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {showActive && <AddLinhaCard onClick={() => setCreateLinhaDialogOpen(true)} />}
            {filteredLinhas.map((item) => (
              <LinhaCardSimple
                key={item.linha}
                linha={item.linha}
                label={getLinhaLabel(item.linha)}
                onViewProducts={() => navigate(`/produtos/linha/${encodeURIComponent(item.linha)}`)}
                onRemove={() => handleRemoveLinha(item.linha)}
                isRemovable={showActive}
                categories={Array.from(item.categories)}
                categoryLabels={categoryLabels}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-background/95 backdrop-blur border-t p-3 sm:p-4 z-40">
        <div className="container mx-auto flex justify-center gap-12 sm:gap-16">
          <button onClick={() => setCreateCustomDialogOpen(true)} className="flex flex-col items-center gap-1 text-primary">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary-foreground" /></div>
            <span className="text-xs">Novo</span>
          </button>
        </div>
      </div>

      <CreateCustomProductDialog open={createCustomDialogOpen} onOpenChange={setCreateCustomDialogOpen} />
      <CreateLinhaDialog open={createLinhaDialogOpen} onOpenChange={setCreateLinhaDialogOpen} />
      <ManageLinhasDialog open={manageLinhasOpen} onOpenChange={setManageLinhasOpen} />
    </MainLayout>
  );
}
