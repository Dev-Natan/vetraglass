import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductAluminumPrice {
  id: string;
  company_product_id: string;
  color_name: string;
  price_per_sqm: number;
  cost_per_sqm: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TABLE = 'product_aluminum_prices' as any;

export function useProductAluminumPrices(companyProductId: string | null) {
  const queryClient = useQueryClient();

  const { data: aluminumPrices = [], isLoading } = useQuery({
    queryKey: ['product-aluminum-prices', companyProductId],
    queryFn: async () => {
      if (!companyProductId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('company_product_id', companyProductId)
        .order('color_name');
      if (error) throw error;
      return data as unknown as ProductAluminumPrice[];
    },
    enabled: !!companyProductId,
  });

  const addPrice = useMutation({
    mutationFn: async (input: { company_product_id: string; color_name: string; price_per_sqm: number; cost_per_sqm: number }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(input)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') throw new Error('Já existe um preço para esta cor');
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-aluminum-prices', companyProductId] });
      toast.success('Preço de acabamento adicionado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductAluminumPrice> & { id: string }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-aluminum-prices', companyProductId] });
      toast.success('Preço atualizado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePrice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-aluminum-prices', companyProductId] });
      toast.success('Preço removido');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { aluminumPrices, isLoading, addPrice, updatePrice, deletePrice };
}

export function useProductAluminumPriceOptions(companyProductId: string | null) {
  return useQuery({
    queryKey: ['product-aluminum-price-options', companyProductId],
    queryFn: async () => {
      if (!companyProductId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('company_product_id', companyProductId)
        .eq('is_active', true)
        .order('color_name');
      if (error) throw error;
      return (data as unknown as ProductAluminumPrice[]).map(p => ({
        value: p.id,
        label: p.color_name,
        colorName: p.color_name,
        pricePerSqm: p.price_per_sqm,
        costPerSqm: p.cost_per_sqm,
      }));
    },
    enabled: !!companyProductId,
  });
}
