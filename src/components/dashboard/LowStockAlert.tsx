import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, ShoppingCart, Truck, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LowStockRow {
  id: string;
  quantity: number;
  min_quantity: number | null;
  supplier_name: string | null;
  item_template: { name: string | null; unit: string | null; type: string | null } | null;
  company_item: { name: string | null; unit: string | null; type: string | null } | null;
}

export function LowStockAlert() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['dashboard-low-stock', companyId],
    queryFn: async (): Promise<LowStockRow[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_stock')
        .select(`
          id, quantity, min_quantity, supplier_name,
          item_template:item_templates(name, unit, type),
          company_item:company_items(name, unit, type)
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .gt('min_quantity', 0);
      if (error) throw error;
      const rows = (data as LowStockRow[]) || [];
      return rows.filter(
        (r) => Number(r.quantity ?? 0) <= Number(r.min_quantity ?? 0),
      );
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const setSupplier = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string | null }) => {
      const { error } = await supabase
        .from('company_stock')
        .update({ supplier_name: name })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-low-stock'] });
      qc.invalidateQueries({ queryKey: ['company-stock'] });
      toast.success('Fornecedor atualizado');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar fornecedor'),
  });

  if (isLoading || items.length === 0) return null;

  const zeroCount = items.filter((i) => Number(i.quantity ?? 0) <= 0).length;
  const lowCount = items.length - zeroCount;

  function handleEditSupplier(item: LowStockRow) {
    const next = window.prompt('Fornecedor principal deste item:', item.supplier_name || '');
    if (next === null) return;
    setSupplier.mutate({ id: item.id, name: next.trim() || null });
  }

  return (
    <Card className="border-destructive/60 bg-destructive/5 animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive text-base">
          <AlertTriangle className="w-5 h-5" />
          Alerta de Reposição de Estoque
          <Badge variant="destructive" className="ml-1">{items.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {zeroCount > 0 && <span><strong className="text-destructive">{zeroCount}</strong> item(ns) sem estoque</span>}
          {zeroCount > 0 && lowCount > 0 && ' · '}
          {lowCount > 0 && <span><strong>{lowCount}</strong> item(ns) abaixo do mínimo</span>}
          {' · '}Hora de comprar mais!
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.slice(0, 8).map((item) => {
            const name = item.item_template?.name ?? item.company_item?.name ?? 'Item';
            const unit = item.item_template?.unit ?? item.company_item?.unit ?? '';
            const isZero = Number(item.quantity ?? 0) <= 0;
            const supplier = item.supplier_name?.trim();
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/60 border border-destructive/20 flex-wrap"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Package className="w-4 h-4 text-destructive shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{name}</p>
                    <button
                      type="button"
                      onClick={() => handleEditSupplier(item)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
                      title="Definir fornecedor principal"
                    >
                      <Truck className="w-3 h-3" />
                      {supplier ? supplier : 'Definir fornecedor'}
                      <Pencil className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    Mín: {item.min_quantity} {unit}
                  </span>
                  <Badge variant={isZero ? 'destructive' : 'outline'} className={isZero ? '' : 'border-destructive text-destructive'}>
                    {Number(item.quantity ?? 0)} {unit}
                  </Badge>
                  <Link to={`/pedidos-compra?new=1&supplier=${encodeURIComponent(supplier || '')}&item=${encodeURIComponent(name)}`}>
                    <Button size="sm" variant="outline" className="h-7 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10">
                      <ShoppingCart className="w-3 h-3" />
                      Gerar pedido
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
          {items.length > 8 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              + {items.length - 8} outros itens
            </p>
          )}
        </div>
        <div className="flex justify-end mt-3">
          <Link to="/estoque">
            <Button size="sm" variant="destructive" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Ver estoque completo
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
