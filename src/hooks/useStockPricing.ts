import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Precificação centralizada em `company_items`.
 *   custo_unitario    = cost
 *   markup            = markup_percent
 *   preco_venda_final = sale_price
 *   unidade comercial = pricing_unit
 *
 * Escritas passam pela RPC transacional `save_company_item_pricing`.
 */
export interface StockPricingRow {
  id: string;
  item_template_id: string | null;
  name: string;
  type: string;
  unit: string | null;
  linha: string | null;
  cost: number | null;
  sale_price: number | null;
  markup_percent: number | null;
  pricing_unit: string | null;
  pricing_configured_at: string | null;
  glass_color?: string | null;
  thickness_mm?: number | null;
}

const invalidatePricingCaches = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['stock-pricing'] });
  qc.invalidateQueries({ queryKey: ['stock-by-template'] });
  qc.invalidateQueries({ queryKey: ['glass-stock-by-color-thickness'] });
  qc.invalidateQueries({ queryKey: ['glass-stock-options'] });
  qc.invalidateQueries({ queryKey: ['company-items'] });
};

/** Lista todos os `company_items` ativos da empresa com dados de precificação. */
export function useStockPricing(filter?: { type?: string; linha?: string }) {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['stock-pricing', companyId, filter?.type ?? 'all', filter?.linha ?? 'all'],
    queryFn: async () => {
      if (!companyId) return [] as StockPricingRow[];
      let q = sb
        .from('company_items')
        .select(
          'id, item_template_id, name, type, unit, linha, cost, sale_price, markup_percent, pricing_unit, pricing_configured_at, glass_color, thickness_mm'
        )
        .eq('company_id', companyId)
        .eq('is_active', true);
      if (filter?.type) q = q.eq('type', filter.type);
      if (filter?.linha) q = q.eq('linha', filter.linha);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return (data ?? []) as StockPricingRow[];
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Atualiza custo, markup e preço final (opcional override) de um company_item. */
export function useUpdateItemPricing() {
  const qc = useQueryClient();
  const { currentCompany } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      cost?: number | null;
      markup_percent?: number | null;
      sale_price?: number | null;
      pricing_unit?: string | null;
      basis?: 'MARKUP' | 'SALE_PRICE';
    }) => {
      if (!currentCompany?.id) throw new Error('Sem empresa ativa');
      const basis = input.basis ?? 'MARKUP';
      const value = basis === 'MARKUP' ? input.markup_percent : input.sale_price;
      const { error } = await sb.rpc('save_company_item_pricing', {
        _company_id: currentCompany.id,
        _company_item_id: input.id,
        _cost: input.cost,
        _basis: basis,
        _value: value,
        _pricing_unit: input.pricing_unit ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePricingCaches(qc);
      toast.success('Precificação atualizada');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Aplica reajuste percentual sobre o CUSTO de todos os itens da empresa
 * (opcionalmente filtrando por tipo e/ou linha). O trigger propaga o
 * preço de venda final automaticamente.
 */
export function useBulkAdjustCost() {
  const qc = useQueryClient();
  const { currentCompany } = useAuth();

  return useMutation({
    mutationFn: async (input: { percent: number; type?: string; linha?: string }) => {
      if (!currentCompany?.id) throw new Error('Sem empresa ativa');
      const { data, error } = await sb.rpc('bulk_adjust_item_cost', {
        p_company_id: currentCompany.id,
        p_percent: input.percent,
        p_type: input.type ?? null,
        p_linha: input.linha ?? null,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (affected) => {
      invalidatePricingCaches(qc);
      toast.success(`Reajuste aplicado em ${affected} ${affected === 1 ? 'item' : 'itens'}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Retorna Map<item_template_id, custo> para o motor de orçamento consultar
 * o custo diretamente do estoque, sem passar por tabelas paralelas.
 */
export function usePricingByTemplate() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['stock-pricing-by-template', companyId],
    queryFn: async () => {
      const map = new Map<
        string,
        {
          cost: number | null;
          /** Derived compatibility alias; source remains company_items.cost. */
          costPerMeter: number | null;
          salePrice: number | null;
          /** Derived compatibility alias; source remains company_items.sale_price. */
          salePricePerMeter: number | null;
          markupPercent: number | null;
          unit: string | null;
        }
      >();
      if (!companyId) return map;
      const { data, error } = await sb
        .from('company_items')
        .select(
          'item_template_id, cost, sale_price, markup_percent, pricing_unit, unit'
        )
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('item_template_id', 'is', null);
      if (error) throw error;
      for (const row of data ?? []) {
        map.set(row.item_template_id as string, {
          cost: row.cost != null ? Number(row.cost) : null,
          costPerMeter: row.cost != null ? Number(row.cost) : null,
          salePrice: row.sale_price != null ? Number(row.sale_price) : null,
          salePricePerMeter: row.sale_price != null ? Number(row.sale_price) : null,
          markupPercent:
            row.markup_percent != null ? Number(row.markup_percent) : null,
          unit: row.pricing_unit ?? row.unit ?? null,
        });
      }
      return map;
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}
