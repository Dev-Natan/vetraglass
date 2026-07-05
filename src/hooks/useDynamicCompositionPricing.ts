import { useMemo } from 'react';
import { useCompositionPricing } from './useCompositionPricing';
import { useProductGlassPriceOptions } from './useProductGlassPrices';
import { useProductAluminumPriceOptions } from './useProductAluminumPrices';

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

  const glassCostPerSqm = useMemo(() => {
    if (!glassOptions.length) return null;
    const color = norm(options.glassColor);
    const thick = options.glassThicknessMm;
    const match =
      glassOptions.find(g => (!color || norm(g.glassColor) === color) && (!thick || g.thicknessMm === thick)) ||
      glassOptions.find(g => !color || norm(g.glassColor) === color) ||
      glassOptions[0];
    return match ? Number(match.costPerSqm) || Number(match.pricePerSqm) || null : null;
  }, [glassOptions, options.glassColor, options.glassThicknessMm]);

  const aluminumCostPerSqm = useMemo(() => {
    if (!aluminumOptions.length) return null;
    const color = norm(options.aluminumColor);
    const match =
      aluminumOptions.find(a => !color || norm(a.colorName) === color) ||
      aluminumOptions[0];
    return match ? Number(match.costPerSqm) || Number(match.pricePerSqm) || null : null;
  }, [aluminumOptions, options.aluminumColor]);

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
      if (row.unidade === 'ml' && aluminumCostPerSqm && aluminumCostPerSqm > 0) {
        // Converte referência por m² em custo/ml usando a razão área/perímetro
        // efetivo do projeto — mantém compat com preço cadastrado por m².
        const perMeter = aluminumCostPerSqm * (areaM2 / Math.max(linearM, 0.001));
        const subtotal = linearM * perMeter * row.qtd;
        return {
          ...row,
          custo_estoque: perMeter,
          subtotal,
          detalhe: `${linearM.toFixed(2)} m × R$ ${perMeter.toFixed(2)} × ${row.qtd} (alumínio dinâmico)`,
        };
      }
      return row;
    });

    const total = rows.reduce((s, r) => s + r.subtotal, 0);
    return { rows, total, perSqm: total / areaM2 };
  }, [base.simpleBreakdown, base.compositionCostSimpleTotal, base.compositionCostSimplePerSqm, glassCostPerSqm, aluminumCostPerSqm, options.width, options.height]);

  return {
    ...base,
    simpleBreakdown: override.rows,
    compositionCostSimpleTotal: override.total,
    compositionCostSimplePerSqm: override.perSqm,
    /** custo/m² efetivamente aplicado (dinâmico ou fallback) */
    resolvedGlassCostPerSqm: glassCostPerSqm,
    resolvedAluminumCostPerSqm: aluminumCostPerSqm,
    hasDynamicGlassPricing: !!glassCostPerSqm,
    hasDynamicAluminumPricing: !!aluminumCostPerSqm,
  };
}
