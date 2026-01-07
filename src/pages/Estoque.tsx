import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Boxes, TrendingDown, TrendingUp, Package, Plus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddStockDialog } from '@/components/estoque/AddStockDialog';

export default function Estoque() {
  const { currentCompany } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch company stock
  const { data: stockData, isLoading: loadingStock } = useQuery({
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

  // Fetch item templates
  const { data: itemTemplates, isLoading: loadingItems } = useQuery({
    queryKey: ['item-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
  });

  // Combine stock with item details
  const stockItems = stockData?.map(stock => {
    const item_template = itemTemplates?.find(t => t.id === stock.item_template_id);
    return { ...stock, item_template };
  });

  const isLoading = loadingStock || loadingItems;

  // Filter low stock items
  const lowStockItems = stockItems?.filter(
    item => item.quantity <= (item.min_quantity || 0) && item.min_quantity > 0
  );

  const itemTypeLabels: Record<string, string> = {
    glass: 'Vidro',
    profile: 'Perfil',
    accessory: 'Acessório',
    service: 'Serviço',
  };

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
            <Button variant="outline" className="gap-2">
              <TrendingDown className="w-4 h-4" />
              Registrar Saída
            </Button>
            <Button variant="outline" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Registrar Entrada
            </Button>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock Alerts */}
          <div className="section-card lg:col-span-1">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-destructive" />
              Estoque Baixo
            </h2>
            {lowStockItems && lowStockItems.length > 0 ? (
              <div className="space-y-2">
                {lowStockItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.item_template?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Mínimo: {item.min_quantity} {item.item_template?.unit}
                      </p>
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

          {/* Stock List */}
          <div className="section-card lg:col-span-2">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4">
              Itens em Estoque
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : stockItems && stockItems.length > 0 ? (
              <div className="space-y-2">
                {stockItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.item_template?.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {itemTypeLabels[item.item_template?.type || ''] || item.item_template?.type}
                        </span>
                      </div>
                      {item.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">
                        {item.quantity} <span className="text-sm text-muted-foreground">{item.item_template?.unit}</span>
                      </p>
                      {item.min_quantity > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Mín: {item.min_quantity}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Boxes className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-foreground mb-1">Nenhum item no estoque</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Adicione itens para controlar seu estoque.
                </p>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Primeiro Item
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddStockDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </MainLayout>
  );
}
