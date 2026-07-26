import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type PermissionProfileType = 
  | 'admin'
  | 'gerente' 
  | 'vendedor'
  | 'caixa'
  | 'almoxarifado'
  | 'producao'
  | 'instalador'
  | 'financeiro'
  | 'custom';

export type Module = 
  | 'dashboard'
  | 'clientes'
  | 'orcamentos'
  | 'ordens-servico'
  | 'agenda'
  | 'medicoes'
  | 'plano-corte'
  | 'produtos'
  | 'precos'
  | 'estoque'
  | 'caixa-vendas'
  | 'financeiro'
  | 'notas-fiscais'
  | 'funcionarios'
  | 'configuracoes';

interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface PermissionProfileRow {
  id: string;
  company_id: string;
  name: string;
  profile_type: PermissionProfileType;
  description: string | null;
  is_system: boolean;
  permissions: Record<Module, ModulePermission>;
  hide_prices: boolean;
  hide_costs: boolean;
  can_operate_cash: boolean;
  can_approve_discounts: boolean;
  can_approve_refunds: boolean;
  can_cancel_sales: boolean;
  can_manage_stock: boolean;
  can_view_reports: boolean;
  created_at: string;
  updated_at: string;
}

export const PROFILE_TYPE_LABELS: Record<PermissionProfileType, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  caixa: 'Caixa',
  almoxarifado: 'Almoxarifado',
  producao: 'Produção',
  instalador: 'Instalador',
  financeiro: 'Financeiro',
  custom: 'Personalizado',
};

export const PROFILE_TYPE_DESCRIPTIONS: Record<PermissionProfileType, string> = {
  admin: 'Acesso total ao sistema',
  gerente: 'Visualiza tudo, aprova operações',
  vendedor: 'Orçamentos, vendas e clientes',
  caixa: 'Opera vendas e fechamento de caixa',
  almoxarifado: 'Entrada/saída de material',
  producao: 'Ordens de produção',
  instalador: 'Visualiza OS e marca conclusão',
  financeiro: 'Contas e relatórios',
  custom: 'Permissões personalizadas',
};

export function usePermissionProfiles() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['permission-profiles', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('permission_profiles')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (error) throw error;

      return data.map(row => ({
        ...row,
        permissions: typeof row.permissions === 'string' 
          ? JSON.parse(row.permissions) 
          : row.permissions,
      })) as PermissionProfileRow[];
    },
    enabled: !!currentCompany?.id,
  });

  const createProfile = useMutation({
    mutationFn: async (data: Partial<PermissionProfileRow>) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      const { data: result, error } = await supabase
        .from('permission_profiles')
        .insert({
          company_id: currentCompany.id,
          name: data.name!,
          profile_type: data.profile_type || 'custom',
          description: data.description,
          permissions: data.permissions || {},
          hide_prices: data.hide_prices ?? false,
          hide_costs: data.hide_costs ?? false,
          can_operate_cash: data.can_operate_cash ?? false,
          can_approve_discounts: data.can_approve_discounts ?? false,
          can_approve_refunds: data.can_approve_refunds ?? false,
          can_cancel_sales: data.can_cancel_sales ?? false,
          can_manage_stock: data.can_manage_stock ?? false,
          can_view_reports: data.can_view_reports ?? false,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles'] });
      toast.success('Perfil criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar perfil: ' + error.message);
    },
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PermissionProfileRow> & { id: string }) => {
      // Convert permissions to JSON-compatible format
      const updateData: Record<string, unknown> = {
        ...data,
        updated_at: new Date().toISOString(),
      };
      
      if (data.permissions) {
        updateData.permissions = data.permissions as unknown as Record<string, unknown>;
      }

      const { error } = await supabase
        .from('permission_profiles')
        .update(updateData as never)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles'] });
      toast.success('Perfil atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar perfil: ' + error.message);
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('permission_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles'] });
      toast.success('Perfil excluído!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir perfil: ' + error.message);
    },
  });

  return {
    profiles,
    isLoading,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}
