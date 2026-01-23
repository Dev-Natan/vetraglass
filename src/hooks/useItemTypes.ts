import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ItemType {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  unit_default: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function useItemTypes(includeInactive = false) {
  return useQuery({
    queryKey: ["item-types", includeInactive],
    queryFn: async () => {
      let query = supabase
        .from("item_types")
        .select("*")
        .order("sort_order");
      
      if (!includeInactive) {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ItemType[];
    },
    staleTime: 1000 * 60 * 5, // Cache 5 minutes
  });
}

export function useItemTypeLabels() {
  const { data: itemTypes } = useItemTypes();
  
  const labels = itemTypes?.reduce((acc, type) => {
    acc[type.slug] = type.name;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  const colors = itemTypes?.reduce((acc, type) => {
    acc[type.slug] = type.color;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  const units = itemTypes?.reduce((acc, type) => {
    acc[type.slug] = type.unit_default;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  return { labels, colors, units, itemTypes };
}

export function useItemTypeMutations() {
  const queryClient = useQueryClient();
  
  const createMutation = useMutation({
    mutationFn: async (itemType: Omit<ItemType, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("item_types")
        .insert(itemType)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ItemType> & { id: string }) => {
      const { data, error } = await supabase
        .from("item_types")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("item_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
    },
  });
  
  return { createMutation, updateMutation, deleteMutation };
}
