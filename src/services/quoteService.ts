import { supabase } from '@/integrations/supabase/client';

export const quoteService = {
  async fetchQuoteDetails(quoteId: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        id, quote_number, customer_name, total_amount, final_amount, status, created_at,
        quote_items (id, description, quantity, unit_price, total_price, width, height, company_product_id, product_template_id)
      `)
      .eq('id', quoteId)
      .single();
    if (error) throw error;
    return data;
  }
};
