import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GlassThickness {
  id: string;
  company_id: string;
  thickness_mm: number;
  thickness: string;
  sort_order: number;
  is_active: boolean;
}

export interface GlassColor {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  hex_color: string | null;
  sort_order: number;
  is_active: boolean;
}

export function useGlassThicknesses() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  
  return useQuery({
    queryKey: ['glass-thicknesses', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('glass_thicknesses')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('thickness_mm');
      
      if (error) throw error;
      return data as GlassThickness[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useGlassColors() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  
  return useQuery({
    queryKey: ['glass-colors', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('glass_colors')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as GlassColor[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}
