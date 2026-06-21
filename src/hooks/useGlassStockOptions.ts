import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatGlassName, isGlassUnit } from '@/utils/glassName';

export interface GlassStockOption {
  id: string;
  name: string;
  displayName: string;
  color: string;
  thickness: string;       // como string (ex.: "8")
  costPerSqm: number;      // R$ / m²
  salePricePerSqm: number; // R$ / m²  (sale_price_per_meter || cost*margin)
  marginPercent: number;
}

/**
 * Lista os insumos de VIDRO (unit = m²) ativos no estoque da empresa
 * atual, para alimentar os seletores de Cor/Espessura do orçamento e
 * permitir o cálculo dinâmico do preço final.
 */
export function useGlassStockOptions(enabled = true) {
  const { currentCompany } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['glass-stock-options', currentCompany?.id],
    queryFn: async (): Promise<GlassStockOption[]> => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_items')
        .select('id, name, unit, type, cost, cost_per_meter, sale_price_per_meter, sale_margin_percent, thickness_mm, glass_color, is_active')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      if (error) throw error;

      return (data || [])
        .filter((it: any) => isGlassUnit(it.unit) || it.type === 'glass')
        .map((it: any) => {
          const cost = Number(it.cost_per_meter) || Number(it.cost) || 0;
          const margin = Number(it.sale_margin_percent) || 0;
          const sale = Number(it.sale_price_per_meter) || (cost > 0 && margin > 0 ? cost * (1 + margin / 100) : cost);
          const thickness = it.thickness_mm != null ? String(it.thickness_mm) : '';
          const color = String(it.glass_color || '').trim();
          return {
            id: it.id,
            name: it.name,
            displayName: formatGlassName(it.name, color, thickness),
            color,
            thickness,
            costPerSqm: cost,
            salePricePerSqm: sale,
            marginPercent: margin,
          } as GlassStockOption;
        })
        // Só faz sentido oferecer opções com pelo menos cor OU espessura
        .filter((g) => g.color || g.thickness);
    },
    enabled: enabled && !!currentCompany?.id,
    staleTime: 60_000,
  });

  const options = data || [];

  const thicknessOptions = useMemo(
    () => Array.from(new Set(options.map((o) => o.thickness).filter(Boolean))).sort((a, b) => Number(a) - Number(b)),
    [options],
  );

  const colorOptionsFor = (thickness?: string) => {
    const base = thickness ? options.filter((o) => o.thickness === thickness) : options;
    return Array.from(new Set(base.map((o) => o.color).filter(Boolean))).sort();
  };

  const findMatch = (thickness?: string, color?: string): GlassStockOption | null => {
    if (!thickness && !color) return null;
    const t = String(thickness || '').trim();
    const c = String(color || '').trim().toLowerCase();
    return (
      options.find((o) =>
        (!t || o.thickness === t) && (!c || o.color.toLowerCase() === c),
      ) || null
    );
  };

  return { options, thicknessOptions, colorOptionsFor, findMatch, isLoading };
}
