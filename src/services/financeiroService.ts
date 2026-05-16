import { supabase } from '@/integrations/supabase/client';

export const financeiroService = {
  async fetchAuditLogs(companyId: string, filters: { user_id?: string; date_from?: string; date_to?: string }) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.date_from) query = query.gte('created_at', filters.date_from);
    if (filters.date_to) query = query.lte('created_at', filters.date_to);

    const { data, error } = await query.limit(100);
    if (error) throw error;
    return data || [];
  },

  async fetchCompanyFinancialSummary(companyId: string) {
    // Manually calculating summary since RPCs don't exist
    const { data: incomeMovements, error: incomeError } = await supabase
      .from('cash_movements')
      .select('amount')
      .eq('company_id', companyId)
      .eq('type', 'entrada');
      
    const { data: outcomeMovements, error: outcomeError } = await supabase
      .from('cash_movements')
      .select('amount')
      .eq('company_id', companyId)
      .eq('type', 'saida');
    
    if (incomeError || outcomeError) throw incomeError || outcomeError;
    
    const income = (incomeMovements || []).reduce((sum, m) => sum + (m.amount || 0), 0);
    const outcome = (outcomeMovements || []).reduce((sum, m) => sum + (m.amount || 0), 0);
    
    return {
      income,
      outcome,
      balance: income - outcome
    };
  }
};
