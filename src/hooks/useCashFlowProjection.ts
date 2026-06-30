import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export interface CashFlowDay {
  date: string;
  realized_in: number;
  realized_out: number;
  projected_in: number;
  projected_out: number;
}

export function useCashFlowProjection(start: Date, end: Date) {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['cash-flow-projection', currentCompany?.id, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    enabled: !!currentCompany?.id,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<CashFlowDay[]> => {
      const { data, error } = await supabase.rpc('get_cash_flow_projection', {
        p_company_id: currentCompany!.id,
        p_start: format(start, 'yyyy-MM-dd'),
        p_end: format(end, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      return (data ?? []) as CashFlowDay[];
    },
  });
}
