import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

export type CompanyCash = Database['public']['Tables']['company_cash']['Row'];
export type CashRegister = Database['public']['Tables']['cash_registers']['Row'];
export type CashMovement = Database['public']['Tables']['cash_movements']['Row'];

export const caixaService = {
  async fetchCompanyCash(companyId: string): Promise<CompanyCash | null> {
    const { data, error } = await supabase
      .from('company_cash')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getOpenCashRegister(companyId: string): Promise<CashRegister | null> {
    const { data, error } = await supabase.rpc('get_user_open_cash_register', {
      _company_id: companyId,
    });
    if (error) throw error;
    
    if (data && data.length > 0) {
      const { data: fullRegister, error: fullError } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('id', (data[0] as any).id)
        .single();
      if (fullError) throw fullError;
      return fullRegister;
    }
    return null;
  },

  async openCash(companyId: string, userId: string, openingAmount: number) {
    const { data, error } = await supabase.rpc('open_daily_cash', {
      _company_id: companyId,
      _opening_amount: openingAmount,
      _user_id: userId,
    });
    if (error) throw error;
    return data as { success: boolean; error?: string; cash_register_id?: string };
  },

  async fetchCashMovements(cashRegisterId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('cash_movements')
      .select('*, cliente:clients!cash_movements_cliente_id_fkey(name), fornecedor:clients!cash_movements_fornecedor_id_fkey(name), funcionario:employees!cash_movements_funcionario_id_fkey(name)')
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchExpensesDueToday(companyId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('expenses')
      .select('*, supplier:clients(name, phone, email, document)')
      .eq('company_id', companyId)
      .eq('due_date', today)
      .eq('status', 'pending')
      .order('amount', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchReceivablesDueToday(companyId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('*, sales!left(payment_status)')
      .eq('company_id', companyId)
      .eq('due_date', today)
      .eq('status', 'pending')
      .order('total_amount', { ascending: false });

    if (error) throw error;
    // Filter out cancelled sales
    return (data || []).filter(r => (r as any).sales?.payment_status !== 'cancelled');
  }
};
