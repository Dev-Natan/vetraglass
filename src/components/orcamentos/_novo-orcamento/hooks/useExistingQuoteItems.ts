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
        .select('*')
        .eq('quote_id', quoteId);

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        base_price_m2: item.width && item.height
          ? item.unit_price / ((item.width / 1000) * (item.height / 1000))
          : item.unit_price,
        item_type: item.company_item_id ? 'item' : 'product',
      })) as QuoteItem[];
    },
    enabled: !!quoteId && open,
  });
}
