import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Search, Trash2, Download, Percent, Plus, Filter, Check, ShoppingCart, Sparkles, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ActivateProductDialog } from '@/components/produtos/ActivateProductDialog';
import { TipologiasSheet } from '@/components/produtos/TipologiasSheet';
import { CreateCustomProductDialog } from '@/components/produtos/CreateCustomProductDialog';

type ProductTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  linha: string | null;
  image_url: string | null;
  is_active: boolean;
};

type CustomProduct = {
  id: string;
  commercial_name: string;
  description: string | null;
  category: string | null;
  linha: string | null;
  image_url: string | null;
  is_active: boolean;
  is_custom: boolean;
  base_price: number | null;
};

type DisplayProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  linha: string | null;
  image_url: string | null;
  is_active: boolean;
  is_custom: boolean;
  base_price?: number | null;
};

export default function ProdutosLinha() {
  const { linha: linhaParam } = useParams<{ linha: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showActive, setShowActive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedProductForActivation, setSelectedProductForActivation] = useState<{ id: string; name: string } | null>(null);
  const [tipologiasSheetOpen, setTipologiasSheetOpen] = useState(false);
  const [createCustomDialogOpen, setCreateCustomDialogOpen] = useState(false);

  // Category labels
  const categoryLabels: Record<string, string> = {
    window: 'Janela',
    door: 'Porta',
    facade: 'Fachada',
    shower: 'Box de Banheiro',
    mirror: 'Espelho',
    partition: 'Divisória',
    guarda_corpo: 'Guarda Corpo',
    other: 'Outros',
  };

  const currentLinha = linhaParam ? decodeURIComponent(linhaParam) : '';

  // Fetch products for this linha
  const { data: products, isLoading } = useQuery({
    queryKey: ['linha-products', currentLinha, showActive],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('linha', currentLinha)
        .eq('is_active', showActive)
        .order('name');
      
      if (error) throw error;
      return data as ProductTemplate[];
    },
    enabled: !!currentLinha,
  });

  // Fetch company products to know which ones are activated
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, product_template_id, is_active')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch custom products for this linha
  const { data: customProducts = [] } = useQuery({
    queryKey: ['custom-products', currentCompany?.id, currentLinha, showActive],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, commercial_name, description, category, linha, image_url, is_active, is_custom, base_price')
        .eq('company_id', currentCompany.id)
        .eq('linha', currentLinha)
        .eq('is_custom', true)
        .eq('is_active', showActive);
      
      if (error) throw error;
      return (data || []) as CustomProduct[];
    },
    enabled: !!currentCompany?.id && !!currentLinha,
  });

  // Check if product is activated for this company
  const isProductActivated = (productTemplateId: string) => {
    return companyProducts.some(
      cp => cp.product_template_id === productTemplateId && cp.is_active
    );
  };

  // Activate product for company
  const activateProductMutation = useMutation({
    mutationFn: async (productTemplateId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { data, error } = await supabase.rpc('activate_product_template_for_company', {
        _company_id: currentCompany.id,
        _product_template_id: productTemplateId,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto ativado para venda!');
    },
    onError: (error) => {
      toast.error('Erro ao ativar: ' + error.message);
    },
  });

  // Deactivate product for company (template products)
  const deactivateProductMutation = useMutation({
    mutationFn: async (productTemplateId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase
        .from('company_products')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('product_template_id', productTemplateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      toast.success('Produto desativado para venda');
    },
    onError: (error) => {
      toast.error('Erro ao desativar: ' + error.message);
    },
  });

  // Deactivate custom product
  const deactivateCustomProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase
        .from('company_products')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      toast.success('Produto personalizado desativado');
    },
    onError: (error) => {
      toast.error('Erro ao desativar: ' + error.message);
    },
  });

  // Toggle active mutation (for templates - admin only)
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('product_templates')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linha-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-linhas'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Get unique categories from products (including custom)
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    products?.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    customProducts.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    return Array.from(categories).sort();
  }, [products, customProducts]);

  // Combine and filter products
  const filteredProducts = useMemo((): DisplayProduct[] => {
    // Filter template products that are activated
    const templateFiltered = (products || [])
      .filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        const isActivated = companyProducts.some(cp => cp.product_template_id === p.id && cp.is_active);
        return matchesSearch && matchesCategory && isActivated;
      })
      .map((p): DisplayProduct => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        linha: p.linha,
        image_url: p.image_url,
        is_active: p.is_active,
        is_custom: false,
      }));

    // Filter custom products
    const customFiltered = customProducts
      .filter((p) => {
        const matchesSearch = p.commercial_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .map((p): DisplayProduct => ({
        id: p.id,
        name: p.commercial_name,
        description: p.description,
        category: p.category || 'other',
        linha: p.linha,
        image_url: p.image_url,
        is_active: p.is_active,
        is_custom: true,
        base_price: p.base_price,
      }));

    return [...templateFiltered, ...customFiltered];
  }, [products, customProducts, searchTerm, selectedCategory, companyProducts]);

  const getCategoryIcon = (category: string) => {
    // Simple placeholder icons based on category
    const icons: Record<string, string> = {
      window: '🪟',
      door: '🚪',
      shower: '🚿',
      mirror: '🪞',
      partition: '📐',
      facade: '🏢',
      other: '📦',
    };
    return icons[category] || '📦';
  };

  return (
    <MainLayout>
      <div className="space-y-4 animate-fade-in pb-24">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">
              {currentLinha}
            </h1>
            <p className="text-muted-foreground text-sm">
              {filteredProducts?.length || 0} produtos
            </p>
          </div>
        </div>

        {/* Search and Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex gap-2 flex-1 w-full sm:w-auto">
            <Input
              placeholder="Nome"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button variant="default" size="sm" className="bg-sky-500 hover:bg-sky-600 shrink-0">
              Buscar
            </Button>
          </div>
          
          {/* Toggle tabs */}
          <div className="flex rounded-lg overflow-hidden border">
            <button
              onClick={() => setShowActive(true)}
              className={`px-6 py-2 text-sm font-medium transition-colors ${
                showActive 
                  ? 'bg-sky-500 text-white' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Habilitados
            </button>
            <button
              onClick={() => setShowActive(false)}
              className={`px-6 py-2 text-sm font-medium transition-colors ${
                !showActive 
                  ? 'bg-gray-400 text-white' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Desabilitados
            </button>
          </div>
        </div>

        {/* Products list */}
        <div className="section-card p-0 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-muted/30 border-b text-sm font-medium text-muted-foreground">
            <div className="col-span-5">Produto</div>
            <div className="col-span-1 text-center hidden sm:block">Horas</div>
            <div className="col-span-7 sm:col-span-6"></div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <div className="divide-y">
              {filteredProducts.map((product) => {
                const isActivated = product.is_custom || isProductActivated(product.id);
                return (
                <div
                  key={product.id}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/20 transition-colors"
                >
                  {/* Product info */}
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 p-1">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xl">{getCategoryIcon(product.category)}</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sky-600 uppercase text-sm">
                        {product.name}
                      </span>
                      {product.is_custom && (
                        <Badge variant="secondary" className="w-fit text-[10px] mt-0.5 bg-purple-100 text-purple-700">
                          Personalizado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="col-span-1 text-center hidden sm:block text-muted-foreground text-sm">
                    {product.is_custom ? '-' : '5'}
                  </div>

                  {/* Actions */}
                  <div className="col-span-7 sm:col-span-6 flex items-center justify-end gap-2">
                    {/* Desabilitar */}
                    {product.is_custom ? (
                      <Button
                        size="sm"
                        className="bg-amber-400 hover:bg-amber-500 text-amber-900 font-medium"
                        onClick={() => deactivateCustomProductMutation.mutate(product.id)}
                        disabled={deactivateCustomProductMutation.isPending}
                      >
                        Desabilitar
                      </Button>
                    ) : isActivated ? (
                      <Button
                        size="sm"
                        className="bg-amber-400 hover:bg-amber-500 text-amber-900 font-medium"
                        onClick={() => deactivateProductMutation.mutate(product.id)}
                        disabled={deactivateProductMutation.isPending}
                      >
                        Desabilitar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white font-medium"
                        onClick={() => {
                          setSelectedProductForActivation({ id: product.id, name: product.name });
                          setActivateDialogOpen(true);
                        }}
                      >
                        Habilitar
                      </Button>
                    )}
                    
                    {/* Fazer cópia - only for template products */}
                    {!product.is_custom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => toast.info('Funcionalidade em desenvolvimento')}
                      >
                        Fazer cópia
                        <Copy className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                    
                    {/* Editar produto */}
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white font-medium"
                      onClick={() => {
                        if (product.is_custom) {
                          toast.info('Edição de produto personalizado em desenvolvimento');
                        } else {
                          navigate(`/produtos/editar/${product.id}`);
                        }
                      }}
                    >
                      Editar produto
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm 
                ? 'Nenhum produto encontrado com esse nome.'
                : showActive 
                  ? 'Nenhum produto habilitado nesta linha.'
                  : 'Nenhum produto desabilitado nesta linha.'}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
          <div className="container mx-auto flex justify-center gap-8 sm:gap-12">
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
              onClick={() => setTipologiasSheetOpen(true)}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors relative"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center relative">
                <Download className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-sky-500 hover:bg-sky-500">
                  344
                </Badge>
              </div>
              <span className="text-xs">Baixar tipologias</span>
            </button>
            
            <button 
              onClick={() => toast.info('Funcionalidade em desenvolvimento')}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
              <span className="text-xs">Margem de lucro</span>
            </button>
            
            <button 
              onClick={() => setCreateCustomDialogOpen(true)}
              className="flex flex-col items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs">Cadastrar produto</span>
            </button>
          </div>
        </div>

        {/* Tipologias Sheet */}
        <TipologiasSheet
          open={tipologiasSheetOpen}
          onOpenChange={setTipologiasSheetOpen}
          linha={currentLinha}
        />

        {/* Activate Product Dialog */}
        {selectedProductForActivation && (
          <ActivateProductDialog
            open={activateDialogOpen}
            onOpenChange={setActivateDialogOpen}
            productTemplateId={selectedProductForActivation.id}
            productName={selectedProductForActivation.name}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['company-products'] });
            }}
          />
        )}

        {/* Create Custom Product Dialog */}
        <CreateCustomProductDialog
          open={createCustomDialogOpen}
          onOpenChange={setCreateCustomDialogOpen}
          defaultLinha={currentLinha}
        />
      </div>
    </MainLayout>
  );
}
