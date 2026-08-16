import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionService } from '@/services/permissionService';

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
  | 'producao'
  | 'produtos'
  | 'estoque'
  | 'caixa-vendas'
  | 'financeiro'
  
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
  const userCompanyData = companies.find(c => c.companyId === currentCompany?.id);
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

  // Instantiate service
  const permissionService = new PermissionService(isAdmin, profile, permissions);

  return {
    role: currentRole || null,
    profileType: profile?.profile_type || null,
    permissions,
    isLoading,
    isAdmin,
    isManager,
    isEmployee,
    canAccess: (module: Module) => permissionService.canAccess(module),
    canCreate: (module: Module) => permissionService.canCreate(module),
    canEdit: (module: Module) => permissionService.canEdit(module),
    canDelete: (module: Module) => permissionService.canDelete(module),
    getPermission: (module: Module) => permissionService.getPermission(module),
    // New methods
    canSeePrices: () => permissionService.canSeePrices(),
    canSeeCosts: () => permissionService.canSeeCosts(),
    canOperateCash: () => permissionService.canOperateCash(),
  };
}
