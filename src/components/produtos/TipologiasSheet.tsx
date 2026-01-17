import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  ShoppingCart,
  Search,
  Package,
  Check,
  FileDown,
  Loader2,
  X,
  Filter,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ActivateProductDialog } from './ActivateProductDialog';

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

export function TipologiasSheet({ open, onOpenChange, linha }: TipologiasSheetProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForDownload, setSelectedForDownload] = useState<Set<string>>(new Set());
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedProductForActivation, setSelectedProductForActivation] = useState<{
    id: string;
    name: string;
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

  const toggleDownloadSelection = (productId: string) => {
    setSelectedForDownload((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAllForDownload = () => {
    setSelectedForDownload(new Set(filteredProducts.map((p) => p.id)));
  };

  const clearDownloadSelection = () => {
    setSelectedForDownload(new Set());
  };

  // Batch activation mutation
  const batchActivateMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      const results = [];
      for (const productId of productIds) {
        // Skip already activated products
        if (isProductActivated(productId)) continue;

        // Activate the product template for the company
        const { data, error } = await supabase.rpc(
          'activate_product_template_for_company',
          {
            _company_id: currentCompany.id,
            _product_template_id: productId,
          }
        );

        if (error) {
          console.error(`Error activating product ${productId}:`, error);
          continue;
        }

        results.push(data);
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['linha-products'] });
      queryClient.invalidateQueries({ queryKey: ['allLinhas'] });
      
      const count = results.length;
      if (count > 0) {
        toast.success(`${count} produto(s) ativado(s) com sucesso!`);
        clearDownloadSelection();
      } else {
        toast.info('Nenhum produto novo foi ativado');
      }
    },
    onError: (error) => {
      console.error('Batch activation error:', error);
      toast.error('Erro ao ativar produtos', {
        description: error.message,
      });
    },
  });

  const handleDownload = () => {
    if (selectedForDownload.size === 0) {
      toast.error('Selecione pelo menos um produto');
      return;
    }
    
    const productIds = Array.from(selectedForDownload);
    const notActivatedIds = productIds.filter(id => !isProductActivated(id));
    
    if (notActivatedIds.length === 0) {
      toast.info('Todos os produtos selecionados já estão ativados');
      return;
    }
    
    batchActivateMutation.mutate(notActivatedIds);
  };

  const handleActivateClick = (product: ProductTemplate) => {
    setSelectedProductForActivation({ id: product.id, name: product.name });
    setActivateDialogOpen(true);
  };

  const getProductImage = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `/products/${imageUrl}`;
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
                  Baixe os desenhos técnicos ou ative produtos para venda
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

            {/* Selection Controls */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {selectedForDownload.size} selecionado(s) para download
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllForDownload}>
                  Selecionar Todos
                </Button>
                <Button variant="outline" size="sm" onClick={clearDownloadSelection}>
                  Limpar
                </Button>
              </div>
            </div>
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
                        const isSelectedForDownload = selectedForDownload.has(product.id);
                        const imageUrl = getProductImage(product.image_url);

                        return (
                          <div
                            key={product.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                              isSelectedForDownload
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            {/* Download Checkbox */}
                            <Checkbox
                              checked={isSelectedForDownload}
                              onCheckedChange={() => toggleDownloadSelection(product.id)}
                              className="shrink-0"
                            />

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
                                {isActivated ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-green-100 text-green-700"
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Ativo para venda
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    Não ativado
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
          <div className="p-4 sm:p-6 border-t bg-card flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {activatedCount} de {products?.length || 0} produtos ativos para venda
            </div>
            <Button
              onClick={handleDownload}
              disabled={selectedForDownload.size === 0 || batchActivateMutation.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {batchActivateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ativando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Ativar ({selectedForDownload.size})
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Activate Dialog */}
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
    </>
  );
}
