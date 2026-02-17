import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


export interface ProductLinha {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function useProductLinhas(includeInactive = false) {
  return useQuery({
    queryKey: ["product-linhas", includeInactive],
    queryFn: async () => {
      let query = supabase
        .from("product_linhas")
        .select("id, slug, name, description, image_url, color, sort_order, is_active")
        .order("sort_order");
      
      if (!includeInactive) {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProductLinha[];
    },
    // Zero cache - sempre dados frescos
  });
}

export function useProductLinhaLabels() {
  const { data: linhas } = useProductLinhas();
  
  const labels = linhas?.reduce((acc, linha) => {
    acc[linha.slug] = linha.name;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  const colors = linhas?.reduce((acc, linha) => {
    acc[linha.slug] = linha.color;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  return { labels, colors, linhas };
}

export function useProductLinhaMutations() {
  const queryClient = useQueryClient();
  
  const createMutation = useMutation({
    mutationFn: async (linha: Omit<ProductLinha, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("product_linhas")
        .insert(linha)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-linhas"] });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductLinha> & { id: string }) => {
      const { data, error } = await supabase
        .from("product_linhas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-linhas"] });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_linhas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-linhas"] });
    },
  });
  
  return { createMutation, updateMutation, deleteMutation };
}
