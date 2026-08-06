import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Package, Search } from 'lucide-react';
import { ProductPriceLinesManager } from './ProductPriceLinesManager';
import { usePriceLineCounts } from '@/hooks/useProductPriceLines';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface CompanyProductRow {
  id: string;
  name: string;
  linha: string | null;
  category: string | null;
}

export interface ProductPriceLinesTabProps {
  companyId: string;
}

/** Aba "Produtos" de Meus Preços: lista produtos e suas linhas de preço (variações). */
export function ProductPriceLinesTab({ companyId }: ProductPriceLinesTabProps) {
  const [search, setSearch] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['company-products-price-lines', companyId],
    queryFn: async () => {
      const { data, error } = await sb
        .from('company_products')
        .select('id, name, linha, category')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as CompanyProductRow[];
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  const { data: counts = {} } = usePriceLineCounts(companyId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      [p.name, p.linha, p.category].filter(Boolean).some(v => String(v).toLowerCase().includes(q)),
    );
  }, [products, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar produto, linha ou categoria..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible>
              {filtered.map(p => (
                <AccordionItem key={p.id} value={p.id} className="px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Package className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[p.linha, p.category].filter(Boolean).join(' · ') || 'Sem linha'}
                        </div>
                      </div>
                      <Badge variant={counts[p.id] ? 'default' : 'outline'} className="ml-2">
                        {counts[p.id] ?? 0} {counts[p.id] === 1 ? 'variação' : 'variações'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ProductPriceLinesManager companyId={companyId} companyProductId={p.id} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
