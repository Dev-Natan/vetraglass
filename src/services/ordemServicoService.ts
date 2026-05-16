import { supabase } from '@/integrations/supabase/client';

export const ordemServicoService = {
  async fetchCompletedOSPendingBilling(companyId: string) {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('id, os_number, customer_name, total_amount, paid_amount, pending_amount, quote_id, status, estimated_end, created_at')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .is('sale_id', null)
      .gt('pending_amount', 0)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async updateOS(osId: string, data: any) {
    const { error } = await supabase
      .from('ordens_servico')
      .update(data)
      .eq('id', osId);
    if (error) throw error;
  }
};
