import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  ShoppingCart,
  Search,
  Package,
  Check,
  FileDown,
  Loader2,
  X,
} from 'lucide-react';
import { ActivateWithCompositionDialog } from './ActivateWithCompositionDialog';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';

interface TipologiasSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linha: string;
}

interface ProductTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  linha: string | null;
  image_url: string | null;
  is_active: boolean;
}

export function TipologiasSheet({ open, onOpenChange, linha }: TipologiasSheetProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const { labels: categoryLabels } = useProductCategoryLabels();
  const [searchTerm, setSearchTerm] = useState('');
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedProductForActivation, setSelectedProductForActivation] = useState<{
    id: string;
    name: string;
    image_url: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'todos' | 'ativos'>('todos');

  // Fetch products for this linha
  const { data: products, isLoading } = useQuery({
    queryKey: ['linha-products-all', linha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('linha', linha)
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (error) throw error;
      return data as ProductTemplate[];
    },
    enabled: open && !!linha,
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
    enabled: !!currentCompany?.id && open,
  });

  // Check if product is activated
  const isProductActivated = (productTemplateId: string) => {
    return companyProducts.some(
      (cp) => cp.product_template_id === productTemplateId && cp.is_active
    );
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products || [];

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    if (activeTab === 'ativos') {
      filtered = filtered.filter((p) => isProductActivated(p.id));
    }

    return filtered;
  }, [products, searchTerm, activeTab, companyProducts]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductTemplate[]> = {};
    filteredProducts.forEach((product) => {
      const category = product.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });
    return groups;
  }, [filteredProducts]);

  const handleActivateClick = (product: ProductTemplate) => {
    setSelectedProductForActivation({ 
      id: product.id, 
      name: product.name, 
      image_url: product.image_url 
    });
    setActivateDialogOpen(true);
  };

  const getProductImage = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    if (imageUrl.startsWith('/')) return imageUrl;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-templates/${imageUrl}`;
  };

  const activatedCount = filteredProducts.filter((p) => isProductActivated(p.id)).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="p-4 sm:p-6 border-b bg-card">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <FileDown className="w-5 h-5 text-primary" />
                  Tipologias - {linha}
                </SheetTitle>
                <SheetDescription className="mt-1">
                  Visualize e ative produtos para venda
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'todos' | 'ativos')}
              className="mt-4"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="todos">
                  Todos ({products?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="ativos">
                  Ativos para Venda ({activatedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </SheetHeader>

          {/* Products List */}
          <ScrollArea className="flex-1">
            <div className="p-4 sm:p-6 space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mb-3 opacity-50" />
                  <p className="font-medium">Nenhum produto encontrado</p>
                  <p className="text-sm mt-1">Tente ajustar os filtros</p>
                </div>
              ) : (
                Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      {categoryLabels[category] || category}
                      <Badge variant="secondary" className="text-xs">
                        {categoryProducts.length}
                      </Badge>
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {categoryProducts.map((product) => {
                        const isActivated = isProductActivated(product.id);
                        const imageUrl = getProductImage(product.image_url);

                        return (
                          <div
                            key={product.id}
                            className="flex items-center gap-3 p-3 rounded-lg border-2 border-border hover:border-muted-foreground/50 transition-all"
                          >
                            {/* Image */}
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : (
                                <Package className="w-6 h-6 text-muted-foreground/50" />
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {isActivated && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-green-100 text-green-700"
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Ativo
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {!isActivated && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 h-8 px-3"
                                  onClick={() => handleActivateClick(product)}
                                >
                                  <ShoppingCart className="w-4 h-4 mr-1" />
                                  Ativar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t bg-card">
            <div className="text-sm text-muted-foreground text-center">
              {activatedCount} de {products?.length || 0} produtos ativos para venda
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Activate Dialog with Composition */}
      {selectedProductForActivation && (
        <ActivateWithCompositionDialog
          open={activateDialogOpen}
          onOpenChange={setActivateDialogOpen}
          productTemplateId={selectedProductForActivation.id}
          productName={selectedProductForActivation.name}
          productImageUrl={selectedProductForActivation.image_url}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['company-products'] });
            queryClient.invalidateQueries({ queryKey: ['linha-products'] });
            queryClient.invalidateQueries({ queryKey: ['company-items'] });
            queryClient.invalidateQueries({ queryKey: ['company-stock'] });
          }}
        />
      )}
    </>
  );
}
