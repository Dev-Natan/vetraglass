import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface FormaPagamento {
  id: string;
  company_id: string;
  nome: string;
  tipo: 'avista' | 'parcelado' | 'misto' | 'pix' | 'dinheiro' | 'cartao' | 'credito' | 'debito' | 'boleto' | 'transferencia';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CondicaoPagamento {
  id: string;
  company_id: string;
  nome: string;
  parcelas: number;
  dias_entre_parcelas: number;
  juros_percent: number;
  desconto_percent: number;
  forma_pagamento_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  forma_pagamento?: FormaPagamento;
}

export interface CalculatedPayment {
  valorBase: number;
  desconto: number;
  juros: number;
  valorFinal: number;
  parcelas: number;
  valorParcela: number;
}

const FALLBACK_FORMAS: FormaPagamento[] = [
  { id: 'fallback-pix', company_id: '', nome: 'PIX', tipo: 'pix', is_active: true, sort_order: 1, created_at: '', updated_at: '' },
  { id: 'fallback-dinheiro', company_id: '', nome: 'Dinheiro', tipo: 'dinheiro', is_active: true, sort_order: 2, created_at: '', updated_at: '' },
  { id: 'fallback-cartao', company_id: '', nome: 'Cartão de Crédito/Débito', tipo: 'cartao', is_active: true, sort_order: 3, created_at: '', updated_at: '' },
  { id: 'fallback-boleto', company_id: '', nome: 'Boleto', tipo: 'boleto', is_active: true, sort_order: 4, created_at: '', updated_at: '' },
];

const normalizeFormaPagamento = (forma: Partial<FormaPagamento> & { id: string }): FormaPagamento => {
  const tipo = String(forma.tipo || forma.nome || forma.id).toLowerCase();

  return {
    id: forma.id,
    company_id: forma.company_id || '',
    nome: forma.nome || 'Forma de pagamento',
    tipo: tipo as FormaPagamento['tipo'],
    is_active: forma.is_active ?? true,
    sort_order: forma.sort_order ?? 99,
    created_at: forma.created_at || '',
    updated_at: forma.updated_at || '',
  };
};

export function usePaymentOptions() {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-seed default payment options when empty
  const ensureDefaults = async (companyId: string) => {
    const { error } = await supabase.rpc('create_default_payment_options', {
      _company_id: companyId,
    });
    if (error) throw error;
  };

  // Fetch formas de pagamento
  const { data: formasPagamento = [], isLoading: isLoadingFormas } = useQuery({
    queryKey: ['formas-pagamento', currentCompany?.id],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (!currentCompany?.id) return FALLBACK_FORMAS;

      const fetchList = async () => {
        const { data, error } = await supabase
          .from('formas_pagamento')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data ?? []).map((forma) => normalizeFormaPagamento(forma as Partial<FormaPagamento> & { id: string }));
      };

      let list: FormaPagamento[] = [];
      try {
        list = await fetchList();
      } catch (e) {
        console.warn('[usePaymentOptions] fetch formas falhou', e);
      }
      if (list.length === 0) {
        try {
          await ensureDefaults(currentCompany.id);
          list = await fetchList();
          queryClient.invalidateQueries({ queryKey: ['condicoes-pagamento'] });
        } catch (e) {
          console.warn('[usePaymentOptions] auto-seed falhou', e);
        }
      }
      if (list.length === 0) {
        console.warn('[usePaymentOptions] usando fallback local de formas de pagamento');
        return FALLBACK_FORMAS;
      }
      return list;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch condições de pagamento
  const { data: condicoesPagamento = [], isLoading: isLoadingCondicoes } = useQuery({
    queryKey: ['condicoes-pagamento', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const fetchList = async () => {
        const { data, error } = await supabase
          .from('condicoes_pagamento')
          .select('*, forma_pagamento:formas_pagamento(*)')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data ?? []) as CondicaoPagamento[];
      };

      let list = await fetchList();
      if (list.length === 0) {
        try {
          await ensureDefaults(currentCompany.id);
          list = await fetchList();
          queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
        } catch (e) {
          console.warn('[usePaymentOptions] auto-seed condições falhou', e);
        }
      }
      return list;
    },
    enabled: !!currentCompany?.id,
  });


  // Initialize default payment options for company
  const initializeDefaults = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase.rpc('create_default_payment_options', {
        _company_id: currentCompany.id
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      queryClient.invalidateQueries({ queryKey: ['condicoes-pagamento'] });
      toast({
        title: 'Opções de pagamento criadas',
        description: 'Formas e condições de pagamento padrão foram configuradas.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar opções de pagamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Calculate payment based on condition
  const calculatePayment = (valorBase: number, condicao: CondicaoPagamento | null): CalculatedPayment => {
    if (!condicao) {
      return {
        valorBase,
        desconto: 0,
        juros: 0,
        valorFinal: valorBase,
        parcelas: 1,
        valorParcela: valorBase,
      };
    }

    let valor = valorBase;
    let desconto = 0;
    let juros = 0;

    // Apply discount
    if (condicao.desconto_percent > 0) {
      desconto = valor * (condicao.desconto_percent / 100);
      valor -= desconto;
    }

    // Apply interest
    if (condicao.juros_percent > 0) {
      juros = valor * (condicao.juros_percent / 100);
      valor += juros;
    }

    const valorParcela = Math.round((valor / condicao.parcelas) * 100) / 100;

    return {
      valorBase,
      desconto,
      juros,
      valorFinal: valor,
      parcelas: condicao.parcelas,
      valorParcela,
    };
  };

  // Get conditions filtered by payment method
  const getCondicoesByForma = (formaId: string | null) => {
    if (!formaId) return condicoesPagamento;
    return condicoesPagamento.filter(c => c.forma_pagamento_id === formaId || !c.forma_pagamento_id);
  };

  return {
    formasPagamento,
    condicoesPagamento,
    isLoading: isLoadingFormas || isLoadingCondicoes,
    hasPaymentOptions: formasPagamento.length > 0,
    initializeDefaults,
    calculatePayment,
    getCondicoesByForma,
  };
}
