import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { QuoteFormData, QuoteItem, Quote } from '../types';
import { mapItemForInsert } from '../utils';

interface SubmitParams {
  companyId: string | undefined;
  quote: Quote | null | undefined;
  items: QuoteItem[];
  totals: { totalAmount: number; discountAmount: number; finalAmount: number };
  discountPercent: number;
  onClose: () => void;
}

export function useQuoteSubmit({ companyId, quote, items, totals, discountPercent, onClose }: SubmitParams) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const buildQuotePayload = (data: QuoteFormData) => ({
    customer_name: data.customer_name,
    customer_phone: data.customer_phone || null,
    customer_email: data.customer_email || null,
    customer_address: data.customer_address || null,
    customer_document: data.customer_document || null,
    customer_document_type: data.customer_document_type || 'fisica',
    customer_profession: data.customer_profession || null,
    customer_marital_status: data.customer_marital_status || null,
    payment_terms: data.payment_terms || null,
    valid_until: data.valid_until || null,
    notes: data.notes || null,
    total_amount: totals.totalAmount,
    discount_percent: discountPercent,
    discount_amount: totals.discountAmount,
    final_amount: totals.finalAmount,
  });

  const createMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!companyId) throw new Error('Empresa não selecionada');

      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({ company_id: companyId, ...buildQuotePayload(data) })
        .select()
        .single();

      if (quoteError) throw quoteError;

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map(item => mapItemForInsert(item, newQuote.id)));

        if (itemsError) throw itemsError;
      }

      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento criado com sucesso!' });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar orçamento', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!quote?.id) throw new Error('Orçamento não encontrado');

      const { error: quoteError } = await supabase
        .from('quotes')
        .update(buildQuotePayload(data))
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      await supabase.from('quote_items').delete().eq('quote_id', quote.id);

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map(item => mapItemForInsert(item, quote.id)));

        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento atualizado com sucesso!' });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar orçamento', description: error.message, variant: 'destructive' });
    },
  });

  return { createMutation, updateMutation };
}
