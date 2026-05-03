import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/usePermissions";
import { toast } from "sonner";

export interface CompanyMember {
  user_company_id: string;
  company_id: string;
  user_id: string;
  role: AppRole;
  is_active: boolean;
  joined_at: string;
  profile_name: string | null;
  avatar_url: string | null;
  employee_id: string | null;
  employee_name: string | null;
  employee_email: string | null;
  employee_phone: string | null;
  employee_photo_url: string | null;
  employee_specialty: string | null;
  permission_profile_id: string | null;
}

export function useCompanyMembers(companyId?: string) {
  return useQuery({
    queryKey: ["company-members", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      // Fallback if view does not yet exist: join manually
      const { data, error } = await (supabase as any)
        .from("company_members_view")
        .select("*")
        .eq("company_id", companyId)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CompanyMember[];
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useChangeMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { companyId: string; userId: string; role: AppRole }) => {
      const { data, error } = await (supabase as any).rpc("change_company_member_role", {
        _company_id: vars.companyId,
        _target_user_id: vars.userId,
        _new_role: vars.role,
      });
      if (error) throw error;
      const r = data as any;
      if (r && r.success === false) throw new Error(translateError(r.error));
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-members"] });
      qc.invalidateQueries({ queryKey: ["employees-with-roles"] });
      toast.success("Cargo atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeactivateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { companyId: string; userId: string }) => {
      const { data, error } = await (supabase as any).rpc("deactivate_company_member", {
        _company_id: vars.companyId,
        _target_user_id: vars.userId,
      });
      if (error) throw error;
      const r = data as any;
      if (r && r.success === false) throw new Error(translateError(r.error));
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-members"] });
      toast.success("Acesso revogado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useReactivateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { companyId: string; userId: string }) => {
      const { data, error } = await (supabase as any).rpc("reactivate_company_member", {
        _company_id: vars.companyId,
        _target_user_id: vars.userId,
      });
      if (error) throw error;
      const r = data as any;
      if (r && r.success === false) throw new Error(translateError(r.error));
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-members"] });
      toast.success("Acesso reativado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { companyId: string; newAdminUserId: string }) => {
      const { data, error } = await (supabase as any).rpc("transfer_company_ownership", {
        _company_id: vars.companyId,
        _new_admin_user_id: vars.newAdminUserId,
      });
      if (error) throw error;
      const r = data as any;
      if (r && r.success === false) throw new Error(translateError(r.error));
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-members"] });
      toast.success("Titularidade transferida");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMemberAuditLog(companyId?: string) {
  return useQuery({
    queryKey: ["company-member-audit", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("company_member_audit")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}

function translateError(code: string): string {
  switch (code) {
    case "unauthenticated":
      return "Sessão expirada. Faça login novamente.";
    case "forbidden":
      return "Você não tem permissão para esta ação.";
    case "not_a_member":
      return "Usuário não pertence a esta empresa.";
    case "last_admin":
      return "Não é possível remover o último administrador. Promova outro usuário a administrador antes.";
    case "target_not_active_member":
      return "Usuário alvo não está ativo na empresa.";
    default:
      return code || "Erro desconhecido";
  }
}
