import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Boxes, TrendingDown, TrendingUp, Package, Plus, MapPin, DollarSign, Power, Scissors, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddStockDialog } from '@/components/estoque/AddStockDialog';
import { EditItemPriceDialog } from '@/components/estoque/EditItemPriceDialog';
import { RegistrarMovimentoDialog } from '@/components/estoque/RegistrarMovimentoDialog';
import { HistoricoMovimentosTab } from '@/components/estoque/HistoricoMovimentosTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Estoque() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch company stock
  const {
    data: stockData,
    isLoading: loadingStock,
    error: stockError,
  } = useQuery({
    queryKey: ['company-stock', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('company_stock')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch item templates (optimized select)
  const {
    data: itemTemplates,
    isLoading: loadingItems,
    error: itemsError,
  } = useQuery({
    queryKey: ['item-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, name, type, unit, image_url, linha')
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
  });

  // Fetch company item prices
  const { data: itemPrices } = useQuery({
    queryKey: ['company-item-prices', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('company_item_prices')
        .select('*')
        .eq('company_id', currentCompany.id);

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

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
    onError: (error: any) => {
      toast.error('Erro ao atualizar item: ' + error.message);
    },
  });

  // Combine stock with item details and prices
  const stockItems = useMemo(() => {
    if (!stockData || !itemTemplates) return [];
    return stockData.map((stock) => {
      const item_template = itemTemplates.find((t) => t.id === stock.item_template_id);
      const priceInfo = itemPrices?.find((p) => p.item_template_id === stock.item_template_id);
      return { ...stock, item_template, priceInfo };
    });
  }, [stockData, itemTemplates, itemPrices]);

  // Filter by category
  const filteredStockItems = useMemo(() => {
    if (categoryFilter === 'all') return stockItems;
    return stockItems.filter((item) => item.item_template?.type === categoryFilter);
  }, [stockItems, categoryFilter]);

  // Split active/inactive
  const activeItems = useMemo(() => filteredStockItems.filter((i) => i.is_active !== false), [filteredStockItems]);
  const inactiveItems = useMemo(() => filteredStockItems.filter((i) => i.is_active === false), [filteredStockItems]);

  const handleOpenPriceDialog = (item: typeof stockItems[0]) => {
    setSelectedItem({
      id: item.item_template_id,
      name: item.item_template?.name ?? 'Item',
      imageUrl: item.item_template?.image_url,
      unit: item.item_template?.unit,
    });
    setPriceDialogOpen(true);
  };

  const handleToggleActive = (e: React.MouseEvent, stockId: string, currentActive: boolean) => {
    e.stopPropagation();
    toggleActiveMutation.mutate({ stockId, isActive: !currentActive });
  };

  const isLoading = loadingStock || loadingItems;
  const loadError = stockError || itemsError;

  // Filter low stock items (only active)
  const lowStockItems = activeItems?.filter(
    (item) => item.quantity <= (item.min_quantity || 0) && item.min_quantity > 0
  );

  const itemTypeLabels: Record<string, string> = {
    glass: 'Vidro',
    profile: 'Perfil',
    accessory: 'Acessório',
    service: 'Serviço',
  };

  const renderStockItem = (item: typeof stockItems[0], showActivateBtn = true) => (
    <div
      key={item.id}
      className={`flex items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${
        item.is_active === false ? 'opacity-60' : ''
      }`}
      onClick={() => handleOpenPriceDialog(item)}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {item.item_template?.image_url ? (
          <div className="h-12 w-12 rounded-md border bg-white p-1 flex items-center justify-center shrink-0">
            <img
              src={item.item_template.image_url}
              alt={item.item_template?.name ?? 'Item'}
              loading="lazy"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="h-12 w-12 rounded-md border bg-background flex items-center justify-center shrink-0">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium truncate">{item.item_template?.name ?? `Item (${item.item_template_id})`}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
              {itemTypeLabels[item.item_template?.type || ''] || item.item_template?.type}
            </span>
            {(item as any).allow_fractional && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0 flex items-center gap-1" title="Venda fracionada habilitada">
                <Scissors className="w-3 h-3" />
                Fracionado
              </span>
            )}
          </div>
          {item.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {item.location}
            </p>
          )}
          {item.priceInfo && (item.priceInfo.cost > 0 || item.priceInfo.price > 0) ? (
            <div className="flex items-center gap-3 mt-1 text-xs">
              {item.priceInfo.cost > 0 && (
                <span className="text-muted-foreground">
                  Custo: R$ {Number(item.priceInfo.cost).toFixed(2)}
                </span>
              )}
              {item.priceInfo.price > 0 && (
                <span className="text-green-600 font-medium">
                  Venda: R$ {Number(item.priceInfo.price).toFixed(2)}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-1">
              <DollarSign className="w-3 h-3" />
              Clique para definir preços
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-semibold text-lg">
            {item.quantity}{' '}
            <span className="text-sm text-muted-foreground">{item.item_template?.unit}</span>
          </p>
          {item.min_quantity > 0 && (
            <p className="text-xs text-muted-foreground">Mín: {item.min_quantity}</p>
          )}
        </div>

        {showActivateBtn && (
          <Button
            variant={item.is_active !== false ? 'outline' : 'default'}
            size="icon"
            className="shrink-0"
            onClick={(e) => handleToggleActive(e, item.id, item.is_active !== false)}
            title={item.is_active !== false ? 'Desativar item' : 'Ativar item'}
          >
            <Power className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Boxes className="w-7 h-7 text-primary" />
              Estoque
            </h1>
            <p className="text-muted-foreground">Controle de entradas e saídas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setSaidaDialogOpen(true)}>
              <TrendingDown className="w-4 h-4" />
              Registrar Saída
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setEntradaDialogOpen(true)}>
              <TrendingUp className="w-4 h-4" />
              Registrar Entrada
            </Button>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Button>
          </div>
        </div>

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
          
          <TabsContent value="estoque" className="mt-4">

        {!currentCompany && (
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Selecione uma empresa para ver o estoque.
          </div>
        )}

        {loadError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            Erro ao carregar estoque: {(loadError as any)?.message ?? String(loadError)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock Alerts */}
          <div className="section-card lg:col-span-1">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-destructive" />
              Estoque Baixo
            </h2>
            {lowStockItems && lowStockItems.length > 0 ? (
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <div className="flex items-center gap-3">
                      {item.item_template?.image_url ? (
                        <div className="h-10 w-10 rounded-md border bg-background p-1 flex items-center justify-center">
                          <img
                            src={item.item_template.image_url}
                            alt={item.item_template?.name ?? 'Item'}
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-md border bg-background flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      <div>
                        <p className="font-medium text-sm">
                          {item.item_template?.name ?? `Item (${item.item_template_id})`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Mínimo: {item.min_quantity} {item.item_template?.unit}
                        </p>
                      </div>
                    </div>

                    <span className="text-destructive font-semibold">
                      {item.quantity} {item.item_template?.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum alerta de estoque</p>
              </div>
            )}
          </div>

          {/* Stock List with Tabs */}
          <div className="section-card lg:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h2 className="font-display font-semibold text-lg text-foreground">Itens em Estoque</h2>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  <SelectItem value="profile">Perfis</SelectItem>
                  <SelectItem value="glass">Vidros</SelectItem>
                  <SelectItem value="accessory">Acessórios</SelectItem>
                  <SelectItem value="service">Serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="active" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="active">
                  Ativos ({activeItems.length})
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  Desativados ({inactiveItems.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : activeItems.length > 0 ? (
                  <div className="space-y-2">{activeItems.map((item) => renderStockItem(item))}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Boxes className="w-12 h-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium text-foreground mb-1">Nenhum item ativo</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Adicione itens para controlar seu estoque.
                    </p>
                    <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Adicionar Primeiro Item
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inactive">
                {inactiveItems.length > 0 ? (
                  <div className="space-y-2">{inactiveItems.map((item) => renderStockItem(item))}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium text-foreground mb-1">Nenhum item desativado</h3>
                    <p className="text-sm text-muted-foreground">
                      Itens desativados aparecerão aqui.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
          </TabsContent>
          
          <TabsContent value="historico" className="mt-4">
            <HistoricoMovimentosTab itemTemplates={itemTemplates || []} />
          </TabsContent>
        </Tabs>
      </div>

      <AddStockDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
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
        stockItems={stockItems}
      />
      <RegistrarMovimentoDialog
        open={saidaDialogOpen}
        onOpenChange={setSaidaDialogOpen}
        tipo="saida"
        stockItems={stockItems}
      />
    </MainLayout>
  );
}
