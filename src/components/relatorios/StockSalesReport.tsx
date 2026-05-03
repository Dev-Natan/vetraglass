import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, PackageX, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { useProductLowStockStatus } from '@/hooks/useProductLowStockStatus';

interface Sale {
  id: string;
  items?: any;
  payment_status: string;
  created_at: string;
}

interface StockSalesReportProps {
  companyId: string | undefined;
  sales: Sale[];
  isLoading?: boolean;
}

interface LowItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  level: 'zero' | 'low';
  shortfall: number;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatNumber = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toFixed(2);

export function StockSalesReport({ companyId, sales, isLoading }: StockSalesReportProps) {
  // 1) Low/zero stock items
  const { data: stockRows, isLoading: stockLoading } = useQuery({
    queryKey: ['report-low-stock', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_stock')
        .select(`
          id, quantity, min_quantity, is_active, item_template_id, company_item_id,
          item_template:item_templates(id, name, type, unit),
          company_item:company_items(id, name, type, unit)
        `)
        .eq('company_id', companyId)
        .neq('is_active', false);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });

  const lowItems: LowItem[] = useMemo(() => {
    if (!stockRows) return [];
    return stockRows
      .map((r) => {
        const info = r.item_template || r.company_item;
        if (!info) return null;
        const qty = Number(r.quantity || 0);
        const min = Number(r.min_quantity || 0);
        const isZero = qty <= 0;
        const isLow = !isZero && min > 0 && qty <= min;
        if (!isZero && !isLow) return null;
        return {
          id: r.id,
          name: info.name,
          type: info.type,
          unit: info.unit,
          quantity: qty,
          min_quantity: min,
          level: (isZero ? 'zero' : 'low') as 'zero' | 'low',
          shortfall: Math.max(0, min - qty),
        } satisfies LowItem;
      })
      .filter(Boolean) as LowItem[];
  }, [stockRows]);

  const sortedLow = useMemo(() => {
    return [...lowItems].sort((a, b) => {
      if (a.level !== b.level) return a.level === 'zero' ? -1 : 1;
      return b.shortfall - a.shortfall;
    });
  }, [lowItems]);

  const zeroCount = lowItems.filter((i) => i.level === 'zero').length;
  const lowCount = lowItems.filter((i) => i.level === 'low').length;

  // 2) Products with composition issues
  const { templateProductStatus, companyProductStatus, isLoading: prodStatusLoading } =
    useProductLowStockStatus(companyId);

  const { data: productsAffected, isLoading: prodLoading } = useQuery({
    queryKey: ['report-affected-products', companyId, templateProductStatus.size, companyProductStatus.size],
    queryFn: async () => {
      if (!companyId) return [];
      const companyIds = Array.from(companyProductStatus.keys());
      const templateIds = Array.from(templateProductStatus.keys());
      if (companyIds.length === 0 && templateIds.length === 0) return [];

      const { data, error } = await supabase
        .from('company_products')
        .select('id, commercial_name, product_template_id, image_url, is_active, product_template:product_templates(name, image_url)')
        .eq('company_id', companyId)
        .eq('is_active', true);
      if (error) throw error;

      return (data || [])
        .map((cp: any) => {
          const status =
            companyProductStatus.get(cp.id) ||
            (cp.product_template_id ? templateProductStatus.get(cp.product_template_id) : undefined);
          if (!status) return null;
          return {
            id: cp.id,
            name: cp.commercial_name || cp.product_template?.name || 'Produto',
            image_url: cp.image_url || cp.product_template?.image_url || null,
            level: status as 'zero' | 'low',
          };
        })
        .filter(Boolean) as Array<{ id: string; name: string; image_url: string | null; level: 'zero' | 'low' }>;
    },
    enabled: !!companyId && !prodStatusLoading,
    staleTime: 0,
    gcTime: 0,
  });

  const sortedAffectedProducts = useMemo(() => {
    return [...(productsAffected || [])].sort((a, b) => {
      if (a.level !== b.level) return a.level === 'zero' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [productsAffected]);

  // 3) Best & worst selling products from sales items
  const productSales = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();
    (sales || []).forEach((sale) => {
      if (sale.payment_status === 'cancelled') return;
      const items = sale.items as any[];
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
        const name = (item.name || item.description || 'Produto').toString();
        const qty = Number(item.quantity || 1);
        const unit = Number(item.unit_price ?? item.price ?? 0);
        const total = qty * unit;
        const cur = map.get(name);
        if (cur) {
          cur.quantity += qty;
          cur.revenue += total;
        } else {
          map.set(name, { name, quantity: qty, revenue: total });
        }
      });
    });
    return Array.from(map.values());
  }, [sales]);

  const topSellers = useMemo(
    () => [...productSales].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    [productSales],
  );
  const bottomSellers = useMemo(
    () => [...productSales].sort((a, b) => a.quantity - b.quantity).slice(0, 10),
    [productSales],
  );

  const stockBusy = stockLoading || prodStatusLoading || prodLoading;

  return (
    <div className="space-y-4">
      {/* Criticality KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <PackageX className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{zeroCount}</p>
              <p className="text-xs text-muted-foreground">Itens zerados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{lowCount}</p>
              <p className="text-xs text-muted-foreground">Itens abaixo do mínimo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{sortedAffectedProducts.length}</p>
              <p className="text-xs text-muted-foreground">Produtos com risco de venda</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low/zero stock list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Itens críticos no estoque
          </CardTitle>
          <CardDescription>
            Materiais zerados ou abaixo do mínimo configurado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockBusy ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedLow.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum item abaixo do mínimo. 🎉
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2">Item</th>
                    <th className="py-2 pr-2">Tipo</th>
                    <th className="py-2 pr-2 text-right">Qtd</th>
                    <th className="py-2 pr-2 text-right">Mínimo</th>
                    <th className="py-2 pr-2 text-right">Faltam</th>
                    <th className="py-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLow.map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{it.name}</td>
                      <td className="py-2 pr-2 text-muted-foreground capitalize">{it.type}</td>
                      <td className="py-2 pr-2 text-right">
                        {formatNumber(it.quantity)} {it.unit}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {formatNumber(it.min_quantity)} {it.unit}
                      </td>
                      <td className="py-2 pr-2 text-right font-medium">
                        {it.shortfall > 0 ? `${formatNumber(it.shortfall)} ${it.unit}` : '-'}
                      </td>
                      <td className="py-2 pr-2">
                        {it.level === 'zero' ? (
                          <Badge variant="destructive" className="gap-1">
                            <PackageX className="w-3 h-3" /> Zerado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> Baixo
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affected products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" />
            Produtos com risco de venda
          </CardTitle>
          <CardDescription>
            Produtos cuja composição depende de itens em falta no estoque
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockBusy ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedAffectedProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum produto com risco identificado.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sortedAffectedProducts.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
                    p.level === 'zero'
                      ? 'border-destructive/40 bg-destructive/5'
                      : 'border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10'
                  }`}
                >
                  <span className="font-medium text-sm truncate">{p.name}</span>
                  {p.level === 'zero' ? (
                    <Badge variant="destructive" className="shrink-0">Material zerado</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-700 dark:text-amber-400">
                      Estoque baixo
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best/Worst sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Mais vendidos no período
            </CardTitle>
            <CardDescription>Top 10 por quantidade</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : topSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma venda no período.
              </p>
            ) : (
              <ol className="space-y-2">
                {topSellers.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="font-semibold">{formatNumber(p.quantity)}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {formatCurrency(p.revenue)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-500" />
              Menos vendidos no período
            </CardTitle>
            <CardDescription>Top 10 com menor saída</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : bottomSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma venda no período.
              </p>
            ) : (
              <ol className="space-y-2">
                {bottomSellers.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 text-xs flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="font-semibold">{formatNumber(p.quantity)}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {formatCurrency(p.revenue)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
