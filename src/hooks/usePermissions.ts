import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'manager' | 'employee';

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

export interface Permission {
  module: Module;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UserPermissions {
  role: AppRole | null;
  permissions: Permission[];
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
}

export function usePermissions() {
  const { user, currentCompany, companies } = useAuth();

  // Get user role from companies array
  const userCompanyData = companies.find(c => c.id === currentCompany?.id);
  const explicitRole = (userCompanyData as any)?.role as AppRole | undefined;
  
  // If no explicit role found, default to 'admin' for company owners
  // This handles the case where the original company creator doesn't have a user_companies record
  const currentRole: AppRole = explicitRole || 'admin';

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions', currentCompany?.id, currentRole],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Admin has all permissions, no need to fetch
      if (currentRole === 'admin') return [];

      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('role', currentRole);

      if (error) {
        console.error('Error fetching permissions:', error);
        return [];
      }

      return data as Permission[];
    },
    enabled: !!currentCompany?.id && currentRole !== 'admin',
  });

  const isAdmin = currentRole === 'admin';
  const isManager = currentRole === 'manager';
  const isEmployee = currentRole === 'employee';

  const getPermission = (module: Module): Permission | null => {
    return permissions.find(p => p.module === module) || null;
  };

  const canAccess = (module: Module): boolean => {
    if (isAdmin) return true;
    const permission = getPermission(module);
    return permission?.can_view ?? false;
  };

  const canCreate = (module: Module): boolean => {
    if (isAdmin) return true;
    const permission = getPermission(module);
    return permission?.can_create ?? false;
  };

  const canEdit = (module: Module): boolean => {
    if (isAdmin) return true;
    const permission = getPermission(module);
    return permission?.can_edit ?? false;
  };

  const canDelete = (module: Module): boolean => {
    if (isAdmin) return true;
    const permission = getPermission(module);
    return permission?.can_delete ?? false;
  };

  return {
    role: currentRole || null,
    permissions,
    isLoading,
    isAdmin,
    isManager,
    isEmployee,
    canAccess,
    canCreate,
    canEdit,
    canDelete,
    getPermission,
  };
}
