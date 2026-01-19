import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Legacy support - re-export from new hook
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

/**
 * Legacy hook for backward compatibility.
 * New code should use usePermissionProfile for the full permission profile system.
 */
export function usePermissions() {
  const { user, currentCompany, companies } = useAuth();

  // Get user role from companies array
  const userCompanyData = companies.find(c => c.id === currentCompany?.id);
  const explicitRole = (userCompanyData as any)?.role as AppRole | undefined;
  
  // If no explicit role found, default to 'admin' for company owners
  const currentRole: AppRole = explicitRole || 'admin';

  // Try to get permission profile first (new system)
  const { data: profile } = useQuery({
    queryKey: ['permission-profile-legacy', currentCompany?.id, user?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !user?.id) return null;

      const { data, error } = await supabase.rpc('get_user_permission_profile', {
        _user_id: user.id,
        _company_id: currentCompany.id
      });

      if (error || !data || data.length === 0) return null;
      return data[0];
    },
    enabled: !!currentCompany?.id && !!user?.id,
  });

  // Fallback to legacy role_permissions table
  // NOTE: enabled must NOT depend on `profile` to avoid hooks order issues
  const shouldFetchLegacy = !!currentCompany?.id && currentRole !== 'admin';
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions', currentCompany?.id, currentRole],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
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
    enabled: shouldFetchLegacy,
  });

  const isAdmin = currentRole === 'admin' || profile?.profile_type === 'admin';
  const isManager = currentRole === 'manager' || profile?.profile_type === 'gerente';
  const isEmployee = currentRole === 'employee' || ['vendedor', 'caixa', 'almoxarifado', 'producao', 'instalador', 'financeiro'].includes(profile?.profile_type || '');

  const getPermission = (module: Module): Permission | null => {
    // Check new profile system first
    if (profile?.permissions) {
      const perms = typeof profile.permissions === 'string' 
        ? JSON.parse(profile.permissions) 
        : profile.permissions;
      const modulePerm = perms[module];
      if (modulePerm) {
        return {
          module,
          can_view: modulePerm.view ?? false,
          can_create: modulePerm.create ?? false,
          can_edit: modulePerm.edit ?? false,
          can_delete: modulePerm.delete ?? false,
        };
      }
    }
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

  // New permission checks from profile system
  const canSeePrices = (): boolean => {
    if (isAdmin) return true;
    return !profile?.hide_prices;
  };

  const canSeeCosts = (): boolean => {
    if (isAdmin) return true;
    return !profile?.hide_costs;
  };

  const canOperateCash = (): boolean => {
    if (isAdmin) return true;
    return profile?.can_operate_cash ?? false;
  };

  return {
    role: currentRole || null,
    profileType: profile?.profile_type || null,
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
    // New methods
    canSeePrices,
    canSeeCosts,
    canOperateCash,
  };
}
