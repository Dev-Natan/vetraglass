import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function useProductCategories(includeInactive = false) {
  return useQuery({
    queryKey: ["product-categories", includeInactive],
    queryFn: async () => {
      let query = supabase
        .from("product_categories")
        .select("*")
        .order("sort_order");
      
      if (!includeInactive) {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProductCategory[];
    },
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
  });
}

export function useProductCategoryLabels() {
  const { data: categories } = useProductCategories();
  
  const labels = categories?.reduce((acc, cat) => {
    acc[cat.slug] = cat.name;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  const colors = categories?.reduce((acc, cat) => {
    acc[cat.slug] = cat.color;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  return { labels, colors, categories };
}

export function useProductCategoryMutations() {
  const queryClient = useQueryClient();
  
  const createMutation = useMutation({
    mutationFn: async (category: Omit<ProductCategory, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("product_categories")
        .insert(category)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from("product_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    },
  });
  
  return { createMutation, updateMutation, deleteMutation };
}
