import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Search, Trash2, Plus, Check, ShoppingCart, DollarSign, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { EditProductPricingDialog } from '@/components/produtos/EditProductPricingDialog';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';
import { useProductLowStockStatus } from '@/hooks/useProductLowStockStatus';

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
  composition_finished?: boolean;
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
  const [editPricingDialogOpen, setEditPricingDialogOpen] = useState(false);
  const [selectedProductForPricing, setSelectedProductForPricing] = useState<{ id: string; name: string; image_url?: string | null } | null>(null);

  const currentLinha = linhaParam ? decodeURIComponent(linhaParam) : '';
  const { getStatus: getLowStockStatus } = useProductLowStockStatus(currentCompany?.id);

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

        {/* Search */}
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
        </div>

        {/* Products List (Mobile + Desktop logic combined in filteredProducts) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full p-12 text-center text-muted-foreground">Carregando...</div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const lowStockStatus = getLowStockStatus(product.productTemplateId, product.companyProductId);
              return (
                <div
                  key={product.id + (product.productTemplateId || '')}
                  className={`bg-card border rounded-lg p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow ${
                    lowStockStatus === 'zero' ? 'border-destructive/40 bg-destructive/5' :
                    lowStockStatus === 'low' ? 'border-amber-500/40 bg-amber-50/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
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
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sky-700 uppercase text-sm line-clamp-2">{product.name}</h3>
                      {product.is_custom && <Badge variant="secondary" className="mt-1 text-[10px] bg-purple-100 text-purple-700">Personalizado</Badge>}
                      {lowStockStatus === 'zero' && <Badge variant="destructive" className="mt-1 text-[10px]">Sem Estoque</Badge>}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    {product.is_active ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            if (product.companyProductId) {
                              setSelectedProductForPricing({ id: product.companyProductId, name: product.name, image_url: product.image_url });
                              setEditPricingDialogOpen(true);
                            }
                          }}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Preços
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => deactivateProductMutation.mutate({ id: product.productTemplateId || product.id, isCustom: product.is_custom })}
                          disabled={deactivateProductMutation.isPending}
                        >
                          Ocultar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          if (product.companyProductId) {
                            reactivateProductMutation.mutate({ id: product.id, isCustom: product.is_custom });
                          } else if (product.productTemplateId) {
                            quickActivateMutation.mutate(product.productTemplateId);
                          }
                        }}
                        disabled={quickActivateMutation.isPending || reactivateProductMutation.isPending}
                      >
                        {quickActivateMutation.isPending ? 'Ativando...' : 'Habilitar'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => product.companyProductId && navigate(`/produtos/empresa/editar/${product.companyProductId}`)}
                      disabled={!product.companyProductId}
                    >
                      Editar
                    </Button>
                  </div>
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

      <EditProductPricingDialog
        open={editPricingDialogOpen}
        onOpenChange={setEditPricingDialogOpen}
        product={selectedProductForPricing}
      />
    </MainLayout>
  );
}
