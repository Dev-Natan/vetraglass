import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface GlassThickness {
  id: string;
  company_id: string;
  thickness: string;
  thickness_mm: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GlassColor {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  hex_color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GlassPriceMatrix {
  id: string;
  company_id: string;
  glass_type_id: string;
  glass_color_id: string;
  glass_thickness_id: string;
  cost_per_sqm: number;
  price_per_sqm: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============ GLASS THICKNESSES ============

export function useGlassThicknesses() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['glass-thicknesses', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('glass_thicknesses')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('thickness_mm');
      
      if (error) throw error;
      return data as GlassThickness[];
    },
    enabled: !!currentCompany?.id,
  });
}

export function useAllGlassThicknesses() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['glass-thicknesses', currentCompany?.id, 'all'],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('glass_thicknesses')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('thickness_mm');
      
      if (error) throw error;
      return data as GlassThickness[];
    },
    enabled: !!currentCompany?.id,
  });
}

export function useGlassThicknessMutations() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { thickness: string; thickness_mm: number }) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { data: result, error } = await supabase
        .from('glass_thicknesses')
        .insert({
          company_id: currentCompany.id,
          thickness: data.thickness,
          thickness_mm: data.thickness_mm,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-thicknesses'] });
      toast.success('Espessura criada com sucesso');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Esta espessura já existe');
      } else {
        toast.error('Erro ao criar espessura: ' + error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; thickness?: string; thickness_mm?: number; is_active?: boolean }) => {
      const { data: result, error } = await supabase
        .from('glass_thicknesses')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-thicknesses'] });
      toast.success('Espessura atualizada');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('glass_thicknesses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-thicknesses'] });
      toast.success('Espessura excluída');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}

// ============ GLASS COLORS ============

export function useGlassColors() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['glass-colors', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('glass_colors')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as GlassColor[];
    },
    enabled: !!currentCompany?.id,
  });
}

export function useAllGlassColors() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['glass-colors', currentCompany?.id, 'all'],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('glass_colors')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('sort_order');
      
      if (error) throw error;
      return data as GlassColor[];
    },
    enabled: !!currentCompany?.id,
  });
}

export function useGlassColorMutations() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { slug: string; name: string; hex_color?: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { data: result, error } = await supabase
        .from('glass_colors')
        .insert({
          company_id: currentCompany.id,
          ...data,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-colors'] });
      toast.success('Cor criada com sucesso');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Esta cor já existe');
      } else {
        toast.error('Erro ao criar cor: ' + error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; hex_color?: string; is_active?: boolean }) => {
      const { data: result, error } = await supabase
        .from('glass_colors')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-colors'] });
      toast.success('Cor atualizada');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('glass_colors')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-colors'] });
      toast.success('Cor excluída');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  const initializeDefaultColors = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase.rpc('initialize_glass_options_for_company', {
        _company_id: currentCompany.id,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-colors'] });
      toast.success('Cores padrão inicializadas');
    },
    onError: (error: any) => {
      toast.error('Erro ao inicializar cores: ' + error.message);
    },
  });

  return { createMutation, updateMutation, deleteMutation, initializeDefaultColors };
}

// ============ GLASS PRICE MATRIX ============

export function useGlassPriceMatrix() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['glass-price-matrix', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('glass_price_matrix')
        .select('*')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return data as GlassPriceMatrix[];
    },
    enabled: !!currentCompany?.id,
  });
}

export function useGlassPriceMatrixMutations() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: async (data: {
      glass_type_id: string;
      glass_color_id: string;
      glass_thickness_id: string;
      cost_per_sqm: number;
      price_per_sqm: number;
    }) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { data: result, error } = await supabase
        .from('glass_price_matrix')
        .upsert({
          company_id: currentCompany.id,
          ...data,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id,glass_type_id,glass_color_id,glass_thickness_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-price-matrix'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar preço: ' + error.message);
    },
  });

  const bulkUpsertMutation = useMutation({
    mutationFn: async (prices: Array<{
      glass_type_id: string;
      glass_color_id: string;
      glass_thickness_id: string;
      cost_per_sqm: number;
      price_per_sqm: number;
    }>) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const dataWithCompany = prices.map(p => ({
        ...p,
        company_id: currentCompany.id,
        updated_at: new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from('glass_price_matrix')
        .upsert(dataWithCompany, {
          onConflict: 'company_id,glass_type_id,glass_color_id,glass_thickness_id',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glass-price-matrix'] });
      toast.success('Preços salvos com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar preços: ' + error.message);
    },
  });

  return { upsertMutation, bulkUpsertMutation };
}

// Utility function to get price for a specific glass configuration
export function useGlassPrice(glassTypeId?: string, glassColorId?: string, glassThicknessId?: string) {
  const { data: priceMatrix } = useGlassPriceMatrix();
  
  if (!glassTypeId || !glassColorId || !glassThicknessId || !priceMatrix) {
    return null;
  }
  
  return priceMatrix.find(
    p => p.glass_type_id === glassTypeId && 
         p.glass_color_id === glassColorId && 
         p.glass_thickness_id === glassThicknessId
  );
}
