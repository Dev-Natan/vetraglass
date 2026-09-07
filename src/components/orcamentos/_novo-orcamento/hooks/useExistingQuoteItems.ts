import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuoteItem } from '../types';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function useExistingQuoteItems(quoteId: string | undefined, open: boolean) {
  return useQuery({
    queryKey: ['quote-items', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_items')
        .select('*, company_products(linha, image_url), product_templates(linha, image_url), company_items(image_url)')
        .eq('quote_id', quoteId);

      if (error) throw error;
      return (data || []).map((item) => {
        const snapshot = asRecord(item.composition_snapshot);
        const snapshotTotals = asRecord(snapshot.totals);
        const commercialUnit = snapshot.commercial_unit === 'UNIT' || snapshotTotals.commercial_unit === 'UNIT'
          ? 'UNIT'
          : 'M2';
        const areaPerItem = item.width && item.height
          ? (item.width / 1000) * (item.height / 1000)
          : 0;
        const appliedUnitPrice = Number(
          snapshot.applied_unit_price
          ?? snapshotTotals.applied_unit_price
          ?? (commercialUnit === 'M2' && areaPerItem > 0 ? item.unit_price / areaPerItem : item.unit_price),
        );
        const hasMultiSide = Number(item.width_b) > 0 || Number(item.height_b) > 0;
        const linha = item.company_products?.linha || item.product_templates?.linha || null;
        const resolvedImage =
          item.image_url ||
          item.company_products?.image_url ||
          item.product_templates?.image_url ||
          item.company_items?.image_url ||
          null;
        return {
          ...item,
          linha,
          image_url: resolvedImage,
          // Strip Lado B for single-side products so the form doesn't render those inputs
          width_b: hasMultiSide ? item.width_b : undefined,
          height_b: hasMultiSide ? item.height_b : undefined,
          commercial_unit: commercialUnit,
          applied_unit_price: appliedUnitPrice,
          base_price_m2: appliedUnitPrice,
          item_type: item.company_item_id ? 'item' : 'product',
        };
      }) as QuoteItem[];
    },
    enabled: !!quoteId && open,
    staleTime: 0,
    gcTime: 0,
  });
}
