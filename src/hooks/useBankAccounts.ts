import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type AccountType =
  | 'corrente'
  | 'poupanca'
  | 'caixa'
  | 'investimento'
  | 'carteira_digital';

export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  bank_name: string | null;
  bank_code: string | null;
  agency: string | null;
  account_number: string | null;
  account_type: AccountType;
  pix_key: string | null;
  pix_key_type: string | null;
  initial_balance: number;
  current_balance: number;
  color: string | null;
  active: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa / Cofre',
  investimento: 'Investimento',
  carteira_digital: 'Carteira Digital',
};

export function useBankAccounts(onlyActive = true) {
  const { currentCompany } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['bank-accounts', currentCompany?.id, onlyActive],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      let q = supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      if (onlyActive) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as BankAccount[]) || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 0,
    gcTime: 0,
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<BankAccount> & { id?: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const body = {
        name: payload.name,
        bank_name: payload.bank_name ?? null,
        bank_code: payload.bank_code ?? null,
        agency: payload.agency ?? null,
        account_number: payload.account_number ?? null,
        account_type: payload.account_type ?? 'corrente',
        pix_key: payload.pix_key ?? null,
        pix_key_type: payload.pix_key_type ?? null,
        initial_balance: payload.initial_balance ?? 0,
        current_balance: payload.current_balance ?? payload.initial_balance ?? 0,
        color: payload.color ?? '#3b82f6',
        active: payload.active ?? true,
        is_default: payload.is_default ?? false,
        notes: payload.notes ?? null,
      };
      if (payload.id) {
        const { error } = await supabase.from('bank_accounts').update(body).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert({ ...body, company_id: currentCompany.id, name: body.name! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Conta salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Conta removida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert, remove };
}
