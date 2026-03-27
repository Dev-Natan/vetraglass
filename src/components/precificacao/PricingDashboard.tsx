import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, AlertTriangle, BarChart3, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface PricingDashboardProps {
  products: Array<{
    id: string;
    commercial_name: string;
    linha: string | null;
    category: string | null;
    cost_per_sqm: number | null;
    price_per_sqm: number | null;
    margin_percent: number | null;
    is_active: boolean;
    company_product_items?: any[];
  }>;
}

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

export function PricingDashboard({ products }: PricingDashboardProps) {
  const metrics = useMemo(() => {
    const total = products.length;
    const withPricing = products.filter(p => p.cost_per_sqm && p.cost_per_sqm > 0);
    const pricedCount = withPricing.length;
    const unpricedCount = total - pricedCount;

    const avgMargin = withPricing.length > 0
      ? withPricing.reduce((s, p) => s + (p.margin_percent || 0), 0) / withPricing.length
      : 0;

    const avgCost = withPricing.length > 0
      ? withPricing.reduce((s, p) => s + (p.cost_per_sqm || 0), 0) / withPricing.length
      : 0;

    const avgPrice = withPricing.length > 0
      ? withPricing.reduce((s, p) => s + (p.price_per_sqm || 0), 0) / withPricing.length
      : 0;

    const lowMargin = withPricing.filter(p => (p.margin_percent || 0) < 15);
    const negativeMargin = withPricing.filter(p => (p.margin_percent || 0) < 0);

    // By linha
    const byLinha: Record<string, { count: number; avgMargin: number; avgCost: number; avgPrice: number }> = {};
    withPricing.forEach(p => {
      const key = p.linha || 'Sem linha';
      if (!byLinha[key]) byLinha[key] = { count: 0, avgMargin: 0, avgCost: 0, avgPrice: 0 };
      byLinha[key].count++;
      byLinha[key].avgMargin += p.margin_percent || 0;
      byLinha[key].avgCost += p.cost_per_sqm || 0;
      byLinha[key].avgPrice += p.price_per_sqm || 0;
    });
    Object.values(byLinha).forEach(v => {
      v.avgMargin /= v.count;
      v.avgCost /= v.count;
      v.avgPrice /= v.count;
    });

    // By category
    const byCategory: Record<string, { count: number; avgMargin: number }> = {};
    withPricing.forEach(p => {
      const key = p.category || 'other';
      if (!byCategory[key]) byCategory[key] = { count: 0, avgMargin: 0 };
      byCategory[key].count++;
      byCategory[key].avgMargin += p.margin_percent || 0;
    });
    Object.values(byCategory).forEach(v => { v.avgMargin /= v.count; });

    return { total, pricedCount, unpricedCount, avgMargin, avgCost, avgPrice, lowMargin, negativeMargin, byLinha, byCategory };
  }, [products]);

  if (products.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide font-medium">Produtos</span>
            </div>
            <p className="text-xl font-bold">{metrics.pricedCount}<span className="text-sm font-normal text-muted-foreground">/{metrics.total}</span></p>
            <p className="text-[10px] text-muted-foreground">precificados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide font-medium">Custo Médio/m²</span>
            </div>
            <p className="text-xl font-bold">{metrics.avgCost > 0 ? formatCurrency(metrics.avgCost) : '—'}</p>
            <p className="text-[10px] text-muted-foreground">média geral</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-primary mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide font-medium">Margem Média</span>
            </div>
            <p className={cn("text-xl font-bold", metrics.avgMargin >= 20 ? "text-emerald-600" : metrics.avgMargin >= 0 ? "text-amber-600" : "text-destructive")}>
              {metrics.avgMargin.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">lucro sobre custo</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide font-medium">Alertas</span>
            </div>
            <p className="text-xl font-bold">
              {metrics.negativeMargin.length > 0 ? (
                <span className="text-destructive">{metrics.negativeMargin.length}</span>
              ) : metrics.lowMargin.length > 0 ? (
                <span className="text-amber-600">{metrics.lowMargin.length}</span>
              ) : (
                <span className="text-emerald-600">0</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {metrics.negativeMargin.length > 0 ? 'margem negativa' : metrics.lowMargin.length > 0 ? 'margem baixa (<15%)' : 'tudo ok'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by Linha */}
      {Object.keys(metrics.byLinha).length > 1 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Margem por Linha</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.byLinha)
                .sort((a, b) => b[1].avgMargin - a[1].avgMargin)
                .map(([linha, data]) => (
                  <div key={linha} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card">
                    <span className="text-xs font-medium">{linha}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px]",
                        data.avgMargin < 0 && "bg-destructive/10 text-destructive",
                        data.avgMargin >= 0 && data.avgMargin < 15 && "bg-amber-500/10 text-amber-600",
                        data.avgMargin >= 15 && "bg-emerald-500/10 text-emerald-600",
                      )}
                    >
                      {data.avgMargin.toFixed(1)}%
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{data.count} prod.</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {metrics.negativeMargin.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs font-semibold text-destructive">Produtos com Margem Negativa</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {metrics.negativeMargin.map(p => (
                <Badge key={p.id} variant="destructive" className="text-[10px]">
                  {p.commercial_name} ({(p.margin_percent || 0).toFixed(1)}%)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {metrics.lowMargin.length > 0 && metrics.negativeMargin.length === 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600">Produtos com Margem Baixa (&lt;15%)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {metrics.lowMargin.slice(0, 10).map(p => (
                <Badge key={p.id} variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                  {p.commercial_name} ({(p.margin_percent || 0).toFixed(1)}%)
                </Badge>
              ))}
              {metrics.lowMargin.length > 10 && (
                <Badge variant="outline" className="text-[10px]">+{metrics.lowMargin.length - 10} mais</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {metrics.unpricedCount > 0 && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-blue-600">
                <strong>{metrics.unpricedCount}</strong> produto(s) ainda não precificado(s). Expanda o card e configure os custos.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
