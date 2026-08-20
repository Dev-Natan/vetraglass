import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Retorna o caixa operacional aberto para a empresa.
// Regra: existe no maximo 1 cash_register com status='open' por company_id.
// Sem filtro por operador -- 'Caixa e Venda' e 'Financeiro' compartilham o mesmo caixa.
export function useOpenCashRegister(
  companyId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['cash-register-open', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && enabled,
  });
}
