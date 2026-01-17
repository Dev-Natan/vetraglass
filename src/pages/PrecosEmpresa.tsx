import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, Package, Search, Save, Filter, ChevronDown, ChevronRight, Layers, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ProductPrice {
  id?: string;
  product_template_id: string;
  base_price: number;
  margin_percent: number;
  commercial_name: string;
}

interface ItemPrice {
  item_template_id: string;
  cost: number;
  price: number;
}

interface ProductTemplateItem {
  id: string;
  item_template_id: string;
  quantity_formula: string;
  item_template: {
    id: string;
    name: string;
    unit: string;
    default_price: number | null;
    image_url: string | null;
  };
}

const categoryLabels: Record<string, string> = {
  window: 'Janelas',
  door: 'Portas',
  facade: 'Fachadas',
  partition: 'Divisórias',
  shower: 'Box/Banheiros',
  mirror: 'Espelhos',
  guarda_corpo: 'Guarda Corpo',
  other: 'Outros',
};

export default function PrecosEmpresa() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedLinha, setSelectedLinha] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [prices, setPrices] = useState<Record<string, ProductPrice>>({});
  const [itemPrices, setItemPrices] = useState<Record<string, ItemPrice>>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch all product templates
  const { data: productTemplates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['product-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('is_active', true)
        .order('linha')
        .order('category')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch product template items (components)
  const { data: productItems } = useQuery({
    queryKey: ['product-template-items-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          id,
          product_template_id,
          item_template_id,
          quantity_formula,
          item_template:item_templates (
            id,
            name,
            unit,
            default_price,
            image_url
          )
        `)
        .is('company_id', null);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing company products
  const { data: companyProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('*')
        .eq('company_id', currentCompany.id);

      if (error) throw error;
      
      // Initialize prices state with existing data
      const pricesMap: Record<string, ProductPrice> = {};
      data?.forEach((product) => {
        pricesMap[product.product_template_id] = {
          id: product.id,
          product_template_id: product.product_template_id,
          base_price: Number(product.base_price) || 0,
          margin_percent: Number(product.margin_percent) || 0,
          commercial_name: product.commercial_name,
        };
      });
      setPrices(pricesMap);
      
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch existing company item prices
  const { data: companyItemPrices } = useQuery({
    queryKey: ['company-item-prices', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_item_prices')
        .select('*')
        .eq('company_id', currentCompany.id);

      if (error) throw error;
      
      // Initialize item prices state
      const itemPricesMap: Record<string, ItemPrice> = {};
      data?.forEach((item) => {
        itemPricesMap[item.item_template_id] = {
          item_template_id: item.item_template_id,
          cost: Number(item.cost) || 0,
          price: Number(item.price) || 0,
        };
      });
      setItemPrices(itemPricesMap);
      
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Group items by product template
  const itemsByProduct = useMemo(() => {
    const grouped: Record<string, ProductTemplateItem[]> = {};
    productItems?.forEach((item: any) => {
      if (!grouped[item.product_template_id]) {
        grouped[item.product_template_id] = [];
      }
      grouped[item.product_template_id].push(item);
    });
    return grouped;
  }, [productItems]);

  // Calculate product cost based on component prices
  const calculateProductCost = (productId: string): number => {
    const items = itemsByProduct[productId] || [];
    let totalCost = 0;
    
    items.forEach((item) => {
      const itemPrice = itemPrices[item.item_template_id];
      const price = itemPrice?.price || item.item_template?.default_price || 0;
      // For simplicity, assume quantity 1 for base calculation
      // The actual formula would need dimensions to calculate properly
      totalCost += price;
    });
    
    return totalCost;
  };

  // Save prices mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      // Save product prices
      const pricesToSave = Object.values(prices).filter(
        (p) => p.base_price > 0 || p.margin_percent > 0
      );

      for (const price of pricesToSave) {
        const template = productTemplates?.find(t => t.id === price.product_template_id);
        
        if (price.id) {
          const { error } = await supabase
            .from('company_products')
            .update({
              base_price: price.base_price,
              margin_percent: price.margin_percent,
              commercial_name: price.commercial_name,
            })
            .eq('id', price.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('company_products')
            .insert({
              company_id: currentCompany.id,
              product_template_id: price.product_template_id,
              base_price: price.base_price,
              margin_percent: price.margin_percent,
              commercial_name: price.commercial_name || template?.name || '',
              is_active: true,
            });
          if (error) throw error;
        }
      }

      // Save item prices
      for (const itemPrice of Object.values(itemPrices)) {
        if (itemPrice.price > 0 || itemPrice.cost > 0) {
          const existingPrice = companyItemPrices?.find(
            (p) => p.item_template_id === itemPrice.item_template_id
          );

          if (existingPrice) {
            const { error } = await supabase
              .from('company_item_prices')
              .update({
                cost: itemPrice.cost,
                price: itemPrice.price,
              })
              .eq('id', existingPrice.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('company_item_prices')
              .insert({
                company_id: currentCompany.id,
                item_template_id: itemPrice.item_template_id,
                cost: itemPrice.cost,
                price: itemPrice.price,
              });
            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      toast.success('Preços salvos com sucesso!');
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar preços: ' + error.message);
    },
  });

  // Get unique linhas
  const linhas = useMemo(() => {
    return [...new Set(productTemplates?.map((p) => p.linha).filter(Boolean) || [])];
  }, [productTemplates]);

  // Get categories for selected linha
  const categories = useMemo(() => {
    const filtered = selectedLinha === 'all' 
      ? productTemplates 
      : productTemplates?.filter((p) => p.linha === selectedLinha);
    return [...new Set(filtered?.map((p) => p.category).filter(Boolean) || [])];
  }, [productTemplates, selectedLinha]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return productTemplates?.filter((product) => {
      const matchesSearch = search === '' || 
        product.name.toLowerCase().includes(search.toLowerCase());
      const matchesLinha = selectedLinha === 'all' || product.linha === selectedLinha;
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesLinha && matchesCategory;
    }) || [];
  }, [productTemplates, search, selectedLinha, selectedCategory]);

  // Group products by linha and category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Record<string, typeof filteredProducts>> = {};
    filteredProducts.forEach((product) => {
      const linha = product.linha || 'Sem Linha';
      const category = product.category || 'other';
      if (!groups[linha]) groups[linha] = {};
      if (!groups[linha][category]) groups[linha][category] = [];
      groups[linha][category].push(product);
    });
    return groups;
  }, [filteredProducts]);

  const handlePriceChange = (templateId: string, field: keyof ProductPrice, value: string | number) => {
    const template = productTemplates?.find(t => t.id === templateId);
    setPrices((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        product_template_id: templateId,
        commercial_name: prev[templateId]?.commercial_name || template?.name || '',
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleItemPriceChange = (itemTemplateId: string, field: keyof ItemPrice, value: number) => {
    setItemPrices((prev) => ({
      ...prev,
      [itemTemplateId]: {
        ...prev[itemTemplateId],
        item_template_id: itemTemplateId,
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const toggleProductExpanded = (productId: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const isLoading = loadingTemplates || loadingProducts;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-primary" />
              Preços dos Produtos
            </h1>
            <p className="text-muted-foreground">
              Defina os preços de cada componente para calcular o custo do produto
            </p>
          </div>
          {hasChanges && (
            <Button 
              onClick={handleSave} 
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border bg-card">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedLinha} onValueChange={(v) => { setSelectedLinha(v); setSelectedCategory('all'); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Linha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Linhas</SelectItem>
              {linhas.map((linha) => (
                <SelectItem key={linha} value={linha!}>
                  {linha}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat!}>
                  {categoryLabels[cat!] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : Object.keys(groupedProducts).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros ou aguarde os produtos serem cadastrados.
            </p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {Object.entries(groupedProducts).map(([linha, categories]) => (
              <AccordionItem key={linha} value={linha} className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 bg-muted/50 hover:bg-muted">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{linha}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {Object.values(categories).flat().length} produtos
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4">
                  {Object.entries(categories).map(([category, products]) => (
                    <div key={category} className="mb-6 last:mb-0">
                      <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        {categoryLabels[category] || category}
                      </h3>
                      <div className="space-y-3">
                        {products.map((product) => {
                          const priceData = prices[product.id];
                          const productComponentItems = itemsByProduct[product.id] || [];
                          const componentsCost = calculateProductCost(product.id);
                          const hasComponents = productComponentItems.length > 0;
                          const isExpanded = expandedProducts.has(product.id);
                          const hasPrice = priceData?.base_price > 0 || componentsCost > 0;
                          
                          return (
                            <div
                              key={product.id}
                              className={`rounded-lg border transition-colors ${
                                hasPrice ? 'bg-primary/5 border-primary/20' : 'bg-card'
                              }`}
                            >
                              {/* Product Header */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {product.image_url ? (
                                    <div className="h-12 w-12 rounded-md border bg-background p-1 flex items-center justify-center shrink-0">
                                      <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <div className="h-12 w-12 rounded-md border bg-background flex items-center justify-center shrink-0">
                                      <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate">{product.name}</p>
                                    {product.description && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {product.description}
                                      </p>
                                    )}
                                    {hasComponents && (
                                      <p className="text-xs text-primary mt-0.5">
                                        {productComponentItems.length} componentes
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                  {/* Calculated cost from components */}
                                  {hasComponents && componentsCost > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
                                      <Calculator className="w-4 h-4 text-muted-foreground" />
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">Custo: </span>
                                        <span className="font-medium text-foreground">
                                          R$ {componentsCost.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="flex-1 sm:w-32">
                                    <label className="text-xs text-muted-foreground mb-1 block">
                                      Margem (%)
                                    </label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      placeholder="0"
                                      value={priceData?.margin_percent || ''}
                                      onChange={(e) =>
                                        handlePriceChange(product.id, 'margin_percent', parseFloat(e.target.value) || 0)
                                      }
                                      className="h-9"
                                    />
                                  </div>

                                  {hasComponents && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleProductExpanded(product.id)}
                                      className="gap-1"
                                    >
                                      <Layers className="w-4 h-4" />
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Components List */}
                              {hasComponents && isExpanded && (
                                <div className="border-t px-4 py-3 bg-muted/30">
                                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                                    <Layers className="w-3 h-3" />
                                    Componentes do Produto
                                  </p>
                                  <div className="space-y-2">
                                    {productComponentItems.map((item) => {
                                      const itemPriceData = itemPrices[item.item_template_id];
                                      const defaultPrice = item.item_template?.default_price || 0;
                                      const currentPrice = itemPriceData?.price || defaultPrice;
                                      
                                      return (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-3 p-2 rounded-md bg-background border"
                                        >
                                          {item.item_template?.image_url ? (
                                            <div className="h-8 w-8 rounded border bg-white p-0.5 flex items-center justify-center shrink-0">
                                              <img
                                                src={item.item_template.image_url}
                                                alt={item.item_template.name}
                                                className="max-h-full max-w-full object-contain"
                                              />
                                            </div>
                                          ) : (
                                            <div className="h-8 w-8 rounded border bg-muted flex items-center justify-center shrink-0">
                                              <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                          )}
                                          
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                              {item.item_template?.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Unidade: {item.item_template?.unit || 'un'}
                                            </p>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <div className="w-24">
                                              <label className="text-xs text-muted-foreground mb-0.5 block">
                                                Custo (R$)
                                              </label>
                                              <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0,00"
                                                value={itemPriceData?.cost || ''}
                                                onChange={(e) =>
                                                  handleItemPriceChange(
                                                    item.item_template_id,
                                                    'cost',
                                                    parseFloat(e.target.value) || 0
                                                  )
                                                }
                                                className="h-8 text-sm"
                                              />
                                            </div>
                                            <div className="w-24">
                                              <label className="text-xs text-muted-foreground mb-0.5 block">
                                                Preço (R$)
                                              </label>
                                              <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder={defaultPrice.toFixed(2)}
                                                value={itemPriceData?.price || ''}
                                                onChange={(e) =>
                                                  handleItemPriceChange(
                                                    item.item_template_id,
                                                    'price',
                                                    parseFloat(e.target.value) || 0
                                                  )
                                                }
                                                className="h-8 text-sm"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </MainLayout>
  );
}
