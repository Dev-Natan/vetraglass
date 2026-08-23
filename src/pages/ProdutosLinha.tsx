import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Search, Trash2, Plus, Check, ShoppingCart, DollarSign, AlertTriangle, Scissors, Ban, MoreVertical, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { ProductEditSheet } from '@/components/produtos/ProductEditSheet';
import { CreateCustomProductDialog } from '@/components/produtos/CreateCustomProductDialog';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';


type ProductTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  linha: string | null;
  image_url: string | null;
  is_active: boolean;
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
  companyProductId?: string;
  productTemplateId?: string;
  has_cutting_plan?: boolean;
};

export default function ProdutosLinha() {
  const { linha: linhaParam } = useParams<{ linha: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();
  const { labels: categoryLabels } = useProductCategoryLabels();
  const [searchTerm, setSearchTerm] = useState('');
  const [showActive, setShowActive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedCompanyProductId, setSelectedCompanyProductId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const currentLinha = linhaParam ? decodeURIComponent(linhaParam) : '';
  

  // Fetch ALL product templates for this linha
  const { data: products, isLoading } = useQuery({
    queryKey: ['linha-products', currentLinha],
    queryFn: async () => {
      let query = supabase
        .from('product_templates')
        .select('*')
        .eq('is_active', true);
      
      if (currentLinha === 'Sem Linha') {
        query = query.or('linha.is.null,linha.eq.""');
      } else {
        query = query.eq('linha', currentLinha);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data as ProductTemplate[];
    },
    enabled: !!currentLinha,
  });

  // Fetch company products
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id, 'detailed'],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, product_template_id, is_active, commercial_name, description, category, linha, image_url, is_custom, base_price')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentCompany?.id,
  });

  // Quick Activation Mutation
  const quickActivateMutation = useMutation({
    mutationFn: async (productTemplateId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase.rpc('activate_product_template_for_company', {
        _company_id: currentCompany.id,
        _product_template_id: productTemplateId,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto ativado para venda!');
    },
    onError: (error) => {
      toast.error('Erro ao ativar: ' + error.message);
    },
  });

  // Deactivate product
  const deactivateProductMutation = useMutation({
    mutationFn: async ({ id, isCustom }: { id: string; isCustom: boolean }) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase
        .from('company_products')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq(isCustom ? 'id' : 'product_template_id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto ocultado');
    },
    onError: (error) => {
      toast.error('Erro ao ocultar: ' + error.message);
    },
  });

  // Reactivate product
  const reactivateProductMutation = useMutation({
    mutationFn: async ({ id, isCustom }: { id: string; isCustom: boolean }) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase
        .from('company_products')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('company_id', currentCompany.id)
        .eq(isCustom ? 'id' : 'product_template_id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto reabilitado!');
    },
    onError: (error) => {
      toast.error('Erro ao reativar: ' + error.message);
    },
  });

  // Delete custom product permanently
  const deleteCustomMutation = useMutation({
    mutationFn: async (companyProductId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      const { error } = await supabase
        .from('company_products')
        .delete()
        .eq('company_id', currentCompany.id)
        .eq('id', companyProductId)
        .eq('is_custom', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto excluído');
    },
    onError: (error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  const filteredProducts = useMemo((): DisplayProduct[] => {
    const searchLower = searchTerm.toLowerCase();
    const templateIdsInCompany = new Set(companyProducts.map(cp => cp.product_template_id));
    
    // 1. Start with company products that match filters
    const companyFiltered = companyProducts
      .filter((cp) => {
        const template = products?.find(p => p.id === cp.product_template_id);
        const name = cp.commercial_name || template?.name || '';
        const effectiveLinha = cp.linha || template?.linha;
        const effectiveCategory = cp.category || template?.category || 'other';
        
        const matchesSearch = name.toLowerCase().includes(searchLower);
        const matchesCategory = selectedCategory === 'all' || effectiveCategory === selectedCategory;
        const matchesActiveStatus = cp.is_active === showActive;
        
        let matchesLinha = false;
        if (currentLinha === 'Sem Linha' || currentLinha === 'Personalizado') {
          matchesLinha = (!effectiveLinha || effectiveLinha === 'Sem Linha' || effectiveLinha === 'Personalizado');
        } else {
          matchesLinha = effectiveLinha === currentLinha;
        }
        
        return matchesSearch && matchesCategory && matchesActiveStatus && matchesLinha;
      })
      .map((cp): DisplayProduct => {
        const template = products?.find(p => p.id === cp.product_template_id);
        return {
          id: cp.id,
          name: cp.commercial_name || template?.name || '',
          description: cp.description || template?.description,
          category: cp.category || template?.category || 'other',
          linha: cp.linha || template?.linha,
          image_url: cp.image_url || template?.image_url,
          is_active: cp.is_active,
          is_custom: cp.is_custom || false,
          base_price: cp.base_price,
          companyProductId: cp.id,
          productTemplateId: cp.product_template_id || undefined,
          has_cutting_plan: (template as any)?.has_cutting_plan ?? true,
        };
      });

    // 2. Add templates not yet in company as "Inativos"
    if (!showActive) {
      const missingTemplates = (products || [])
        .filter(p => {
          const notInCompany = !templateIdsInCompany.has(p.id);
          const matchesSearch = p.name.toLowerCase().includes(searchLower);
          const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
          return notInCompany && matchesSearch && matchesCategory;
        })
        .map((p): DisplayProduct => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          linha: p.linha,
          image_url: p.image_url,
          is_active: false,
          is_custom: false,
          productTemplateId: p.id,
          has_cutting_plan: (p as any).has_cutting_plan ?? true,
        }));
      
      return [...companyFiltered, ...missingTemplates];
    }

    return companyFiltered;
  }, [products, companyProducts, searchTerm, selectedCategory, showActive, currentLinha]);

  const getImageUrl = (path: string | null, isCustom: boolean) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return path;
    const bucket = isCustom ? 'company-product-images' : 'product-templates';
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  };

  const getCategoryIcon = (category: string) => {
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
      <div className="space-y-3 sm:space-y-4 animate-fade-in pb-28 sm:pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-lg sm:text-2xl text-foreground truncate">
              {currentLinha}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {filteredProducts?.length || 0} produtos
            </p>
          </div>
        </div>

        {/* Toggle tabs */}
        <div className="flex rounded-lg overflow-hidden border w-full sm:w-auto">
          <button
            onClick={() => setShowActive(true)}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
              showActive 
                ? 'bg-sky-500 text-white' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setShowActive(false)}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
              !showActive 
                ? 'bg-gray-400 text-white' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Inativos
          </button>
        </div>

        {/* Search + Create */}
        <div className="flex gap-2 w-full">
          <Input
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 h-10 text-sm"
          />
          <Button variant="default" size="sm" className="bg-sky-500 hover:bg-sky-600 shrink-0 h-10 px-4">
            <Search className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="shrink-0 h-10 px-4 gap-1"
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </Button>
        </div>

        {/* Products List (Mobile + Desktop logic combined in filteredProducts) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full p-12 text-center text-muted-foreground">Carregando...</div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              return (
                <div
                  key={product.id + (product.productTemplateId || '')}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (product.companyProductId) {
                      navigate(`/produtos/empresa/editar/${product.companyProductId}`);
                    } else if (product.productTemplateId) {
                      quickActivateMutation.mutate(product.productTemplateId);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).click();
                    }
                  }}
                  className={`relative text-left bg-card border rounded-lg p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-primary/40 hover:bg-accent/30 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${!product.is_active ? 'opacity-70' : ''}`}
                >
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 p-1">
                    {product.image_url ? (
                      <img
                        src={getImageUrl(product.image_url, product.is_custom) || ''}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl">{getCategoryIcon(product.category)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                    <h3 className="font-semibold text-sky-700 uppercase text-sm line-clamp-2">{product.name}</h3>
                    <div className="flex flex-wrap gap-1">
                      {product.is_custom && <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700">Personalizado</Badge>}
                      {!product.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                      {product.has_cutting_plan ? (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 gap-1">
                          <Scissors className="w-3 h-3" /> Plano de Corte
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          <Ban className="w-3 h-3" /> Sem Corte
                        </Badge>
                      )}
                    </div>
                  </div>

                  {(product.companyProductId || product.productTemplateId) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" aria-label="Ações do produto">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {product.companyProductId && product.is_active && (
                          <DropdownMenuItem
                            onClick={() => deactivateProductMutation.mutate({ id: product.companyProductId!, isCustom: product.is_custom })}
                          >
                            <PowerOff className="w-4 h-4 mr-2" /> Desativar
                          </DropdownMenuItem>
                        )}
                        {product.companyProductId && !product.is_active && (
                          <DropdownMenuItem
                            onClick={() => reactivateProductMutation.mutate({ id: product.companyProductId!, isCustom: product.is_custom })}
                          >
                            <Power className="w-4 h-4 mr-2" /> Ativar
                          </DropdownMenuItem>
                        )}
                        {!product.companyProductId && product.productTemplateId && (
                          <DropdownMenuItem
                            onClick={() => quickActivateMutation.mutate(product.productTemplateId!)}
                          >
                            <Power className="w-4 h-4 mr-2" /> Ativar
                          </DropdownMenuItem>
                        )}
                        {product.is_custom && product.companyProductId && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm(`Excluir permanentemente "${product.name}"? Esta ação não pode ser desfeita.`)) {
                                deleteCustomMutation.mutate(product.companyProductId!);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center text-muted-foreground flex flex-col items-center gap-4">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
      </div>

      <ProductEditSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        companyProductId={selectedCompanyProductId}
      />

      <CreateCustomProductDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultLinha={currentLinha}
      />

    </MainLayout>
  );
}
