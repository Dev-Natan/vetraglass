import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Boxes, TrendingDown, TrendingUp, ShoppingCart, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddStockDialog } from '@/components/estoque/AddStockDialog';
import { EditItemPriceDialog } from '@/components/estoque/EditItemPriceDialog';
import { RegistrarMovimentoDialog } from '@/components/estoque/RegistrarMovimentoDialog';
import { HistoricoMovimentosTab } from '@/components/estoque/HistoricoMovimentosTab';
import { StockItemCard } from '@/components/estoque/StockItemCard';
import { StockKPIs } from '@/components/estoque/StockKPIs';
import { StockFilters, type StockStatus, type StockSortBy, type ViewMode } from '@/components/estoque/StockFilters';
import { StockGridView } from '@/components/estoque/StockGridView';
import { useStockData, type StockItem } from '@/hooks/useStockData';
import { useItemTypes } from '@/hooks/useItemTypes';

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

export default function Estoque() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  
  // Module tutorial trigger
  useModuleTutorialTrigger('estoque');
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [entradaDialogOpen, setEntradaDialogOpen] = useState(false);
  const [saidaDialogOpen, setSaidaDialogOpen] = useState(false);
  const [mainTab, setMainTab] = useState('estoque');
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    imageUrl?: string | null;
    unit?: string;
  } | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [linhaFilter, setLinhaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StockStatus>('all');
  const [sortBy, setSortBy] = useState<StockSortBy>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isExporting, setIsExporting] = useState(false);

  // Use aggregated stock data hook
  const {
    activeItems,
    inactiveItems,
    lowStockItems,
    itemTemplates,
    isLoading,
    error: loadError,
    kpis,
  } = useStockData({ companyId: currentCompany?.id });

  // Fetch dynamic item types for filters
  const { data: itemTypes } = useItemTypes();

  // Get unique linhas for filter
  const linhas = useMemo(() => {
    const uniqueLinhas = new Set<string>();
    itemTemplates.forEach((t) => {
      if (t.linha) uniqueLinhas.add(t.linha);
    });
    return Array.from(uniqueLinhas).sort();
  }, [itemTemplates]);

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ stockId, isActive }: { stockId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('company_stock')
        .update({ is_active: isActive })
        .eq('id', stockId);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      toast.success(isActive ? 'Item ativado' : 'Item desativado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar item: ' + error.message);
    },
  });

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let items = [...activeItems];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      items = items.filter((item) =>
        item.item_template?.name?.toLowerCase().includes(search)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      items = items.filter((item) => item.item_template?.type === categoryFilter);
    }

    // Linha filter
    if (linhaFilter !== 'all') {
      items = items.filter((item) => item.item_template?.linha === linhaFilter);
    }

    // Status filter
    if (statusFilter === 'low') {
      items = items.filter(
        (item) => item.quantity <= (item.min_quantity || 0) && (item.min_quantity || 0) > 0
      );
    } else if (statusFilter === 'zero') {
      items = items.filter((item) => item.quantity === 0);
    } else if (statusFilter === 'normal') {
      items = items.filter(
        (item) => item.quantity > (item.min_quantity || 0) || (item.min_quantity || 0) === 0
      );
    }

    // Sort
    items.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.item_template?.name || '').localeCompare(b.item_template?.name || '');
      } else if (sortBy === 'quantity') {
        return b.quantity - a.quantity;
      } else if (sortBy === 'value') {
        const aValue = a.quantity * (a.priceInfo?.cost || 0);
        const bValue = b.quantity * (b.priceInfo?.cost || 0);
        return bValue - aValue;
      }
      return 0;
    });

    return items;
  }, [activeItems, searchTerm, categoryFilter, linhaFilter, statusFilter, sortBy]);

  // Inactive items with same filters
  const filteredInactiveItems = useMemo(() => {
    let items = [...inactiveItems];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      items = items.filter((item) =>
        item.item_template?.name?.toLowerCase().includes(search)
      );
    }

    if (categoryFilter !== 'all') {
      items = items.filter((item) => item.item_template?.type === categoryFilter);
    }

    return items;
  }, [inactiveItems, searchTerm, categoryFilter]);

  const handleOpenPriceDialog = useCallback((item: StockItem) => {
    setSelectedItem({
      id: item.item_template_id,
      name: item.item_template?.name ?? 'Item',
      imageUrl: item.item_template?.image_url,
      unit: item.item_template?.unit,
    });
    setPriceDialogOpen(true);
  }, []);

  const handleToggleActive = useCallback((e: React.MouseEvent, stockId: string, currentActive: boolean) => {
    e.stopPropagation();
    toggleActiveMutation.mutate({ stockId, isActive: !currentActive });
  }, [toggleActiveMutation]);

  const handleExport = useCallback(async () => {
    if (filteredItems.length === 0) {
      toast.error('Nenhum item para exportar');
      return;
    }

    setIsExporting(true);
    try {
      await exportStockToExcel(filteredItems, currentCompany?.name);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar relatório');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }, [filteredItems, currentCompany?.name]);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div data-tutorial="estoque-header" className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Boxes className="w-7 h-7 text-primary" />
              Estoque
            </h1>
            <p className="text-muted-foreground">Controle de entradas e saídas</p>
          </div>
          <div data-tutorial="estoque-acoes" className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setSaidaDialogOpen(true)}>
              <TrendingDown className="w-4 h-4" />
              Registrar Saída
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setEntradaDialogOpen(true)}>
              <TrendingUp className="w-4 h-4" />
              Registrar Entrada
            </Button>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <ShoppingCart className="w-4 h-4" />
              Registrar Compra
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <StockKPIs
          totalItems={kpis.totalItems}
          totalValue={kpis.totalValue}
          lowStockCount={kpis.lowStockCount}
          zeroStockCount={kpis.zeroStockCount}
        />

        {/* Main Tabs */}
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

            {/* Filters */}
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

            {/* Stock List/Grid */}
            <div className="section-card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display font-semibold text-lg text-foreground">
                  Itens em Estoque ({filteredItems.length})
                </h2>
              </div>

              <Tabs defaultValue="active" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="active">
                    Ativos ({filteredItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="inactive">
                    Desativados ({filteredInactiveItems.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <StockGridView
                      items={filteredItems}
                      onEdit={handleOpenPriceDialog}
                      onToggleActive={handleToggleActive}
                    />
                  ) : filteredItems.length > 0 ? (
                    <div className="space-y-2">
                      {filteredItems.map((item) => (
                        <StockItemCard
                          key={item.id}
                          item={item}
                          onEdit={handleOpenPriceDialog}
                          onToggleActive={handleToggleActive}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Boxes className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium text-foreground mb-1">Nenhum item encontrado</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
                          ? 'Tente ajustar os filtros.'
                          : 'Adicione itens para controlar seu estoque.'}
                      </p>
                      {!searchTerm && categoryFilter === 'all' && statusFilter === 'all' && (
                        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                          <ShoppingCart className="w-4 h-4" />
                          Registrar Primeira Compra
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="inactive">
                  {viewMode === 'grid' ? (
                    <StockGridView
                      items={filteredInactiveItems}
                      onEdit={handleOpenPriceDialog}
                      onToggleActive={handleToggleActive}
                    />
                  ) : filteredInactiveItems.length > 0 ? (
                    <div className="space-y-2">
                      {filteredInactiveItems.map((item) => (
                        <StockItemCard
                          key={item.id}
                          item={item}
                          onEdit={handleOpenPriceDialog}
                          onToggleActive={handleToggleActive}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Boxes className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium text-foreground mb-1">Nenhum item desativado</h3>
                      <p className="text-sm text-muted-foreground">
                        Itens desativados aparecerão aqui.
                      </p>
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
      <AddStockDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <EditItemPriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        itemTemplateId={selectedItem?.id ?? null}
        itemName={selectedItem?.name ?? ''}
        itemImageUrl={selectedItem?.imageUrl}
        itemUnit={selectedItem?.unit}
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
            id: item.item_template.id,
            name: item.item_template.name,
            unit: item.item_template.unit,
            image_url: item.item_template.image_url || undefined,
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
            id: item.item_template.id,
            name: item.item_template.name,
            unit: item.item_template.unit,
            image_url: item.item_template.image_url || undefined,
          } : undefined,
        }))}
      />
    </MainLayout>
  );
}
