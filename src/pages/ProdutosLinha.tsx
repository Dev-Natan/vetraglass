import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Search, Trash2, Download, Percent, Plus, Filter, Check, ShoppingCart, Sparkles, DollarSign } from 'lucide-react';
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

import { EditProductPricingDialog } from '@/components/produtos/EditProductPricingDialog';
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
  companyProductId?: string; // ID in company_products table for pricing
};

export default function ProdutosLinha() {
  const { linha: linhaParam } = useParams<{ linha: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();
  const { labels: categoryLabels, categories: productCategories } = useProductCategoryLabels();
  const [searchTerm, setSearchTerm] = useState('');
  const [showActive, setShowActive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedProductForActivation, setSelectedProductForActivation] = useState<{ id: string; name: string } | null>(null);
  const [tipologiasSheetOpen, setTipologiasSheetOpen] = useState(false);
  const [createCustomDialogOpen, setCreateCustomDialogOpen] = useState(false);
  const [editPricingDialogOpen, setEditPricingDialogOpen] = useState(false);
  const [selectedProductForPricing, setSelectedProductForPricing] = useState<{ id: string; name: string; image_url?: string | null } | null>(null);

  const currentLinha = linhaParam ? decodeURIComponent(linhaParam) : '';

  // Fetch ALL product templates for this linha (active templates only - global status)
  const { data: products, isLoading } = useQuery({
    queryKey: ['linha-products', currentLinha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('linha', currentLinha)
        .eq('is_active', true) // Templates globalmente ativos
        .order('name');
      
      if (error) throw error;
      return data as ProductTemplate[];
    },
    enabled: !!currentLinha,
  });

  // Fetch company products with their activation status
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, product_template_id, is_active, commercial_name')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch custom products for this linha (all, we filter by showActive in filteredProducts)
  const { data: customProducts = [] } = useQuery({
    queryKey: ['custom-products', currentCompany?.id, currentLinha],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, commercial_name, description, category, linha, image_url, is_active, is_custom, base_price')
        .eq('company_id', currentCompany.id)
        .eq('linha', currentLinha)
        .eq('is_custom', true);
      
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
      queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] });
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
      queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] });
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
      queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] });
      toast.success('Produto personalizado desativado');
    },
    onError: (error) => {
      toast.error('Erro ao desativar: ' + error.message);
    },
  });

  // Reactivate custom product
  const reactivateCustomProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase
        .from('company_products')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('company_id', currentCompany.id)
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] });
      toast.success('Produto personalizado reativado!');
    },
    onError: (error) => {
      toast.error('Erro ao reativar: ' + error.message);
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

  // Combine and filter products based on showActive tab
  const filteredProducts = useMemo((): DisplayProduct[] => {
    // Filter template products based on company activation status
    const templateFiltered = (products || [])
      .filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        
        // Find the company product record for this template
        const companyProduct = companyProducts.find(cp => cp.product_template_id === p.id);
        
        // Check if matches the current tab (showActive)
        if (showActive) {
          // Show only products that are activated for the company
          return matchesSearch && matchesCategory && companyProduct?.is_active === true;
        } else {
          // Show products that exist in company_products but are deactivated
          return matchesSearch && matchesCategory && companyProduct && companyProduct.is_active === false;
        }
      })
      .map((p): DisplayProduct => {
        const companyProduct = companyProducts.find(cp => cp.product_template_id === p.id);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          linha: p.linha,
          image_url: p.image_url,
          is_active: companyProduct?.is_active ?? false,
          is_custom: false,
          companyProductId: companyProduct?.id,
        };
      });

    // Filter custom products based on their is_active status
    const customFiltered = customProducts
      .filter((p) => {
        const matchesSearch = p.commercial_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesActiveStatus = p.is_active === showActive;
        return matchesSearch && matchesCategory && matchesActiveStatus;
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
        companyProductId: p.id, // For custom products, id IS the company_product_id
      }));

    return [...templateFiltered, ...customFiltered];
  }, [products, customProducts, searchTerm, selectedCategory, companyProducts, showActive]);

  const getImageUrl = (path: string | null, isCustom: boolean) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return path;
    const bucket = isCustom ? 'company-product-images' : 'product-templates';
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  };

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

        {/* Toggle tabs - mobile first */}
        <div className="flex rounded-lg overflow-hidden border w-full sm:w-auto">
          <button
            onClick={() => setShowActive(true)}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
              showActive 
                ? 'bg-sky-500 text-white' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Habilitados
          </button>
          <button
            onClick={() => setShowActive(false)}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
              !showActive 
                ? 'bg-gray-400 text-white' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Desabilitados
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

        {/* Products list - Mobile Card View */}
        <div className="space-y-2 sm:hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              return (
                <div
                  key={product.id}
                  className="bg-card border rounded-lg p-3 space-y-3"
                >
                  {/* Product header */}
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 p-1">
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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sky-600 uppercase text-sm leading-tight line-clamp-2">
                        {product.name}
                      </h3>
                      {product.is_custom && (
                        <Badge variant="secondary" className="text-[10px] mt-1 bg-purple-100 text-purple-700">
                          Personalizado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions - based on product.is_active status */}
                  <div className="flex gap-2">
                    {product.is_active ? (
                      // Product is active - show deactivate and pricing buttons
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-9"
                          onClick={() => {
                            if (product.companyProductId) {
                              setSelectedProductForPricing({
                                id: product.companyProductId,
                                name: product.name,
                                image_url: product.image_url,
                              });
                              setEditPricingDialogOpen(true);
                            } else {
                              toast.error('Erro ao carregar dados do produto. Recarregue a página.');
                              queryClient.invalidateQueries({ queryKey: ['company-products'] });
                            }
                          }}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Preços
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-amber-400 hover:bg-amber-500 text-amber-900 font-medium text-xs h-9"
                          onClick={() => {
                            if (product.is_custom) {
                              deactivateCustomProductMutation.mutate(product.id);
                            } else {
                              deactivateProductMutation.mutate(product.id);
                            }
                          }}
                          disabled={deactivateProductMutation.isPending || deactivateCustomProductMutation.isPending}
                        >
                          Desabilitar
                        </Button>
                      </>
                    ) : (
                      // Product is inactive - show activate button
                      <Button
                        size="sm"
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium text-xs h-9"
                        onClick={() => {
                          if (product.is_custom) {
                            reactivateCustomProductMutation.mutate(product.id);
                          } else {
                            // For template products, use the RPC function
                            activateProductMutation.mutate(product.id);
                          }
                        }}
                        disabled={activateProductMutation.isPending || reactivateCustomProductMutation.isPending}
                      >
                        Habilitar
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs h-9"
                      onClick={() => {
                        navigate(`/produtos/empresa/editar/${product.id}`);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {searchTerm 
                ? 'Nenhum produto encontrado.'
                : showActive 
                  ? 'Nenhum produto habilitado.'
                  : 'Nenhum produto desabilitado.'}
            </div>
          )}
        </div>

        {/* Products list - Desktop Table View */}
        <div className="section-card p-0 overflow-hidden hidden sm:block">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-muted/30 border-b text-sm font-medium text-muted-foreground">
            <div className="col-span-5">Produto</div>
            <div className="col-span-1 text-center">Horas</div>
            <div className="col-span-6"></div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <div className="divide-y">
              {filteredProducts.map((product) => {
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
                          src={getImageUrl(product.image_url, product.is_custom) || ''} 
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
                  <div className="col-span-1 text-center text-muted-foreground text-sm">
                    {product.is_custom ? '-' : '5'}
                  </div>

                  {/* Actions - based on product.is_active status */}
                  <div className="col-span-6 flex items-center justify-end gap-2">
                    {product.is_active ? (
                      // Product is active - show pricing and deactivate buttons
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (product.companyProductId) {
                              setSelectedProductForPricing({
                                id: product.companyProductId,
                                name: product.name,
                                image_url: product.image_url,
                              });
                              setEditPricingDialogOpen(true);
                            } else {
                              toast.error('Erro ao carregar dados do produto. Recarregue a página.');
                              queryClient.invalidateQueries({ queryKey: ['company-products'] });
                            }
                          }}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Preços
                        </Button>
                        <Button
                          size="sm"
                          className="bg-amber-400 hover:bg-amber-500 text-amber-900 font-medium"
                          onClick={() => {
                            if (product.is_custom) {
                              deactivateCustomProductMutation.mutate(product.id);
                            } else {
                              deactivateProductMutation.mutate(product.id);
                            }
                          }}
                          disabled={deactivateProductMutation.isPending || deactivateCustomProductMutation.isPending}
                        >
                          Desabilitar
                        </Button>
                      </>
                    ) : (
                      // Product is inactive - show activate button
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white font-medium"
                        onClick={() => {
                          if (product.is_custom) {
                            reactivateCustomProductMutation.mutate(product.id);
                          } else {
                            // For template products, use the RPC function
                            activateProductMutation.mutate(product.id);
                          }
                        }}
                        disabled={activateProductMutation.isPending || reactivateCustomProductMutation.isPending}
                      >
                        Habilitar
                      </Button>
                    )}


                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white font-medium"
                      onClick={() => {
                        navigate(`/produtos/empresa/editar/${product.id}`);
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
        <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-background/95 backdrop-blur border-t p-3 sm:p-4 z-40">
          <div className="container mx-auto flex justify-center gap-4 sm:gap-12">
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
              onClick={() => setTipologiasSheetOpen(true)}
              className="flex flex-col items-center gap-0.5 sm:gap-1 text-muted-foreground hover:text-foreground transition-colors relative"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center relative">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <Badge className="absolute -top-1 -right-1 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[9px] sm:text-[10px] bg-sky-500 hover:bg-sky-500">
                  344
                </Badge>
              </div>
              <span className="text-[10px] sm:text-xs">Baixar</span>
            </button>
            
            <button 
              onClick={() => toast.info('Funcionalidade em desenvolvimento')}
              className="flex flex-col items-center gap-0.5 sm:gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center">
                <Percent className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs">Margem</span>
            </button>
            
            <button 
              onClick={() => setCreateCustomDialogOpen(true)}
              className="flex flex-col items-center gap-0.5 sm:gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-[10px] sm:text-xs">Novo</span>
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


        {/* Edit Product Pricing Dialog */}
        {selectedProductForPricing && (
          <EditProductPricingDialog
            open={editPricingDialogOpen}
            onOpenChange={setEditPricingDialogOpen}
            companyProductId={selectedProductForPricing.id}
            productName={selectedProductForPricing.name}
            productImageUrl={selectedProductForPricing.image_url}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['company-products'] });
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}
