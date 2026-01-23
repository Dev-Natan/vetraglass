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
      // Fetch companies count
      const { count: companiesCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true });

      // Fetch item templates count
      const { count: itemTemplatesCount } = await supabase
        .from("item_templates")
        .select("*", { count: "exact", head: true });

      // Fetch active item templates count
      const { count: activeItemTemplatesCount } = await supabase
        .from("item_templates")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Fetch product templates count
      const { count: productTemplatesCount } = await supabase
        .from("product_templates")
        .select("*", { count: "exact", head: true });

      // Fetch product linhas count
      const { count: productLinhasCount } = await supabase
        .from("product_linhas")
        .select("*", { count: "exact", head: true });

      // Fetch categories count
      const { count: categoriesCount } = await supabase
        .from("product_categories")
        .select("*", { count: "exact", head: true });

      // Fetch open support tickets
      const { count: openTicketsCount } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress", "waiting"]);

      // Fetch profiles count (users)
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      return {
        companiesCount: companiesCount || 0,
        activeCompaniesCount: companiesCount || 0, // All companies are considered active for now
        itemTemplatesCount: itemTemplatesCount || 0,
        productTemplatesCount: productTemplatesCount || 0,
        productLinhasCount: productLinhasCount || 0,
        categoriesCount: categoriesCount || 0,
        openTicketsCount: openTicketsCount || 0,
        usersCount: usersCount || 0,
      };
    },
    enabled: isSaasAdmin,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
