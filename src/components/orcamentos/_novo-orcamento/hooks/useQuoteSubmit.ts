import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { QuoteFormData, QuoteItem, Quote } from '../types';
import { mapItemForInsert } from '../utils';
import { operationalErrorMessage } from '@/utils/operationalError';

interface SubmitParams {
  companyId: string | undefined;
  clientId: string | null;
  quote: Quote | null | undefined;
  items: QuoteItem[];
  totals: { totalAmount: number; discountAmount: number; finalAmount: number };
  discountPercent: number;
  showMeasuresColumn?: boolean;
  showM2Column?: boolean;
  onClose: () => void;
}

export function useQuoteSubmit({ companyId, clientId, quote, items, totals, discountPercent, showMeasuresColumn, showM2Column, onClose }: SubmitParams) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const buildQuotePayload = (data: QuoteFormData) => ({
    client_id: data.client_id || clientId || null,
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
    show_measures_column: showMeasuresColumn ?? true,
    show_m2_column: showM2Column ?? true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!companyId) throw new Error('Empresa não selecionada');
      if (items.length === 0) throw new Error('Adicione ao menos um item ao orçamento');

      const { data: result, error } = await supabase.rpc('save_quote_transactional', {
        _company_id: companyId,
        _quote_id: null,
        _quote: buildQuotePayload(data),
        _items: items.map(item => mapItemForInsert(item, '')),
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento criado com sucesso!' });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar orçamento', description: operationalErrorMessage(error, 'Não foi possível salvar o orçamento.'), variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!quote?.id) throw new Error('Orçamento não encontrado');
      if (!companyId) throw new Error('Empresa não selecionada');
      if (items.length === 0) throw new Error('Adicione ao menos um item ao orçamento');

      const { error } = await supabase.rpc('save_quote_transactional', {
        _company_id: companyId,
        _quote_id: quote.id,
        _quote: buildQuotePayload(data),
        _items: items.map(item => mapItemForInsert(item, quote.id)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento atualizado com sucesso!' });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar orçamento', description: operationalErrorMessage(error, 'Não foi possível atualizar o orçamento.'), variant: 'destructive' });
    },
  });


  return { createMutation, updateMutation };
}
