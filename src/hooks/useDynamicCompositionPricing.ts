import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompositionPricing } from './useCompositionPricing';
import { useProductGlassPriceOptions } from './useProductGlassPrices';
import { useProductAluminumPriceOptions } from './useProductAluminumPrices';
import { useAllItemTemplateColorPrices, useAllCompanyItemColorPrices } from './useItemColorPrices';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface SuggestedPrice {
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
      return (data ?? []) as SuggestedPrice[];
    },
    staleTime: 60_000,
  });
}

function useCompanySuggestedPricesCache(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-suggested-prices-cache', companyId],
    queryFn: async () => {
      if (!companyId) return [] as SuggestedPrice[];
      const { data, error } = await sb
        .from('company_suggested_prices')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as SuggestedPrice[];
    },
    enabled: !!companyId,
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
  const { currentCompany } = useAuth();

  const { data: glassOptions = [] } = useProductGlassPriceOptions(options.companyProductId || null);
  const { data: aluminumOptions = [] } = useProductAluminumPriceOptions(options.companyProductId || null);
  const { data: companyPrices = [] } = useCompanySuggestedPricesCache(currentCompany?.id);
  const { data: adminPrices = [] } = useAdminSuggestedPricesCache();
  const { data: templateColorPrices = [] } = useAllItemTemplateColorPrices();
  const { data: companyTemplateColorPrices = [] } = useAllCompanyItemColorPrices();

  /** Preço/ml específico por item_template + cor (empresa → admin). */
  const pickTemplateColorPerMeter = (templateId: string | null, color: string | null): number | null => {
    if (!templateId) return null;
    const c = norm(color);
    // 1) override da empresa
    const cRow = companyTemplateColorPrices.find(
      (r) => r.item_template_id === templateId && (!c || norm(r.color_name) === c)
    );
    if (cRow) {
      const v = Number(cRow.cost_per_meter) || Number(cRow.price_per_meter) || 0;
      if (v > 0) return v;
    }
    // 2) sugerido do admin
    const aRow = templateColorPrices.find(
      (r) => r.item_template_id === templateId && (!c || norm(r.color_name) === c)
    );
    if (aRow) {
      const v = Number(aRow.cost_per_meter) || Number(aRow.price_per_meter) || 0;
      if (v > 0) return v;
    }
    return null;
  };

  const glassCostPerSqm = useMemo(() => {
    const color = norm(options.glassColor);
    const thick = options.glassThicknessMm;
    // 1) preço da empresa por produto
    if (glassOptions.length) {
      const match =
        glassOptions.find(g => (!color || norm(g.glassColor) === color) && (!thick || g.thicknessMm === thick)) ||
        glassOptions.find(g => !color || norm(g.glassColor) === color) ||
        glassOptions[0];
      const v = match ? Number(match.costPerSqm) || Number(match.pricePerSqm) : 0;
      if (v > 0) return v;
    }
    // 2) "Meus Preços" da empresa
    const findIn = (list: SuggestedPrice[]) =>
      list.find(p => p.kind === 'glass' && (!color || norm(p.glass_color) === color) && (!thick || p.thickness_mm === thick)) ||
      list.find(p => p.kind === 'glass' && (!color || norm(p.glass_color) === color));
    const cp = findIn(companyPrices);
    if (cp) {
      const v = Number(cp.cost_per_sqm) || Number(cp.price_per_sqm) || 0;
      if (v > 0) return v;
    }
    // 3) fallback: preço sugerido do Admin
    const ap = findIn(adminPrices);
    return ap ? Number(ap.cost_per_sqm) || Number(ap.price_per_sqm) || null : null;
  }, [glassOptions, companyPrices, adminPrices, options.glassColor, options.glassThicknessMm]);

  const aluminumMatch = useMemo(() => {
    if (!aluminumOptions.length) return null;
    const color = norm(options.aluminumColor);
    return (
      aluminumOptions.find(a => !color || norm(a.colorName) === color) ||
      aluminumOptions[0]
    );
  }, [aluminumOptions, options.aluminumColor]);

  const companyAluFallback = useMemo(() => {
    const color = norm(options.aluminumColor);
    return companyPrices.find(p => p.kind === 'aluminum' && (!color || norm(p.aluminum_color) === color)) || null;
  }, [companyPrices, options.aluminumColor]);

  const adminAluFallback = useMemo(() => {
    const color = norm(options.aluminumColor);
    return adminPrices.find(p => p.kind === 'aluminum' && (!color || norm(p.aluminum_color) === color)) || null;
  }, [adminPrices, options.aluminumColor]);

  const pickAluValue = (
    getter: (p: SuggestedPrice) => number | null,
    getterAlt: (p: SuggestedPrice) => number | null,
  ): number | null => {
    for (const fb of [companyAluFallback, adminAluFallback]) {
      if (!fb) continue;
      const v = Number(getter(fb)) || Number(getterAlt(fb)) || 0;
      if (v > 0) return v;
    }
    return null;
  };

  const aluminumCostPerMeter = useMemo(() => {
    if (aluminumMatch) {
      const v = Number(aluminumMatch.costPerMeter) || Number(aluminumMatch.pricePerMeter);
      if (v > 0) return v;
    }
    return pickAluValue(p => p.cost_per_meter, p => p.price_per_meter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluminumMatch, companyAluFallback, adminAluFallback]);

  const aluminumCostPerSqm = useMemo(() => {
    if (aluminumMatch) {
      const v = Number(aluminumMatch.costPerSqm) || Number(aluminumMatch.pricePerSqm);
      if (v > 0) return v;
    }
    return pickAluValue(p => p.cost_per_sqm, p => p.price_per_sqm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluminumMatch, companyAluFallback, adminAluFallback]);

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
        // Prioridade: preço por perfil (template) + cor > preço legado por produto > sugerido genérico > custo original.
        let perMeter: number | null = null;
        let source = '';
        const perTemplate = pickTemplateColorPerMeter(row.item_template_id ?? null, options.aluminumColor ?? null);
        if (perTemplate && perTemplate > 0) {
          perMeter = perTemplate;
          source = 'perfil × cor';
        } else if (aluminumCostPerMeter && aluminumCostPerMeter > 0) {
          perMeter = aluminumCostPerMeter;
          source = 'alumínio linear (legado)';
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
  }, [base.simpleBreakdown, base.compositionCostSimpleTotal, base.compositionCostSimplePerSqm, glassCostPerSqm, aluminumCostPerSqm, aluminumCostPerMeter, templateColorPrices, companyTemplateColorPrices, options.aluminumColor, options.width, options.height]);

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
