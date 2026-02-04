import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ProductGlassPrice {
  id: string;
  company_product_id: string;
  glass_type: string;
  glass_color: string;
  thickness_mm: number;
  price_per_sqm: number;
  cost_per_sqm: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductGlassPriceInput {
  company_product_id: string;
  glass_type: string;
  glass_color: string;
  thickness_mm: number;
  price_per_sqm: number;
  cost_per_sqm: number;
}

// Legacy fallback - now using dynamic colors from glass_colors table
export const DEFAULT_GLASS_COLORS = ['Incolor', 'Verde', 'Fumê', 'Bronze', 'Prata', 'Jateado', 'Preto', 'Branco'];

export function useProductGlassPrices(companyProductId: string | null) {
  const queryClient = useQueryClient();

  const { data: glassPrices = [], isLoading, refetch } = useQuery({
    queryKey: ['product-glass-prices', companyProductId],
    queryFn: async () => {
      if (!companyProductId) return [];
      
      const { data, error } = await supabase
        .from('product_glass_prices')
        .select('*')
        .eq('company_product_id', companyProductId)
        .order('glass_type')
        .order('thickness_mm');

      if (error) throw error;
      return data as ProductGlassPrice[];
    },
    enabled: !!companyProductId,
  });

  const addGlassPrice = useMutation({
    mutationFn: async (input: ProductGlassPriceInput) => {
      const { data, error } = await supabase
        .from('product_glass_prices')
        .insert(input)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um preço para esta combinação de tipo, cor e espessura');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-glass-prices', companyProductId] });
      toast({
        title: 'Sucesso',
        description: 'Preço de vidro adicionado',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateGlassPrice = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductGlassPrice> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_glass_prices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um preço para esta combinação de tipo, cor e espessura');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-glass-prices', companyProductId] });
      toast({
        title: 'Sucesso',
        description: 'Preço atualizado',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteGlassPrice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_glass_prices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-glass-prices', companyProductId] });
      toast({
        title: 'Sucesso',
        description: 'Preço removido',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Função para buscar preço específico para orçamento
  const getGlassPrice = (glassType: string, glassColor: string, thicknessMm: number) => {
    return glassPrices.find(
      (p) => p.glass_type === glassType && p.glass_color === glassColor && p.thickness_mm === thicknessMm && p.is_active
    );
  };

  // Opções únicas para dropdowns
  const glassTypeOptions = [...new Set(glassPrices.map((p) => p.glass_type))];
  const glassColorOptions = [...new Set(glassPrices.map((p) => p.glass_color))];
  const thicknessOptions = [...new Set(glassPrices.map((p) => p.thickness_mm))].sort((a, b) => a - b);

  return {
    glassPrices,
    isLoading,
    refetch,
    addGlassPrice,
    updateGlassPrice,
    deleteGlassPrice,
    getGlassPrice,
    glassTypeOptions,
    glassColorOptions,
    thicknessOptions,
  };
}

// Hook para buscar preços de vidro de um produto específico (para uso em orçamentos)
export function useProductGlassPriceOptions(companyProductId: string | null) {
  return useQuery({
    queryKey: ['product-glass-price-options', companyProductId],
    queryFn: async () => {
      if (!companyProductId) return [];
      
      const { data, error } = await supabase
        .from('product_glass_prices')
        .select('*')
        .eq('company_product_id', companyProductId)
        .eq('is_active', true)
        .order('glass_type')
        .order('glass_color')
        .order('thickness_mm');

      if (error) throw error;
      
      // Retorna opções formatadas para dropdown
      return (data as ProductGlassPrice[]).map((p) => ({
        value: p.id,
        label: `${p.glass_type} ${p.glass_color} ${p.thickness_mm}mm`,
        glassType: p.glass_type,
        glassColor: p.glass_color,
        thicknessMm: p.thickness_mm,
        pricePerSqm: p.price_per_sqm,
        costPerSqm: p.cost_per_sqm,
      }));
    },
    enabled: !!companyProductId,
  });
}
