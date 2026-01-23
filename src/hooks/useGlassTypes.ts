import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GlassType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function useGlassTypes() {
  return useQuery({
    queryKey: ['glass-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glass_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as GlassType[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllGlassTypes() {
  return useQuery({
    queryKey: ['glass-types', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glass_types')
        .select('*')
        .order('sort_order');
      
      if (error) throw error;
      return data as GlassType[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useGlassTypeLabels() {
  const { data: glassTypes } = useGlassTypes();
  
  const labels = glassTypes?.reduce((acc, type) => {
    acc[type.slug] = type.name;
    return acc;
  }, {} as Record<string, string>) ?? {};
  
  return labels;
}

export function useGlassTypeMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { slug: string; name: string; description?: string; sort_order?: number }) => {
      const { data: result, error } = await supabase
        .from('glass_types')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-types'] });
      toast.success('Tipo de vidro criado com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar tipo de vidro: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; sort_order?: number; is_active?: boolean }) => {
      const { data: result, error } = await supabase
        .from('glass_types')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-types'] });
      toast.success('Tipo de vidro atualizado');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('glass_types')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-types'] });
      toast.success('Tipo de vidro excluído');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
