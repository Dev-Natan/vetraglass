import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { estoqueService } from '@/services/estoqueService';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';

import { Boxes, TrendingDown, TrendingUp, History, Plus, PackageCheck, PackageX, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UnifiedAddItemDialog } from '@/components/estoque/UnifiedAddItemDialog';
import { EditItemPriceDialog } from '@/components/estoque/EditItemPriceDialog';
import { RegistrarMovimentoDialog } from '@/components/estoque/RegistrarMovimentoDialog';
import { HistoricoMovimentosTab } from '@/components/estoque/HistoricoMovimentosTab';
import { ItemHistoricoDialog } from '@/components/estoque/ItemHistoricoDialog';
import { StockItemCard } from '@/components/estoque/StockItemCard';
import { StockKPIs } from '@/components/estoque/StockKPIs';
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
const PERFIS_KEY = '__perfis__';

const normalizeStockType = (type: string | null | undefined) => (type || '').trim().toLowerCase();
const isProfileType = (type: string | null | undefined) => ['profile', 'perfil'].includes(normalizeStockType(type));
const isGlassType = (type: string | null | undefined) => ['glass', 'vidro'].includes(normalizeStockType(type));

export default function EstoqueLinha() {
  const { linha: linhaParam = '' } = useParams<{ linha: string }>();
  const decodedLinha = decodeURIComponent(linhaParam);
  const isVidros = decodedLinha === VIDROS_KEY;
  const isDiversos = decodedLinha === DIVERSOS_KEY;
  const isPerfis = decodedLinha === PERFIS_KEY;
  const pageTitle = isVidros ? 'Vidros' : isDiversos ? 'Acessórios / Diversos' : isPerfis ? 'Perfis' : decodedLinha;

  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();

  
  useModuleTutorialTrigger('estoque');
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [entradaDialogOpen, setEntradaDialogOpen] = useState(false);
  const [saidaDialogOpen, setSaidaDialogOpen] = useState(false);
  const [movementItemId, setMovementItemId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState('estoque');
  const [selectedItem, setSelectedItem] = useState<{
    id: string | null;
    name: string;
    imageUrl?: string | null;
    unit?: string;
    companyItemId?: string | null;
    isCustomItem?: boolean;
    stockId?: string;
    initialProfile?: {
      type?: string | null;
      line?: string | null;
      cost?: number | null;
      salePrice?: number | null;
      barLengthMm?: number | null;
      weightPerMeter?: number | null;
      weightKg?: number | null;
    };
  } | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);

  // Filter states
  const [searchParams] = useSearchParams();
  const lockedTipo = searchParams.get('tipo'); // when present, category is locked to this type
  const semLinhaOnly = searchParams.get('semlinha') === '1';
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(lockedTipo || 'all');
  const [linhaFilter, setLinhaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StockStatus>('all');
  const [sortBy, setSortBy] = useState<StockSortBy>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isExporting, setIsExporting] = useState(false);

  const {
    activeItems,
    itemTemplates,
    isLoading,
    error: loadError,
  } = useStockData({ companyId: currentCompany?.id });

  const { data: itemTypes } = useItemTypes();
  const { data: productLinhas } = useCompanyLinhas();

  // Helper to get item name, type, linha from either source
  const getItemData = useCallback((item: StockItem) => {
    return {
      name: item.company_item?.name ?? item.item_template?.name ?? 'Item',
      type: item.category_code ?? item.company_item?.type ?? item.item_template?.type ?? '',
      linha: item.line_name ?? item.company_item?.linha ?? item.item_template?.linha ?? '',
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
      if (type) cats.add(normalizeStockType(type));
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

  const { inStockItems, outOfStockItems } = useMemo(() => {
    // Lock scope to current line (from URL)
    let items = activeItems.filter((item) => {
      const linha = item.line_name ?? item.company_item?.linha ?? item.item_template?.linha;
      const type = item.category_code ?? item.company_item?.type ?? item.item_template?.type;
      if (isVidros) {
        if (!isGlassType(type)) return false;
        if (semLinhaOnly) return !linha;
        return true;
      }
      if (isPerfis) return isProfileType(type);
      if (isDiversos) return !linha && !isGlassType(type);
      return (linha || '') === decodedLinha;
    });
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      items = items.filter((item) => {
        const name = item.company_item?.name ?? item.item_template?.name ?? '';
        return [name, item.variant_name, item.line_name, item.category_name]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search));
      });
    }
    if (categoryFilter === 'diversos') {
      items = items.filter((item) => {
        const type = item.company_item?.type ?? item.item_template?.type;
        return !isProfileType(type) && !isGlassType(type);
      });
    } else if (categoryFilter === 'vidro' || categoryFilter === 'glass') {
      items = items.filter((item) => {
        const type = item.company_item?.type ?? item.item_template?.type;
        return isGlassType(type);
      });
    } else if (categoryFilter === 'perfil' || categoryFilter === 'profile') {
      items = items.filter((item) => {
        const type = item.company_item?.type ?? item.item_template?.type;
        return isProfileType(type);
      });
    } else if (categoryFilter !== 'all') {
      items = items.filter((item) => {
        const type = item.company_item?.type ?? item.item_template?.type;
        return normalizeStockType(type) === normalizeStockType(categoryFilter);
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
      if (sortBy === 'value') return Number(b.inventory_value || 0) - Number(a.inventory_value || 0);
      return 0;
    });

    return {
      inStockItems: items.filter(item => item.quantity > 0),
      outOfStockItems: items.filter(item => item.quantity === 0),
    };
  }, [activeItems, searchTerm, categoryFilter, statusFilter, sortBy, isVidros, isDiversos, isPerfis, decodedLinha, semLinhaOnly]);


  const filteredItems = useMemo(() => [...inStockItems, ...outOfStockItems], [inStockItems, outOfStockItems]);
  const pageKpis = useMemo(() => ({
    totalItems: filteredItems.length,
    totalValue: filteredItems.reduce((total, item) => total + Number(item.inventory_value || 0), 0),
    unknownValuationCount: filteredItems.filter(item => item.quantity > 0 && item.average_unit_cost == null).length,
    lowStockCount: filteredItems.filter(item => item.quantity <= (item.min_quantity || 0) && (item.min_quantity || 0) > 0).length,
    zeroStockCount: outOfStockItems.length,
  }), [filteredItems, outOfStockItems.length]);

  const handleOpenPriceDialog = useCallback((item: StockItem) => {
    const isCustom = item.company_item?.is_custom ?? false;
    setSelectedItem({
      id: item.item_template_id,
      name: item.company_item?.name ?? item.item_template?.name ?? 'Item',
      imageUrl: item.company_item?.image_url ?? item.item_template?.image_url,
      unit: item.item_template?.unit ?? item.company_item?.unit,
      companyItemId: item.company_item_id,
      isCustomItem: isCustom,
      stockId: undefined,
      initialProfile: {
        type: item.company_item?.type ?? item.item_template?.type,
        line: item.company_item?.linha ?? item.line_name ?? item.item_template?.linha,
        cost: item.priceInfo?.cost ?? item.company_item?.cost,
        salePrice: item.priceInfo?.price ?? item.company_item?.sale_price,
        barLengthMm: item.company_item?.bar_length_mm ?? item.nominal_length_mm ?? item.item_template?.bar_length_mm,
        weightPerMeter: item.company_item?.weight_per_meter ?? item.weight_per_meter_kg ?? item.item_template?.weight_per_meter,
        weightKg: item.company_item?.weight_kg ?? item.weight_per_bar_kg ?? item.item_template?.weight_per_bar,
      },
    });
    setPriceDialogOpen(true);
  }, []);

  const handleRegisterMovement = useCallback((item: StockItem, type: 'entrada' | 'saida') => {
    setMovementItemId(item.id);
    if (type === 'entrada') setEntradaDialogOpen(true);
    else setSaidaDialogOpen(true);
  }, []);

  const handleEntradaOpenChange = useCallback((open: boolean) => {
    setEntradaDialogOpen(open);
    if (!open) setMovementItemId(null);
  }, []);

  const handleSaidaOpenChange = useCallback((open: boolean) => {
    setSaidaDialogOpen(open);
    if (!open) setMovementItemId(null);
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
              {!isVidros && !isDiversos && !isPerfis && (lockedTipo === 'perfil' ? ' · Perfis' : lockedTipo === 'diversos' ? ' · Acessórios/Diversos' : lockedTipo === 'vidro' ? ' · Vidros' : '')}
            </h1>
            <p className="text-muted-foreground">
              {isPerfis
                ? 'Todos os perfis da empresa, independentemente da linha.'
                : lockedTipo === 'perfil'
                ? `Somente perfis da linha ${pageTitle}`
                : lockedTipo === 'diversos'
                ? `Somente acessórios/diversos da linha ${pageTitle}`
                : lockedTipo === 'vidro'
                ? `Somente vidros da linha ${pageTitle}`
                : 'Controle de entradas e saídas desta linha'}
            </p>
          </div>

          <div data-tutorial="estoque-acoes" className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { setMovementItemId(null); setSaidaDialogOpen(true); }}>
              <TrendingDown className="w-4 h-4" />
              <span className="hidden sm:inline">Registrar Saída</span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { setMovementItemId(null); setEntradaDialogOpen(true); }}>
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
          totalItems={pageKpis.totalItems}
          totalValue={pageKpis.totalValue}
          unknownValuationCount={pageKpis.unknownValuationCount}
          lowStockCount={pageKpis.lowStockCount}
          zeroStockCount={pageKpis.zeroStockCount}
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
            {itemTypes && itemTypes.length > 0 && !lockedTipo && (
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
                    <StockGridView items={inStockItems} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} onRegisterMovement={handleRegisterMovement} />
                  ) : inStockItems.length > 0 ? (
                    <div className="space-y-2">
                      {inStockItems.map((item) => (
                        <StockItemCard key={item.id} item={item} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} onViewHistory={setHistoryItem} onRegisterMovement={handleRegisterMovement} />
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
                    <StockGridView items={outOfStockItems} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} onRegisterMovement={handleRegisterMovement} />
                  ) : outOfStockItems.length > 0 ? (
                    <div className="space-y-2">
                      {outOfStockItems.map((item) => (
                        <StockItemCard key={item.id} item={item} onEdit={handleOpenPriceDialog} onToggleActive={handleToggleActive} onViewHistory={setHistoryItem} onRegisterMovement={handleRegisterMovement} />
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
        initialProfile={selectedItem?.initialProfile}
      />

      <RegistrarMovimentoDialog
        open={entradaDialogOpen}
        onOpenChange={handleEntradaOpenChange}
        tipo="entrada"
        stockItems={activeItems}
        initialStockItemId={movementItemId}
        lockInitialItem={!!movementItemId}
      />

      <RegistrarMovimentoDialog
        open={saidaDialogOpen}
        onOpenChange={handleSaidaOpenChange}
        tipo="saida"
        stockItems={activeItems}
        initialStockItemId={movementItemId}
        lockInitialItem={!!movementItemId}
      />
      <ItemHistoricoDialog
        open={!!historyItem}
        onOpenChange={(o) => !o && setHistoryItem(null)}
        itemTemplateId={historyItem?.item_template_id ?? null}
        itemName={historyItem?.item_template?.name ?? historyItem?.company_item?.name ?? 'Item'}
        itemUnit={historyItem?.item_template?.unit ?? historyItem?.company_item?.unit ?? 'un'}
        itemImageUrl={historyItem?.item_template?.image_url ?? historyItem?.company_item?.image_url ?? null}
      />
    </MainLayout>
  );
}
