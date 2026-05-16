import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface CompanyCash {
  id: string;
  company_id: string;
  fixed_fund: number;
  current_balance: number;
  last_opening_at: string | null;
  last_closing_at: string | null;
  status: string;
}

export interface CashRegister {
  id: string;
  company_id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  status: 'open' | 'closed' | 'auditing';
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

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

  async getOpenCashRegister(companyId: string, userId: string): Promise<CashRegister | null> {
    const { data, error } = await supabase.rpc('get_user_open_cash_register', {
      _company_id: companyId,
    });
    if (error) throw error;
    
    if (data && data.length > 0) {
      const { data: fullRegister, error: fullError } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('id', data[0].id)
        .single();
      if (fullError) throw fullError;
      return fullRegister as CashRegister;
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

  async fetchCashMovements(cashRegisterId: string) {
    const { data, error } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchExpensesDueToday(companyId: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
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
