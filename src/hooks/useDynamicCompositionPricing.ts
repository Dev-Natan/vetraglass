import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompositionPricing } from './useCompositionPricing';
import { useProductGlassPriceOptions } from './useProductGlassPrices';
import { useProductAluminumPriceOptions } from './useProductAluminumPrices';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface AdminSuggested {
  kind: 'glass' | 'aluminum';
  glass_color: string | null;
  thickness_mm: number | null;
  aluminum_color: string | null;
  cost_per_sqm: number | null;
  price_per_sqm: number | null;
  cost_per_meter: number | null;
  price_per_meter: number | null;
}

function useAdminSuggestedPricesCache() {
  return useQuery({
    queryKey: ['admin-suggested-prices-cache'],
    queryFn: async () => {
      const { data, error } = await sb.from('admin_suggested_prices').select('*');
      if (error) throw error;
      return (data ?? []) as AdminSuggested[];
    },
    staleTime: 60_000,
  });
}


interface UseDynamicCompositionPricingOptions {
  companyProductId?: string;
  width: number;
  height: number;
  widthB?: number;
  heightB?: number;
  leaves_count?: number;
  glasses_count?: number;
  panels_count?: number;
  sides_count?: number;
  quantity: number;
  enabled?: boolean;
  excludeOptionalIds?: string[];
  /** Variáveis dinâmicas escolhidas no orçamento */
  glassColor?: string | null;
  glassThicknessMm?: number | null;
  aluminumColor?: string | null;
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();

/**
 * Wrapper de useCompositionPricing que sobrescreve o custo/m² das linhas
 * de vidro e o custo/ml das linhas de perfil de alumínio conforme as
 * variáveis selecionadas (cor do vidro, espessura, cor do alumínio),
 * buscando os valores nas tabelas product_glass_prices e
 * product_aluminum_prices. Se nada bater, mantém o custo original.
 */
export function useDynamicCompositionPricing(options: UseDynamicCompositionPricingOptions) {
  const base = useCompositionPricing(options);

  const { data: glassOptions = [] } = useProductGlassPriceOptions(options.companyProductId || null);
  const { data: aluminumOptions = [] } = useProductAluminumPriceOptions(options.companyProductId || null);
  const { data: adminPrices = [] } = useAdminSuggestedPricesCache();

  const glassCostPerSqm = useMemo(() => {
    const color = norm(options.glassColor);
    const thick = options.glassThicknessMm;
    // 1) preço da empresa
    if (glassOptions.length) {
      const match =
        glassOptions.find(g => (!color || norm(g.glassColor) === color) && (!thick || g.thicknessMm === thick)) ||
        glassOptions.find(g => !color || norm(g.glassColor) === color) ||
        glassOptions[0];
      const v = match ? Number(match.costPerSqm) || Number(match.pricePerSqm) : 0;
      if (v > 0) return v;
    }
    // 2) fallback: preço sugerido do Admin
    const fb =
      adminPrices.find(p => p.kind === 'glass' && (!color || norm(p.glass_color) === color) && (!thick || p.thickness_mm === thick)) ||
      adminPrices.find(p => p.kind === 'glass' && (!color || norm(p.glass_color) === color));
    return fb ? Number(fb.cost_per_sqm) || Number(fb.price_per_sqm) || null : null;
  }, [glassOptions, adminPrices, options.glassColor, options.glassThicknessMm]);

  const aluminumMatch = useMemo(() => {
    if (!aluminumOptions.length) return null;
    const color = norm(options.aluminumColor);
    return (
      aluminumOptions.find(a => !color || norm(a.colorName) === color) ||
      aluminumOptions[0]
    );
  }, [aluminumOptions, options.aluminumColor]);

  const adminAluFallback = useMemo(() => {
    const color = norm(options.aluminumColor);
    return adminPrices.find(p => p.kind === 'aluminum' && (!color || norm(p.aluminum_color) === color)) || null;
  }, [adminPrices, options.aluminumColor]);

  const aluminumCostPerMeter = useMemo(() => {
    if (aluminumMatch) {
      const v = Number(aluminumMatch.costPerMeter) || Number(aluminumMatch.pricePerMeter);
      if (v > 0) return v;
    }
    return adminAluFallback ? Number(adminAluFallback.cost_per_meter) || Number(adminAluFallback.price_per_meter) || null : null;
  }, [aluminumMatch, adminAluFallback]);

  const aluminumCostPerSqm = useMemo(() => {
    if (aluminumMatch) {
      const v = Number(aluminumMatch.costPerSqm) || Number(aluminumMatch.pricePerSqm);
      if (v > 0) return v;
    }
    return adminAluFallback ? Number(adminAluFallback.cost_per_sqm) || Number(adminAluFallback.price_per_sqm) || null : null;
  }, [aluminumMatch, adminAluFallback]);

  const override = useMemo(() => {
    if (!base.simpleBreakdown?.length) {
      return {
        rows: base.simpleBreakdown,
        total: base.compositionCostSimpleTotal,
        perSqm: base.compositionCostSimplePerSqm,
      };
    }

    const areaM2 = ((options.width || 0) * (options.height || 0)) / 1_000_000 || 1;
    const linearM = Math.max(options.width || 0, options.height || 0) / 1000;

    const rows = base.simpleBreakdown.map(row => {
      if (row.unidade === 'm²' && glassCostPerSqm && glassCostPerSqm > 0) {
        const subtotal = areaM2 * glassCostPerSqm * row.qtd;
        return {
          ...row,
          custo_estoque: glassCostPerSqm,
          subtotal,
          detalhe: `${areaM2.toFixed(2)} m² × R$ ${glassCostPerSqm.toFixed(2)} × ${row.qtd} (vidro dinâmico)`,
        };
      }
      if (row.unidade === 'ml') {
        // Fase 5: usar preço linear real quando cadastrado; senão, converter de m².
        let perMeter: number | null = null;
        let source = '';
        if (aluminumCostPerMeter && aluminumCostPerMeter > 0) {
          perMeter = aluminumCostPerMeter;
          source = 'alumínio linear';
        } else if (aluminumCostPerSqm && aluminumCostPerSqm > 0) {
          perMeter = aluminumCostPerSqm * (areaM2 / Math.max(linearM, 0.001));
          source = 'alumínio (m²→ml)';
        }
        if (perMeter && perMeter > 0) {
          const subtotal = linearM * perMeter * row.qtd;
          return {
            ...row,
            custo_estoque: perMeter,
            subtotal,
            detalhe: `${linearM.toFixed(2)} m × R$ ${perMeter.toFixed(2)} × ${row.qtd} (${source})`,
          };
        }
      }
      return row;
    });

    const total = rows.reduce((s, r) => s + r.subtotal, 0);
    return { rows, total, perSqm: total / areaM2 };
  }, [base.simpleBreakdown, base.compositionCostSimpleTotal, base.compositionCostSimplePerSqm, glassCostPerSqm, aluminumCostPerSqm, aluminumCostPerMeter, options.width, options.height]);

  return {
    ...base,
    simpleBreakdown: override.rows,
    compositionCostSimpleTotal: override.total,
    compositionCostSimplePerSqm: override.perSqm,
    /** custo/m² efetivamente aplicado (dinâmico ou fallback) */
    resolvedGlassCostPerSqm: glassCostPerSqm,
    resolvedAluminumCostPerSqm: aluminumCostPerSqm,
    resolvedAluminumCostPerMeter: aluminumCostPerMeter,
    hasDynamicGlassPricing: !!glassCostPerSqm,
    hasDynamicAluminumPricing: !!(aluminumCostPerMeter || aluminumCostPerSqm),
  };
}
