import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers, Package, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

interface LinhaInfo {
  linha: string;
  productCount: number;
  categories: string[];
  avgPrice: number;
}

export function PrecificacaoLinhas() {
  const { currentCompany } = useAuth();

  const { data: products, isLoading } = useQuery({
    queryKey: ['precificacao-linhas-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, commercial_name, linha, category, base_price, price_per_sqm, is_active')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const linhasData = useMemo((): LinhaInfo[] => {
    if (!products) return [];
    const map = new Map<string, { count: number; cats: Set<string>; prices: number[] }>();

    products.forEach(p => {
      const linha = p.linha || 'Sem Linha';
      if (!map.has(linha)) {
        map.set(linha, { count: 0, cats: new Set(), prices: [] });
      }
      const entry = map.get(linha)!;
      entry.count++;
      if (p.category) entry.cats.add(p.category);
      const price = p.price_per_sqm || p.base_price || 0;
      if (price > 0) entry.prices.push(price);
    });

    return Array.from(map.entries())
      .map(([linha, info]) => ({
        linha,
        productCount: info.count,
        categories: Array.from(info.cats),
        avgPrice: info.prices.length > 0 
          ? info.prices.reduce((a, b) => a + b, 0) / info.prices.length 
          : 0,
      }))
      .sort((a, b) => a.linha.localeCompare(b.linha));
  }, [products]);

  const totalProducts = products?.length || 0;
  const totalLinhas = linhasData.length;

  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total de Linhas</span>
            </div>
            <p className="text-2xl font-bold">{totalLinhas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total de Produtos</span>
            </div>
            <p className="text-2xl font-bold">{totalProducts}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Categorias Ativas</span>
            </div>
            <p className="text-2xl font-bold">
              {new Set(products?.map(p => p.category).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Linhas List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : linhasData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              Nenhuma linha de produto cadastrada ainda.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Use a aba "Criar Produto" para adicionar novos produtos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {linhasData.map(linha => (
            <Card key={linha.linha} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{linha.linha}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {linha.productCount} produto{linha.productCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {linha.categories.map(cat => (
                        <Badge key={cat} variant="outline" className="text-[10px]">
                          {categoryLabels[cat] || cat}
                        </Badge>
                      ))}
                    </div>
                    {linha.avgPrice > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Preço médio: {formatCurrency(linha.avgPrice)}/m²
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
