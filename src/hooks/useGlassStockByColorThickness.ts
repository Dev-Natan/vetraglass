import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Saldo de estoque de vidros agrupado por combinação cor+espessura,
 * para exibição na aba de Vidros em "Meus Preços".
 * Chave: `${color.toLowerCase()}|${thicknessMm}` — mesmo formato usado em `getKey`.
 */
export function useGlassStockByColorThickness() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['glass-stock-by-color-thickness', companyId],
    queryFn: async () => {
      const map = new Map<string, { quantity: number; unit: string | null }>();
      if (!companyId) return map;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from('company_stock')
        .select(
          'quantity, company_item:company_items(unit, type, glass_color, thickness_mm, is_active)'
        )
        .eq('company_id', companyId)
        .eq('is_active', true);
      if (error) throw error;

      for (const row of data ?? []) {
        const it = row.company_item;
        if (!it || it.is_active === false) continue;
        if (it.type !== 'glass' && !(it.glass_color && it.thickness_mm)) continue;
        const color = String(it.glass_color || '').trim().toLowerCase();
        const thick = it.thickness_mm != null ? Number(it.thickness_mm) : null;
        if (!color || thick == null) continue;
        const key = `${color}|${thick}`;
        const prev = map.get(key)?.quantity ?? 0;
        map.set(key, {
          quantity: prev + Number(row.quantity ?? 0),
          unit: it.unit ?? 'm²',
        });
      }
      return map;
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}

export const glassStockKey = (color: string, thicknessMm: number) =>
  `${String(color).trim().toLowerCase()}|${thicknessMm}`;
