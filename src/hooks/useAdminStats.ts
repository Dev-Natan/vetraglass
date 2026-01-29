import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminStats {
  companiesCount: number;
  activeCompaniesCount: number;
  itemTemplatesCount: number;
  productTemplatesCount: number;
  productLinhasCount: number;
  categoriesCount: number;
  openTicketsCount: number;
  usersCount: number;
}

export function useAdminStats() {
  const { isSaasAdmin } = useAuth();

  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      // Execute all queries in parallel for better performance
      const [
        companiesResult,
        itemTemplatesResult,
        productTemplatesResult,
        productLinhasResult,
        categoriesResult,
        ticketsResult,
        usersResult,
      ] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }),
        supabase.from("item_templates").select("*", { count: "exact", head: true }),
        supabase.from("product_templates").select("*", { count: "exact", head: true }),
        supabase.from("product_linhas").select("*", { count: "exact", head: true }),
        supabase.from("product_categories").select("*", { count: "exact", head: true }),
        supabase.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting"]),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);

      return {
        companiesCount: companiesResult.count || 0,
        activeCompaniesCount: companiesResult.count || 0,
        itemTemplatesCount: itemTemplatesResult.count || 0,
        productTemplatesCount: productTemplatesResult.count || 0,
        productLinhasCount: productLinhasResult.count || 0,
        categoriesCount: categoriesResult.count || 0,
        openTicketsCount: ticketsResult.count || 0,
        usersCount: usersResult.count || 0,
      };
    },
    enabled: isSaasAdmin,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
