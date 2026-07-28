import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { estoqueService } from '@/services/estoqueService';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';

import { Boxes, TrendingDown, TrendingUp, History, Plus, PackageCheck, PackageX, Trash2, RefreshCw, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { recalculateProductPrice } from '@/utils/productPriceUpdater';
import { UnifiedAddItemDialog } from '@/components/estoque/UnifiedAddItemDialog';
import { EditItemPriceDialog } from '@/components/estoque/EditItemPriceDialog';
import { RegistrarMovimentoDialog } from '@/components/estoque/RegistrarMovimentoDialog';
import { HistoricoMovimentosTab } from '@/components/estoque/HistoricoMovimentosTab';
import { StockItemCard } from '@/components/estoque/StockItemCard';
import { StockKPIs } from '@/components/estoque/StockKPIs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { StockFilters, type StockStatus, type StockSortBy, type ViewMode } from '@/components/estoque/StockFilters';
import { StockGridView } from '@/components/estoque/StockGridView';
import { useStockData } from '@/hooks/useStockData';
import type { StockItem } from '@/types/estoque';

import { useItemTypes } from '@/hooks/useItemTypes';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { cn } from '@/lib/utils';

interface RegistrarMovimentoStockItem {
  id: string;
  item_template_id: string;
  quantity: number;
  item_template?: {
    id: string;
    name: string;
    unit?: string;
    image_url?: string;
  };
}
import { exportStockToExcel } from '@/utils/exportStockToExcel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

const VIDROS_KEY = '__vidros__';
const DIVERSOS_KEY = '__diversos__';

export default function EstoqueLinha() {
  const { linha: linhaParam = '' } = useParams<{ linha: string }>();
  const decodedLinha = decodeURIComponent(linhaParam);
  const isVidros = decodedLinha === VIDROS_KEY;
  const isDiversos = decodedLinha === DIVERSOS_KEY;
  const pageTitle = isVidros ? 'Vidros' : isDiversos ? 'Acessórios / Diversos' : decodedLinha;

  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();

  
  useModuleTutorialTrigger('estoque');
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [entradaDialogOpen, setEntradaDialogOpen] = useState(false);
  const [saidaDialogOpen, setSaidaDialogOpen] = useState(false);
  const [mainTab, setMainTab] = useState('estoque');
  const [selectedItem, setSelectedItem] = useState<{
    id: string | null;
    name: string;
    imageUrl?: string | null;
    unit?: string;
    companyItemId?: string | null;
    isCustomItem?: boolean;
    stockId?: string;
  } | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [linhaFilter, setLinhaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StockStatus>('all');
  const [sortBy, setSortBy] = useState<StockSortBy>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isExporting, setIsExporting] = useState(false);

  const {
    activeItems,
    inactiveItems,
    lowStockItems,
    itemTemplates,
    isLoading,
    error: loadError,
    kpis,
  } = useStockData({ companyId: currentCompany?.id });

  const { data: itemTypes } = useItemTypes();
  const { data: productLinhas } = useCompanyLinhas();

  // Helper to get item name, type, linha from either source
  const getItemData = useCallback((item: StockItem) => {
    return {
      name: item.company_item?.name ?? item.item_template?.name ?? 'Item',
      type: item.company_item?.type ?? item.item_template?.type ?? '',
      linha: item.company_item?.linha ?? item.item_template?.linha ?? '',
    };
  }, []);

  // Conjunto (case-insensitive) de linhas ATIVAS no dicionário do Admin SaaS
  const activeLinhaKeys = useMemo(() => {
    const set = new Set<string>();
    (productLinhas || []).forEach(l => {
      if (l.slug) set.add(l.slug.toLowerCase());
      if (l.name) set.add(l.name.toLowerCase());
    });
    return set;
  }, [productLinhas]);
  const isLinhaAllowed = useCallback((linha: string | null | undefined) => {
    if (!linha) return true; // itens sem linha continuam visíveis
    return activeLinhaKeys.has(String(linha).toLowerCase());
  }, [activeLinhaKeys]);

  const linhas = useMemo(() => {
    // Somente linhas ativas do dicionário (ordenadas por sort_order)
    return (productLinhas || []).map(l => l.name);
  }, [productLinhas]);

  // Get unique categories from active items
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    activeItems.forEach(item => {
      const type = item.company_item?.type ?? item.item_template?.type;
      if (type) cats.add(type);
    });
    return Array.from(cats);
  }, [activeItems]);

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ stockId, isActive }: { stockId: string; isActive: boolean }) => {
      return estoqueService.toggleActive(stockId, isActive);
    },

    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      toast.success(isActive ? 'Item ativado' : 'Item desativado');
    },
    onError: (error: Error) => { toast.error('Erro ao atualizar item: ' + error.message); },
  });

  const resetStockMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) return;
      
      // Zero out stock quantities
      const { error: stockError } = await supabase
        .from('company_stock')
        .update({ quantity: 0 })
        .eq('company_id', currentCompany.id);
        
      if (stockError) throw stockError;
      
      // Zero out costs in company_items
      const { error: itemsError } = await supabase
        .from('company_items')
        .update({ 
          cost: 0, 
          cost_per_bar: 0, 
          cost_per_kg: 0, 
          cost_per_meter: 0 
        })
        .eq('company_id', currentCompany.id);
        
      if (itemsError) throw itemsError;

      // Zero out costs in company_item_prices
      const { error: pricesError } = await supabase
        .from('company_item_prices')
        .update({ cost: 0 })
        .eq('company_id', currentCompany.id);
        
      if (pricesError) throw pricesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      queryClient.invalidateQueries({ queryKey: ['company-items'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      toast.success('Estoque zerado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao zerar estoque: ' + error.message);
    }
  });

  const [isRecalculating, setIsRecalculating] = useState(false);
  const handleRecalculateAllPrices = async () => {
    if (!currentCompany?.id) return;
    setIsRecalculating(true);
    try {
      // Get all company products
      const { data: products, error } = await supabase
        .from('company_products')
        .select('id')
        .eq('company_id', currentCompany.id);

      if (error) throw error;
      if (!products || products.length === 0) {
        toast.info('Nenhum produto encontrado para atualizar.');
        return;
      }

      toast.info(`Iniciando atualização de ${products.length} produtos...`);
      
      // Use chunks to avoid overwhelming the browser/API
      const CHUNK_SIZE = 5;
      for (let i = 0; i < products.length; i += CHUNK_SIZE) {
        const chunk = products.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(p => recalculateProductPrice(p.id)));
      }

      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Todos os preços de produtos foram atualizados com base nos custos atuais do estoque!');
    } catch (error: any) {
      toast.error('Erro ao recalcular preços: ' + error.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const { inStockItems, outOfStockItems } = useMemo(() => {
    // Lock scope to current line (from URL)
    let items = activeItems.filter((item) => {
      const linha = item.company_item?.linha ?? item.item_template?.linha;
      const type = item.company_item?.type ?? item.item_template?.type;
      if (isVidros) return type === 'glass';
      if (isDiversos) return !linha && type !== 'glass';
      return (linha || '') === decodedLinha;
    });
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      items = items.filter((item) => {
        const name = item.company_item?.name ?? item.item_template?.name ?? '';
        return name.toLowerCase().includes(search);
      });
    }
    if (categoryFilter !== 'all') {
      items = items.filter((item) => {
        const type = item.company_item?.type ?? item.item_template?.type;
        return type === categoryFilter;
      });
    }
    if (statusFilter === 'low') items = items.filter((item) => item.quantity <= (item.min_quantity || 0) && (item.min_quantity || 0) > 0);
    else if (statusFilter === 'zero') items = items.filter((item) => item.quantity === 0);
    else if (statusFilter === 'normal') items = items.filter((item) => item.quantity > (item.min_quantity || 0) || (item.min_quantity || 0) === 0);

    items.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.company_item?.name ?? a.item_template?.name ?? '';
        const nameB = b.company_item?.name ?? b.item_template?.name ?? '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'quantity') return b.quantity - a.quantity;
      if (sortBy === 'value') return (b.quantity * (b.company_item?.cost || b.priceInfo?.cost || 0)) - (a.quantity * (a.company_item?.cost || a.priceInfo?.cost || 0));
      return 0;
    });

    return {
      inStockItems: items.filter(item => item.quantity > 0),
      outOfStockItems: items.filter(item => item.quantity === 0),
    };
  }, [activeItems, searchTerm, categoryFilter, statusFilter, sortBy, isVidros, isDiversos, decodedLinha]);


  const filteredItems = useMemo(() => [...inStockItems, ...outOfStockItems], [inStockItems, outOfStockItems]);

  const handleOpenPriceDialog = useCallback((item: StockItem) => {
    const isCustom = item.company_item?.is_custom ?? false;
    const isVirtual = item.id.startsWith('virtual-');
    
    setSelectedItem({
      id: item.item_template_id,
      name: item.company_item?.name ?? item.item_template?.name ?? 'Item',
      imageUrl: item.company_item?.image_url ?? item.item_template?.image_url,
      unit: item.item_template?.unit ?? item.company_item?.unit,
      companyItemId: item.company_item_id,
      isCustomItem: isCustom,
      stockId: isVirtual ? undefined : item.id,
    });
    setPriceDialogOpen(true);
  }, []);

  const handleToggleActive = useCallback((e: React.MouseEvent, stockId: string, currentActive: boolean) => {
    e.stopPropagation();
    toggleActiveMutation.mutate({ stockId, isActive: !currentActive });
  }, [toggleActiveMutation]);

  const handleExport = useCallback(async () => {
    if (filteredItems.length === 0) { toast.error('Nenhum item para exportar'); return; }
    setIsExporting(true);
    try {
      await exportStockToExcel(filteredItems, currentCompany?.name);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar relatório');
      console.error(error);
    } finally { setIsExporting(false); }
  }, [filteredItems, currentCompany?.name]);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div data-tutorial="estoque-header" className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Linhas
            </Link>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Boxes className="w-7 h-7 text-primary" />
              Estoque · {pageTitle}
            </h1>
            <p className="text-muted-foreground">Controle de entradas e saídas desta linha</p>
          </div>

          <div data-tutorial="estoque-acoes" className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Zerar Estoque</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Zerar Estoque?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá definir a quantidade e os custos de TODOS os itens do seu estoque para zero. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resetStockMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Confirmar e Zerar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={handleRecalculateAllPrices}
              disabled={isRecalculating}
            >
              <RefreshCw className={cn("w-4 h-4", isRecalculating && "animate-spin")} />
              <span className="hidden sm:inline">Atualizar Preços Produtos</span>
            </Button>
            
            <Button variant="outline" className="gap-2" onClick={() => setSaidaDialogOpen(true)}>
              <TrendingDown className="w-4 h-4" />
              <span className="hidden sm:inline">Registrar Saída</span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setEntradaDialogOpen(true)}>
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Registrar Entrada</span>
            </Button>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Button>
          </div>
        </div>

        <StockKPIs
          totalItems={kpis.totalItems}
          totalValue={kpis.totalValue}
          lowStockCount={kpis.lowStockCount}
          zeroStockCount={kpis.zeroStockCount}
        />

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="estoque" className="gap-2">
              <Boxes className="w-4 h-4" />
              Estoque Atual
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="estoque" className="mt-4 space-y-4">
            {!currentCompany && (
              <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
                Selecione uma empresa para ver o estoque.
              </div>
            )}
            {loadError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                Erro ao carregar estoque: {loadError?.message ?? String(loadError)}
              </div>
            )}



            {/* Category Selection Chips */}
            {itemTypes && itemTypes.length > 0 && (
              <div className="section-card">
                <p className="text-xs font-medium text-muted-foreground mb-2">Filtrar por Categoria</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      categoryFilter === 'all'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    Todas
                  </button>
                  {itemTypes.filter(t => activeCategories.includes(t.slug)).map((type) => {
                    const count = activeItems.filter(i => (i.company_item?.type ?? i.item_template?.type) === type.slug).length;
                    return (
                      <button
                        key={type.slug}
                        onClick={() => setCategoryFilter(type.slug)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                          categoryFilter === type.slug
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {type.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="section-card">
              <StockFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                sortBy={sortBy}
                onSortChange={setSortBy}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onExport={handleExport}
                isExporting={isExporting}
                linhas={linhas}
                linhaFilter={linhaFilter}
                onLinhaChange={setLinhaFilter}
                itemTypes={itemTypes?.map(t => ({ slug: t.slug, name: t.name })) || []}
              />
            </div>

            <div className="section-card">
              <Tabs defaultValue="in-stock" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="in-stock" className="gap-2">
                    <PackageCheck className="w-4 h-4" />
                    Em Estoque ({inStockItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="out-of-stock" className="gap-2">
                    <PackageX className="w-4 h-4" />
                    Fora de Estoque ({outOfStockItems.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="in-stock">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <StockGridView items={inStockItems} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} />
                  ) : inStockItems.length > 0 ? (
                    <div className="space-y-2">
                      {inStockItems.map((item) => (
                        <StockItemCard key={item.id} item={item} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <PackageCheck className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium text-foreground mb-1">Nenhum item em estoque</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {searchTerm || categoryFilter !== 'all' || linhaFilter !== 'all' || statusFilter !== 'all' ? 'Tente ajustar os filtros.' : 'Adicione itens para controlar seu estoque.'}
                      </p>
                      {!searchTerm && categoryFilter === 'all' && statusFilter === 'all' && (
                        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Adicionar Primeiro Item
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="out-of-stock">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <StockGridView items={outOfStockItems} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} />
                  ) : outOfStockItems.length > 0 ? (
                    <div className="space-y-2">
                      {outOfStockItems.map((item) => (
                        <StockItemCard key={item.id} item={item} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <PackageX className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium text-foreground mb-1">Nenhum item fora de estoque</h3>
                      <p className="text-sm text-muted-foreground">Todos os itens possuem quantidade disponível.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
          
          <TabsContent value="historico" className="mt-4">
            <HistoricoMovimentosTab itemTemplates={itemTemplates || []} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <UnifiedAddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <EditItemPriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        itemTemplateId={selectedItem?.id ?? null}
        companyItemId={selectedItem?.companyItemId}
        itemName={selectedItem?.name ?? ''}
        itemImageUrl={selectedItem?.imageUrl}
        itemUnit={selectedItem?.unit}
        stockId={selectedItem?.stockId}
        isCustomItem={selectedItem?.isCustomItem}
      />

      <RegistrarMovimentoDialog
        open={entradaDialogOpen}
        onOpenChange={setEntradaDialogOpen}
        tipo="entrada"
        stockItems={activeItems.map(item => ({
          id: item.id,
          item_template_id: item.item_template_id,
          quantity: item.quantity,
          item_template: item.item_template ? {
            id: item.item_template.id, name: item.item_template.name,
            unit: item.item_template.unit, image_url: item.item_template.image_url || undefined,
            type: item.item_template.type, linha: item.item_template.linha,
          } : undefined,
        }))}
      />

      <RegistrarMovimentoDialog
        open={saidaDialogOpen}
        onOpenChange={setSaidaDialogOpen}
        tipo="saida"
        stockItems={activeItems.map(item => ({
          id: item.id,
          item_template_id: item.item_template_id,
          quantity: item.quantity,
          item_template: item.item_template ? {
            id: item.item_template.id, name: item.item_template.name,
            unit: item.item_template.unit, image_url: item.item_template.image_url || undefined,
            type: item.item_template.type, linha: item.item_template.linha,
          } : undefined,
        }))}
      />
    </MainLayout>
  );
}
