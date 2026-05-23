import { supabase } from '@/integrations/supabase/client';

export type QuoteStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'converted';

export interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  customer_document?: string | null;
  customer_document_type?: string | null;
  customer_profession?: string | null;
  customer_marital_status?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  status: QuoteStatus;
  total_amount: number;
  discount_percent?: number | null;
  discount_amount?: number | null;
  final_amount: number;
  valid_until: string | null;
  show_measures_column?: boolean | null;
  show_m2_column?: boolean | null;
  created_at: string;
}

export const quoteService = {
  async fetchQuotes(companyId: string): Promise<Quote[]> {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_name, customer_phone, customer_email, customer_address, customer_document, customer_document_type, customer_profession, customer_marital_status, payment_terms, notes, status, total_amount, discount_percent, discount_amount, final_amount, valid_until, show_measures_column, show_m2_column, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Quote[];
  },

  async deleteQuote(quoteId: string) {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId);
    if (error) throw error;
  },

  async updateQuoteStatus(quoteId: string, status: QuoteStatus) {
    const { error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quoteId);
    if (error) throw error;
  },

  async cancelApprovedQuote(quoteId: string) {
    const { data, error } = await supabase.rpc('cancel_approved_quote', { _quote_id: quoteId });
    if (error) throw error;
    return data as any;
  },

  async fetchQuoteItems(quoteId: string) {
    const { data, error } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId);
    if (error) throw error;
    return data || [];
  },

  async duplicateQuote(companyId: string, quote: Quote, items: any[]) {
    const { data: newQuote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        company_id: companyId,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone,
        customer_email: quote.customer_email,
        customer_address: quote.customer_address,
        customer_document: quote.customer_document,
        customer_document_type: quote.customer_document_type,
        customer_profession: quote.customer_profession,
        customer_marital_status: quote.customer_marital_status,
        payment_terms: quote.payment_terms,
        notes: quote.notes,
        total_amount: quote.total_amount,
        discount_percent: quote.discount_percent,
        discount_amount: quote.discount_amount,
        final_amount: quote.final_amount,
        status: 'pending',
        show_measures_column: quote.show_measures_column,
        show_m2_column: quote.show_m2_column,
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    if (items && items.length > 0 && newQuote) {
      await supabase
        .from('quote_items')
        .insert(items.map(item => ({
          quote_id: newQuote.id,
          company_product_id: item.company_product_id,
          product_template_id: item.product_template_id,
          company_item_id: item.company_item_id,
          description: item.description,
          width: item.width,
          width_b: item.width_b,
          height: item.height,
          height_b: item.height_b,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          has_glass: item.has_glass,
          glass_color: item.glass_color,
          glass_thickness: item.glass_thickness,
          aluminum_color: item.aluminum_color,
        })));
    }
    return newQuote;
  }
};
