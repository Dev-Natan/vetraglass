import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export interface DRERow {
  kind: 'receita' | 'despesa';
  dre_group: string;
  category_id: string | null;
  category_name: string;
  category_color: string;
  amount: number;
  count: number;
}

export const DRE_GROUP_LABELS: Record<string, string> = {
  receita_bruta: 'Receita Bruta',
  receitas_financeiras: 'Receitas Financeiras',
  outras_receitas: 'Outras Receitas',
  cmv: 'Custo das Mercadorias / Serviços (CMV/CSP)',
  despesas_pessoal: 'Despesas com Pessoal',
  despesas_administrativas: 'Despesas Administrativas',
  despesas_operacionais: 'Despesas Operacionais',
  despesas_financeiras: 'Despesas Financeiras',
  impostos: 'Impostos',
  outras_despesas: 'Outras Despesas',
};

export const DRE_GROUP_ORDER = [
  'receita_bruta',
  'receitas_financeiras',
  'outras_receitas',
  'cmv',
  'despesas_pessoal',
  'despesas_administrativas',
  'despesas_operacionais',
  'despesas_financeiras',
  'impostos',
  'outras_despesas',
];

export function useDRE(start: Date, end: Date) {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['dre-report', currentCompany?.id, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    enabled: !!currentCompany?.id,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<DRERow[]> => {
      const { data, error } = await supabase.rpc('get_dre_report', {
        p_company_id: currentCompany!.id,
        p_start: format(start, 'yyyy-MM-dd'),
        p_end: format(end, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      return (data ?? []) as DRERow[];
    },
  });
}
