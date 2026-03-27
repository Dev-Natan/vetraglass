import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Search, Package, Layers, AlertCircle, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProductPricingCard } from '@/components/precificacao/ProductPricingCard';
import { PricingDashboard } from '@/components/precificacao/PricingDashboard';
import { BulkPriceAdjustDialog } from '@/components/precificacao/BulkPriceAdjustDialog';

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

export default function Precificacao() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const [search, setSearch] = useState('');
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch company products with composition
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['precificacao-products', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select(`
          id, commercial_name, linha, category, image_url,
          cost_per_sqm, price_per_sqm, margin_percent, is_active,
          company_product_items (
            id, quantity_formula, width_formula, height_formula,
            pieces_quantity, cut_angle, sort_order,
            company_item:company_items (
              id, name, type, unit, bar_length_mm, weight_kg, weight_per_meter,
              cost, cost_per_kg, cost_per_meter,
              sale_price, sale_price_per_kg, sale_price_per_meter,
              image_url
            ),
            item_template:item_templates (
              id, name, type, unit, default_price, image_url
            )
          )
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('linha')
        .order('commercial_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Extract linhas and categories
  const { linhas, categories } = useMemo(() => {
    const linhaSet = new Set<string>();
    const catSet = new Set<string>();
    products?.forEach(p => {
      if (p.linha) linhaSet.add(p.linha);
      if (p.category) catSet.add(p.category);
    });
    return {
      linhas: Array.from(linhaSet).sort(),
      categories: Array.from(catSet).sort(),
    };
  }, [products]);

  // Filter
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      if (selectedLinha && p.linha !== selectedLinha) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.commercial_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedLinha, selectedCategory, search]);

  // Map composition items
  const getCompositionItems = (product: any) => {
    return (product.company_product_items || []).map((cpi: any) => {
      const ci = cpi.company_item;
      const ti = cpi.item_template;
      const source = ci || ti;
      return {
        id: cpi.id,
        itemName: source?.name || 'Item desconhecido',
        itemType: source?.type || 'accessory',
        unit: source?.unit || 'un',
        imageUrl: ci?.image_url || ti?.image_url || null,
        quantityFormula: cpi.quantity_formula || '1',
        widthFormula: cpi.width_formula,
        heightFormula: cpi.height_formula,
        piecesQuantity: cpi.pieces_quantity || 1,
        cutAngle: cpi.cut_angle,
        barLengthMm: ci?.bar_length_mm || 6000,
        weightKg: ci?.weight_kg || 0,
        weightPerMeter: ci?.weight_per_meter || 0,
        costPerBar: ci?.cost || 0,
        costPerKg: ci?.cost_per_kg || 0,
        costPerMeter: ci?.cost_per_meter || 0,
        salePricePerBar: ci?.sale_price || 0,
        salePricePerKg: ci?.sale_price_per_kg || 0,
        salePricePerMeter: ci?.sale_price_per_meter || 0,
        companyItemId: ci?.id || null,
        templateItemId: ti?.id || null,
      };
    });
  };

  const totalProducts = products?.length || 0;
  const productsWithPrices = products?.filter(p => p.cost_per_sqm && p.cost_per_sqm > 0).length || 0;

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Precificação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure os preços dos seus produtos com base nos componentes da composição
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="text-xs">
              {productsWithPrices}/{totalProducts} precificados
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Linha chips */}
            {linhas.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Linha</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedLinha(null)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      !selectedLinha
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    Todas
                  </button>
                  {linhas.map(l => {
                    const count = products?.filter(p => p.linha === l).length || 0;
                    return (
                      <button
                        key={l}
                        onClick={() => setSelectedLinha(selectedLinha === l ? null : l)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedLinha === l
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        {l} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category chips */}
            {categories.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Categoria</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      !selectedCategory
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    Todas
                  </button>
                  {categories.map(c => {
                    const count = products?.filter(p => p.category === c).length || 0;
                    return (
                      <button
                        key={c}
                        onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedCategory === c
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        {categoryLabels[c] || c} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products list */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {totalProducts === 0
                  ? 'Nenhum produto ativo encontrado. Ative produtos na página de Produtos.'
                  : 'Nenhum produto encontrado com os filtros selecionados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map(product => (
              <ProductPricingCard
                key={product.id}
                product={product}
                compositionItems={getCompositionItems(product)}
                onSaved={() => refetch()}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
