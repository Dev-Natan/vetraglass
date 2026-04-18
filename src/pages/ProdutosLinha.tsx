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
  composition_finished?: boolean;
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
      let query = supabase
        .from('product_templates')
        .select('*')
        .eq('is_active', true);
      
      // Handle the "Sem Linha" case where database value might be NULL
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

  // Fetch company products with their activation status
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id, 'detailed'],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, product_template_id, is_active, commercial_name, description, category, linha, image_url, is_custom, base_price, composition_finished')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentCompany?.id,
  });

  // Custom products are now part of companyProducts query
  const customProducts = useMemo(() => {
    return companyProducts.filter(cp => {
      if (!cp.is_custom) return false;
      
      const matchesLinha = currentLinha === 'Personalizado' 
        ? (cp.linha === null || cp.linha === '' || cp.linha === 'Sem Linha')
        : cp.linha === currentLinha;
        
      return matchesLinha;
    });
  }, [companyProducts, currentLinha]);

  // Check if product is activated for this company
  const isProductActivated = (productTemplateId: string) => {
    return companyProducts.some(
      cp => cp.product_template_id === productTemplateId && cp.is_active
    );
  };


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
    const searchLower = searchTerm.toLowerCase();
    
    // Process all company products (templates + custom)
    const companyFiltered = companyProducts
      .filter((cp) => {
        // Filter by search
        const matchesSearch = cp.commercial_name?.toLowerCase().includes(searchLower) || 
                             (products?.find(p => p.id === cp.product_template_id)?.name.toLowerCase().includes(searchLower));
        
        // Filter by category
        const matchesCategory = selectedCategory === 'all' || cp.category === selectedCategory;
        
        // Filter by active status
        const matchesActiveStatus = cp.is_active === showActive;
        
        // Filter by linha
        let matchesLinha = false;
        const template = products?.find(p => p.id === cp.product_template_id);
        const effectiveLinha = cp.linha || template?.linha;
        
        if (currentLinha === 'Sem Linha' || currentLinha === 'Personalizado') {
          matchesLinha = (!effectiveLinha || effectiveLinha === 'Sem Linha' || effectiveLinha === 'Personalizado');
        } else {
          matchesLinha = effectiveLinha === currentLinha;
        }
        
        return matchesSearch && matchesCategory && matchesActiveStatus && matchesLinha;
      })
      .map((cp): DisplayProduct => ({
        // Always use company_products.id as the canonical id for active products
        // so navigation goes to /produtos/empresa/editar/<companyProductId>
        id: cp.id,
        name: cp.commercial_name,
        description: cp.description,
        category: cp.category || 'other',
        linha: cp.linha,
        image_url: cp.image_url,
        is_active: cp.is_active,
        is_custom: cp.is_custom || false,
        base_price: cp.base_price,
        companyProductId: cp.id,
        composition_finished: cp.composition_finished || false,
      }));

    // If showing "Desabilitados", we also want to show templates that haven't been activated yet
    if (!showActive) {
      const templateIdsActivated = new Set(companyProducts.map(cp => cp.product_template_id));
      const unactivatedTemplates = (products || [])
        .filter(p => {
          const matchesSearch = p.name.toLowerCase().includes(searchLower);
          const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
          const notActivated = !templateIdsActivated.has(p.id);
          return matchesSearch && matchesCategory && notActivated;
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
          companyProductId: undefined,
          composition_finished: false,
        }));
      
      return [...companyFiltered, ...unactivatedTemplates];
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
                  <div className="flex items-center gap-3 relative">
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 p-1 relative">
                      {product.image_url ? (
                        <img 
                          src={getImageUrl(product.image_url, product.is_custom) || ''} 
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl">{getCategoryIcon(product.category)}</span>
                      )}
                      {product.composition_finished && (
                        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border border-white">
                          <Check className="w-3 h-3" />
                        </div>
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
                      {product.composition_finished && (
                        <Badge variant="secondary" className="text-[10px] mt-1 bg-green-100 text-green-700 border-green-200">
                          <Check className="w-3 h-3 mr-1" />
                          Composição OK
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
                            setSelectedProductForActivation({ id: product.id, name: product.name });
                            setActivateDialogOpen(true);
                          }
                        }}
                        disabled={reactivateCustomProductMutation.isPending}
                      >
                        Habilitar
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs h-9"
                      onClick={() => {
                        if (!product.companyProductId) {
                          toast.error('Ative o produto antes de editar.');
                          queryClient.invalidateQueries({ queryKey: ['company-products'] });
                          return;
                        }
                        navigate(`/produtos/empresa/editar/${product.companyProductId}`);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground opacity-50">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div className="max-w-[280px] space-y-2">
                <p className="font-medium text-foreground">
                  {searchTerm 
                    ? 'Nenhum produto encontrado.'
                    : showActive 
                      ? 'Nenhum produto habilitado.'
                      : 'Nenhum produto desabilitado.'}
                </p>
                {!searchTerm && showActive && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Você ainda não ativou nenhum produto desta linha para venda.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 text-sky-600 border-sky-200 hover:bg-sky-50"
                      onClick={() => setTipologiasSheetOpen(true)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar produtos da linha
                    </Button>
                  </>
                )}
              </div>
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
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 p-1 relative">
                      {product.image_url ? (
                        <img 
                          src={getImageUrl(product.image_url, product.is_custom) || ''} 
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xl">{getCategoryIcon(product.category)}</span>
                      )}
                      {product.composition_finished && (
                        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border border-white">
                          <Check className="w-4 h-4" />
                        </div>
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
                      {product.composition_finished && (
                        <Badge variant="secondary" className="w-fit text-[10px] mt-0.5 bg-green-100 text-green-700 border-green-200">
                          <Check className="w-3 h-3 mr-1" />
                          Composição OK
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
                            setSelectedProductForActivation({ id: product.id, name: product.name });
                            setActivateDialogOpen(true);
                          }
                        }}
                        disabled={reactivateCustomProductMutation.isPending}
                      >
                        Habilitar
                      </Button>
                    )}


                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white font-medium"
                      onClick={() => {
                        if (!product.companyProductId) {
                          toast.error('Ative o produto antes de editar.');
                          queryClient.invalidateQueries({ queryKey: ['company-products'] });
                          return;
                        }
                        navigate(`/produtos/empresa/editar/${product.companyProductId}`);
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
              queryClient.invalidateQueries({ queryKey: ['linha-products'] });
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
