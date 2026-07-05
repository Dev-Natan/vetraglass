import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types (tables not yet in generated types.ts — cast supabase to any)
export interface AdminGlassColor {
  id: string;
  name: string;
  slug: string;
  hex_color: string | null;
  sort_order: number;
  is_active: boolean;
}
export interface AdminGlassThickness {
  id: string;
  thickness_mm: number;
  label: string;
  sort_order: number;
  is_active: boolean;
}
export interface AdminAluminumColor {
  id: string;
  name: string;
  slug: string;
  hex_color: string | null;
  sort_order: number;
  is_active: boolean;
}
export interface AdminSuggestedPrice {
  id: string;
  kind: 'glass' | 'aluminum';
  glass_color: string | null;
  thickness_mm: number | null;
  aluminum_color: string | null;
  cost_per_sqm: number | null;
  price_per_sqm: number | null;
  cost_per_meter: number | null;
  price_per_meter: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function makeListHook<T>(table: string, key: string, orderBy = 'sort_order') {
  return function useList() {
    const qc = useQueryClient();
    const query = useQuery({
      queryKey: [key],
      queryFn: async () => {
        const { data, error } = await sb.from(table).select('*').order(orderBy);
        if (error) throw error;
        return (data ?? []) as T[];
      },
    });
    const upsert = useMutation({
      mutationFn: async (input: Partial<T> & { id?: string }) => {
        if (input.id) {
          const { id, ...rest } = input;
          const { error } = await sb.from(table).update(rest).eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await sb.from(table).insert(input);
          if (error) throw error;
        }
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        toast.success('Salvo');
      },
      onError: (e: Error) => toast.error(e.message),
    });
    const remove = useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from(table).delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        toast.success('Removido');
      },
      onError: (e: Error) => toast.error(e.message),
    });
    return { ...query, upsert, remove };
  };
}

export const useAdminGlassColors = makeListHook<AdminGlassColor>('admin_glass_colors', 'admin-glass-colors');
export const useAdminGlassThicknesses = makeListHook<AdminGlassThickness>('admin_glass_thicknesses', 'admin-glass-thicknesses', 'thickness_mm');
export const useAdminAluminumColors = makeListHook<AdminAluminumColor>('admin_aluminum_colors', 'admin-aluminum-colors');

export function useAdminSuggestedPrices() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-suggested-prices'],
    queryFn: async () => {
      const { data, error } = await sb.from('admin_suggested_prices').select('*');
      if (error) throw error;
      return (data ?? []) as AdminSuggestedPrice[];
    },
  });
  const upsert = useMutation({
    mutationFn: async (input: Partial<AdminSuggestedPrice>) => {
      // upsert by unique keys
      if (input.kind === 'glass') {
        const { error } = await sb.from('admin_suggested_prices').upsert(input, {
          onConflict: 'glass_color,thickness_mm',
        });
        if (error) throw error;
      } else {
        const { error } = await sb.from('admin_suggested_prices').upsert(input, {
          onConflict: 'aluminum_color',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-suggested-prices'] });
      toast.success('Preço sugerido salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...query, upsert };
}
