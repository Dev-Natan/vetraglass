import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Retorna o saldo em estoque agrupado por item_template_id para a empresa ativa.
 * Faz a ponte entre o cadastro central (item_templates), preços (company_item_*_prices)
 * e o estoque (company_stock) — todos ligados pelo mesmo item_template_id.
 */
export function useStockByTemplate() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['stock-by-template', companyId],
    queryFn: async () => {
      const map = new Map<string, { quantity: number; unit: string | null }>();
      if (!companyId) return map;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from('company_stock')
        .select('quantity, item_template_id, company_item:company_items(unit)')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('item_template_id', 'is', null);
      if (error) throw error;

      for (const row of data ?? []) {
        const key = row.item_template_id as string;
        const prev = map.get(key)?.quantity ?? 0;
        map.set(key, {
          quantity: prev + Number(row.quantity ?? 0),
          unit: row.company_item?.unit ?? null,
        });
      }
      return map;
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}
