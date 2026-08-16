import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useOpenCashRegister(
  companyId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['cash-register-open', companyId, userId],
    queryFn: async () => {
      if (!companyId || !userId) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .or(`opened_by.eq.${userId},operator_id.eq.${userId}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!userId && enabled,
  });
}
