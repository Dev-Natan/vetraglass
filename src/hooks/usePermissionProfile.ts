import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export interface PermissionProfile {
  profile_id: string;
  profile_name: string;
  profile_type: PermissionProfileType;
  permissions: Record<Module, ModulePermission>;
  hide_prices: boolean;
  hide_costs: boolean;
  can_operate_cash: boolean;
  can_approve_discounts: boolean;
  can_cancel_sales: boolean;
  can_manage_stock: boolean;
  can_view_reports: boolean;
}

export function usePermissionProfile() {
  const { user, currentCompany, companies } = useAuth();

  // Check if user is admin via user_companies
  const userCompanyData = companies.find(c => c.companyId === currentCompany?.id);
  const userRole = (userCompanyData as any)?.role as string | undefined;
  const isCompanyAdmin = userRole === 'admin';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['permission-profile', currentCompany?.id, user?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !user?.id) return null;

      const { data, error } = await supabase.rpc('get_user_permission_profile', {
        _user_id: user.id,
        _company_id: currentCompany.id
      });

      if (error) {
        console.error('Error fetching permission profile:', error);
        return null;
      }

      if (!data || data.length === 0) return null;

      const row = data[0];
      // Parse permissions from JSONB - handle both string and object formats
      let parsedPermissions: Record<string, ModulePermission> = {};
      if (row.permissions) {
        if (typeof row.permissions === 'string') {
          try {
            parsedPermissions = JSON.parse(row.permissions);
          } catch {
            parsedPermissions = {};
          }
        } else {
          parsedPermissions = row.permissions as unknown as Record<string, ModulePermission>;
        }
      }

      return {
        profile_id: row.profile_id,
        profile_name: row.profile_name,
        profile_type: row.profile_type as PermissionProfileType,
        permissions: parsedPermissions as Record<Module, ModulePermission>,
        hide_prices: row.hide_prices,
        hide_costs: row.hide_costs,
        can_operate_cash: row.can_operate_cash,
        can_approve_discounts: row.can_approve_discounts,
        can_cancel_sales: row.can_cancel_sales,
        can_manage_stock: row.can_manage_stock,
        can_view_reports: row.can_view_reports,
      } as PermissionProfile;
    },
    enabled: !!currentCompany?.id && !!user?.id,
  });

  // If no profile found but user is company admin, treat as admin
  const effectiveProfile: PermissionProfile | null = profile || (isCompanyAdmin ? {
    profile_id: '',
    profile_name: 'Administrador',
    profile_type: 'admin',
    permissions: {} as Record<Module, ModulePermission>,
    hide_prices: false,
    hide_costs: false,
    can_operate_cash: true,
    can_approve_discounts: true,
    can_cancel_sales: true,
    can_manage_stock: true,
    can_view_reports: true,
  } : null);

  const isAdmin = effectiveProfile?.profile_type === 'admin' || isCompanyAdmin;
  const isGerente = effectiveProfile?.profile_type === 'gerente';
  const isVendedor = effectiveProfile?.profile_type === 'vendedor';
  const isCaixa = effectiveProfile?.profile_type === 'caixa';
  const isAlmoxarifado = effectiveProfile?.profile_type === 'almoxarifado';
  const isProducao = effectiveProfile?.profile_type === 'producao';
  const isInstalador = effectiveProfile?.profile_type === 'instalador';
  const isFinanceiro = effectiveProfile?.profile_type === 'financeiro';

  const canAccess = (module: Module): boolean => {
    if (isAdmin) return true;
    const modulePerm = effectiveProfile?.permissions?.[module];
    return modulePerm?.view ?? false;
  };

  const canCreate = (module: Module): boolean => {
    if (isAdmin) return true;
    const modulePerm = effectiveProfile?.permissions?.[module];
    return modulePerm?.create ?? false;
  };

  const canEdit = (module: Module): boolean => {
    if (isAdmin) return true;
    const modulePerm = effectiveProfile?.permissions?.[module];
    return modulePerm?.edit ?? false;
  };

  const canDelete = (module: Module): boolean => {
    if (isAdmin) return true;
    const modulePerm = effectiveProfile?.permissions?.[module];
    return modulePerm?.delete ?? false;
  };

  // Special permission checks
  const canSeePrices = (): boolean => {
    if (isAdmin) return true;
    return !effectiveProfile?.hide_prices;
  };

  const canSeeCosts = (): boolean => {
    if (isAdmin) return true;
    return !effectiveProfile?.hide_costs;
  };

  const canOperateCash = (): boolean => {
    if (isAdmin) return true;
    return effectiveProfile?.can_operate_cash ?? false;
  };

  const canApproveDiscounts = (): boolean => {
    if (isAdmin) return true;
    return effectiveProfile?.can_approve_discounts ?? false;
  };

  const canCancelSales = (): boolean => {
    if (isAdmin) return true;
    return effectiveProfile?.can_cancel_sales ?? false;
  };

  const canManageStock = (): boolean => {
    if (isAdmin) return true;
    return effectiveProfile?.can_manage_stock ?? false;
  };

  const canViewReports = (): boolean => {
    if (isAdmin) return true;
    return effectiveProfile?.can_view_reports ?? false;
  };

  return {
    profile: effectiveProfile,
    profileType: effectiveProfile?.profile_type || null,
    isLoading,
    // Role checks
    isAdmin,
    isGerente,
    isVendedor,
    isCaixa,
    isAlmoxarifado,
    isProducao,
    isInstalador,
    isFinanceiro,
    // Module permissions
    canAccess,
    canCreate,
    canEdit,
    canDelete,
    // Special permissions
    canSeePrices,
    canSeeCosts,
    canOperateCash,
    canApproveDiscounts,
    canCancelSales,
    canManageStock,
    canViewReports,
  };
}
