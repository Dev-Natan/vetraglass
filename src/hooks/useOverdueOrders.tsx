import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OverdueOrder {
  id: string;
  os_number: number;
  customer_name: string;
  estimated_end: string;
  days_overdue: number;
  status: string;
}

export function useOverdueOrders() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['overdue-orders', currentCompany?.id],
    queryFn: async (): Promise<OverdueOrder[]> => {
      if (!currentCompany?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, os_number, customer_name, estimated_end, status')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'in_progress'])
        .not('estimated_end', 'is', null)
        .lt('estimated_end', today)
        .order('estimated_end', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(os => {
        const estimatedDate = new Date(os.estimated_end!);
        const todayDate = new Date(today);
        const diffTime = todayDate.getTime() - estimatedDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          id: os.id,
          os_number: os.os_number,
          customer_name: os.customer_name,
          estimated_end: os.estimated_end!,
          days_overdue: diffDays,
          status: os.status
        };
      });
    },
    enabled: !!currentCompany?.id,
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  });
}
