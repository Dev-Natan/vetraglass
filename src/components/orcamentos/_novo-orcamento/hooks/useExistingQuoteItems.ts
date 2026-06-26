import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuoteItem } from '../types';

export function useExistingQuoteItems(quoteId: string | undefined, open: boolean) {
  return useQuery({
    queryKey: ['quote-items', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_items')
        .select('*, company_products(linha, image_url), product_templates(linha, image_url), company_items(image_url), item_templates(image_url)')
        .eq('quote_id', quoteId);

      if (error) throw error;
      return (data || []).map((item: any) => {
        const hasMultiSide = Number(item.width_b) > 0 || Number(item.height_b) > 0;
        const linha = item.company_products?.linha || item.product_templates?.linha || null;
        const resolvedImage =
          item.image_url ||
          item.company_products?.image_url ||
          item.product_templates?.image_url ||
          item.company_items?.image_url ||
          item.item_templates?.image_url ||
          null;
        return {
          ...item,
          linha,
          image_url: resolvedImage,
          // Strip Lado B for single-side products so the form doesn't render those inputs
          width_b: hasMultiSide ? item.width_b : undefined,
          height_b: hasMultiSide ? item.height_b : undefined,
          base_price_m2: item.width && item.height
            ? item.unit_price / ((item.width / 1000) * (item.height / 1000))
            : item.unit_price,
          item_type: item.company_item_id ? 'item' : 'product',
        };
      }) as QuoteItem[];
    },
    enabled: !!quoteId && open,
  });
}
