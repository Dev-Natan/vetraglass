import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { estoqueService } from '@/services/estoqueService';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';

import { Boxes, TrendingDown, TrendingUp, History, Plus, PackageSearch, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UnifiedAddItemDialog } from '@/components/estoque/UnifiedAddItemDialog';
import { EditItemPriceDialog } from '@/components/estoque/EditItemPriceDialog';
import { RegistrarMovimentoDialog } from '@/components/estoque/RegistrarMovimentoDialog';
import { HistoricoMovimentosTab } from '@/components/estoque/HistoricoMovimentosTab';
import { ItemHistoricoDialog } from '@/components/estoque/ItemHistoricoDialog';
import { StockKPIs } from '@/components/estoque/StockKPIs';
import { StockFilters, type StockStatus, type StockSortBy } from '@/components/estoque/StockFilters';
import { InventoryStockList } from '@/components/estoque/InventoryStockList';
import { useStockData } from '@/hooks/useStockData';
import type { StockItem } from '@/types/estoque';

import { useItemTypes } from '@/hooks/useItemTypes';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';

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
const CATEGORY_KEY = '__categoria__';

const normalizeStockType = (type: string | null | undefined) => (type || '').trim().toLowerCase();
const isProfileType = (type: string | null | undefined) => ['profile', 'perfil'].includes(normalizeStockType(type));
const isGlassType = (type: string | null | undefined) => ['glass', 'vidro'].includes(normalizeStockType(type));
const canonicalLine = (item: StockItem) => {
  const lineId = item.line_id ?? item.item_template?.line_id;
  return lineId ? (item.line_name ?? item.item_template?.linha ?? item.company_item?.linha ?? '').trim() : '';
};

export default function EstoqueLinha() {
  const { linha: linhaParam = '' } = useParams<{ linha: string }>();
  const decodedLinha = decodeURIComponent(linhaParam);
  const isVidros = decodedLinha === VIDROS_KEY;
  const isDiversos = decodedLinha === DIVERSOS_KEY;
  const isPerfis = decodedLinha === PERFIS_KEY;
  const isCategory = decodedLinha === CATEGORY_KEY;

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
  const pageTitle = isVidros ? 'Vidros' : isDiversos ? 'Acessórios / Diversos' : isPerfis ? 'Perfis' : isCategory ? (searchParams.get('categoria') || lockedTipo || 'Categoria') : decodedLinha;
  const semLinhaOnly = searchParams.get('semlinha') === '1';
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(lockedTipo || 'all');
  const [linhaFilter, setLinhaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StockStatus>('all');
  const [sortBy, setSortBy] = useState<StockSortBy>('name');
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
      linha: canonicalLine(item),
    };
  }, []);

  const linhas = useMemo(() => {
    const scopedType = normalizeStockType(lockedTipo);
    const names = new Set<string>();
    activeItems.forEach((item) => {
      const type = normalizeStockType(item.category_code ?? item.company_item?.type ?? item.item_template?.type);
      const line = canonicalLine(item);
      if (line && (!scopedType || scopedType === 'all' || type === scopedType ||
        (['perfil', 'profile'].includes(scopedType) && isProfileType(type)) ||
        (['vidro', 'glass'].includes(scopedType) && isGlassType(type)))) names.add(line);
    });
    const order = new Map((productLinhas || []).map((line, index) => [line.name.toLowerCase(), index]));
    return Array.from(names).sort((a, b) =>
      (order.get(a.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.toLowerCase()) ?? Number.MAX_SAFE_INTEGER)
      || a.localeCompare(b, 'pt-BR'));
  }, [activeItems, lockedTipo, productLinhas]);

  // Get unique categories from active items
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    activeItems.forEach(item => {
      const type = item.category_code ?? item.company_item?.type ?? item.item_template?.type;
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

  const filteredItems = useMemo(() => {
    // Lock scope to current line (from URL)
    let items = activeItems.filter((item) => {
      const linha = canonicalLine(item);
      const type = item.category_code ?? item.company_item?.type ?? item.item_template?.type;
      if (isCategory) return normalizeStockType(type) === normalizeStockType(lockedTipo);
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
        return [name, item.company_item?.code, item.variant_name, item.color_code, item.line_name, item.category_name]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search));
      });
    }
    if (linhaFilter !== 'all') {
      items = items.filter((item) => canonicalLine(item) === linhaFilter);
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
    if (statusFilter === 'low') items = items.filter((item) => item.quantity > 0 && item.quantity <= (item.min_quantity || 0) && (item.min_quantity || 0) > 0);
    else if (statusFilter === 'zero') items = items.filter((item) => item.quantity === 0);
    else if (statusFilter === 'in-stock') items = items.filter((item) => item.quantity > 0);
    else if (statusFilter === 'negative') items = items.filter((item) => item.quantity < 0);

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

    return items;
  }, [activeItems, searchTerm, categoryFilter, linhaFilter, statusFilter, sortBy, isVidros, isDiversos, isPerfis, isCategory, lockedTipo, decodedLinha, semLinhaOnly]);

  const outOfStockItems = useMemo(() => filteredItems.filter((item) => item.quantity === 0), [filteredItems]);
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
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao estoque
            </Link>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Boxes className="w-7 h-7 text-primary" />
              Estoque · {pageTitle}
              {!isVidros && !isDiversos && !isPerfis && (lockedTipo === 'perfil' ? ' · Perfis' : lockedTipo === 'diversos' ? ' · Acessórios/Diversos' : lockedTipo === 'vidro' ? ' · Vidros' : '')}
            </h1>
            <p className="text-sm text-muted-foreground">
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
            <Button className="gap-2" onClick={() => { setMovementItemId(null); setEntradaDialogOpen(true); }}>
              <TrendingUp className="w-4 h-4" />
              Registrar Entrada
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { setMovementItemId(null); setSaidaDialogOpen(true); }}>
              <TrendingDown className="w-4 h-4" />
              Registrar Saída
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setMainTab('historico')}>
              <History className="w-4 h-4" /> Histórico
            </Button>
            <Button variant="ghost" className="gap-2" onClick={() => setAddDialogOpen(true)}>
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
                onExport={handleExport}
                isExporting={isExporting}
                linhas={linhas}
                linhaFilter={linhaFilter}
                onLinhaChange={setLinhaFilter}
                itemTypes={itemTypes?.filter((type) => activeCategories.includes(normalizeStockType(type.slug))).map(t => ({ slug: t.slug, name: t.name })) || []}
              />
            </div>

            <div className="section-card">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : filteredItems.length > 0 ? (
                <InventoryStockList
                  items={filteredItems}
                  onEdit={handleOpenPriceDialog}
                  onToggleActive={handleToggleActive}
                  onViewHistory={setHistoryItem}
                  onRegisterMovement={handleRegisterMovement}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <PackageSearch className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="font-medium text-foreground">Nenhum item encontrado</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchTerm || categoryFilter !== 'all' || linhaFilter !== 'all' || statusFilter !== 'all'
                      ? 'Ajuste os filtros para ampliar a busca.'
                      : 'Adicione um item ou registre uma entrada para iniciar o controle.'}
                  </p>
                  {!searchTerm && categoryFilter === 'all' && statusFilter === 'all' && (
                    <Button onClick={() => setAddDialogOpen(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" /> Adicionar Item
                    </Button>
                  )}
                </div>
              )}
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
