import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type DreGroup =
  | 'receita_bruta'
  | 'deducoes'
  | 'cmv'
  | 'despesas_operacionais'
  | 'despesas_administrativas'
  | 'despesas_pessoal'
  | 'despesas_financeiras'
  | 'receitas_financeiras'
  | 'impostos'
  | 'outras_receitas'
  | 'outras_despesas';

export interface FinancialCategory {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  kind: 'receita' | 'despesa';
  dre_group: DreGroup;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const DRE_GROUP_LABEL: Record<DreGroup, string> = {
  receita_bruta: 'Receita Bruta',
  deducoes: 'Deduções de Receita',
  cmv: 'CMV — Custo das Mercadorias',
  despesas_operacionais: 'Despesas Operacionais',
  despesas_administrativas: 'Despesas Administrativas',
  despesas_pessoal: 'Despesas com Pessoal',
  despesas_financeiras: 'Despesas Financeiras',
  receitas_financeiras: 'Receitas Financeiras',
  impostos: 'Impostos e Tributos',
  outras_receitas: 'Outras Receitas',
  outras_despesas: 'Outras Despesas',
};

export const DRE_GROUPS_BY_KIND: Record<'receita' | 'despesa', DreGroup[]> = {
  receita: ['receita_bruta', 'receitas_financeiras', 'outras_receitas', 'deducoes'],
  despesa: [
    'cmv',
    'despesas_pessoal',
    'despesas_administrativas',
    'despesas_operacionais',
    'despesas_financeiras',
    'impostos',
    'outras_despesas',
  ],
};

export function useFinancialCategories(kind?: 'receita' | 'despesa') {
  const { currentCompany } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['financial-categories', currentCompany?.id, kind],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      // Auto-seed if nenhuma categoria existe
      let q = supabase
        .from('financial_categories')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (kind) q = q.eq('kind', kind);
      const { data, error } = await q;
      if (error) throw error;
      if ((data?.length ?? 0) === 0 && !kind) {
        await supabase.rpc('seed_default_financial_categories', { _company_id: currentCompany.id });
        const refetch = await supabase
          .from('financial_categories')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('active', true)
          .order('sort_order', { ascending: true });
        return (refetch.data as FinancialCategory[]) || [];
      }
      return (data as FinancialCategory[]) || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 0,
    gcTime: 0,
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<FinancialCategory> & { id?: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      if (payload.id) {
        const { error } = await supabase
          .from('financial_categories')
          .update({
            name: payload.name,
            kind: payload.kind,
            dre_group: payload.dre_group,
            color: payload.color,
            icon: payload.icon,
            active: payload.active ?? true,
          })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_categories').insert({
          company_id: currentCompany.id,
          name: payload.name!,
          kind: payload.kind!,
          dre_group: payload.dre_group!,
          color: payload.color ?? null,
          icon: payload.icon ?? null,
          is_system: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-categories'] });
      toast.success('Categoria salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-categories'] });
      toast.success('Categoria removida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert, remove };
}
