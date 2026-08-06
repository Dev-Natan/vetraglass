import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type PriceLineUnit = 'm2' | 'un' | 'par' | 'ml' | 'kg';

export interface ProductPriceLine {
  id: string;
  company_id: string;
  company_product_id: string;
  description: string;
  glass_type: string | null;
  thickness_mm: number | null;
  color: string | null;
  price: number;
  cost: number | null;
  unit: PriceLineUnit | string;
  sort_order: number;
  is_active: boolean;
}

export type ProductPriceLineInput = Omit<ProductPriceLine, 'id' | 'company_id' | 'company_product_id'> & {
  id?: string;
};

export const PRICE_LINE_UNITS: { value: PriceLineUnit; label: string }[] = [
  { value: 'm2', label: 'm²' },
  { value: 'un', label: 'Unidade' },
  { value: 'par', label: 'Par' },
  { value: 'ml', label: 'Metro linear' },
  { value: 'kg', label: 'Quilo' },
];

export const formatUnitLabel = (unit: string) =>
  PRICE_LINE_UNITS.find(u => u.value === unit)?.label ?? unit;

/** Lista as linhas de preço (variações) de um produto da empresa. */
export function useProductPriceLines(companyProductId?: string | null, onlyActive = false) {
  return useQuery({
    queryKey: ['product-price-lines', companyProductId, onlyActive],
    queryFn: async () => {
      if (!companyProductId) return [] as ProductPriceLine[];
      let query = sb
        .from('company_product_price_lines')
        .select('*')
        .eq('company_product_id', companyProductId)
        .order('sort_order')
        .order('created_at');
      if (onlyActive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ProductPriceLine[];
    },
    enabled: !!companyProductId,
    staleTime: 0,
  });
}

/** Contagem de variações por produto — usado na listagem de "Meus Preços". */
export function usePriceLineCounts(companyId?: string | null) {
  return useQuery({
    queryKey: ['product-price-line-counts', companyId],
    queryFn: async () => {
      if (!companyId) return {} as Record<string, number>;
      const { data, error } = await sb
        .from('company_product_price_lines')
        .select('company_product_id')
        .eq('company_id', companyId)
        .eq('is_active', true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).forEach((r: any) => {
        counts[r.company_product_id] = (counts[r.company_product_id] ?? 0) + 1;
      });
      return counts;
    },
    enabled: !!companyId,
    staleTime: 0,
  });
}

export function usePriceLineMutations(companyId?: string | null, companyProductId?: string | null) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['product-price-lines'] });
    queryClient.invalidateQueries({ queryKey: ['product-price-line-counts'] });
  };

  const save = useMutation({
    mutationFn: async (line: ProductPriceLineInput) => {
      if (!companyId || !companyProductId) throw new Error('Empresa ou produto não informado.');
      if (!line.description?.trim()) throw new Error('Informe a descrição da variação.');

      const payload = {
        company_id: companyId,
        company_product_id: companyProductId,
        description: line.description.trim(),
        glass_type: line.glass_type?.trim() || null,
        thickness_mm: line.thickness_mm != null && !Number.isNaN(line.thickness_mm) ? line.thickness_mm : null,
        color: line.color?.trim() || null,
        price: Number(line.price) || 0,
        cost: line.cost != null && !Number.isNaN(line.cost) ? Number(line.cost) : null,
        unit: line.unit || 'm2',
        sort_order: line.sort_order ?? 0,
        is_active: line.is_active ?? true,
      };

      if (line.id) {
        const { error } = await sb.from('company_product_price_lines').update(payload).eq('id', line.id);
        if (error) throw error;
        return line.id;
      }
      const { data, error } = await sb
        .from('company_product_price_lines')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Variação salva.');
    },
    onError: (e: Error) => toast.error('Erro ao salvar variação: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('company_product_price_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Variação removida.');
    },
    onError: (e: Error) => toast.error('Erro ao remover: ' + e.message),
  });

  return { save, remove };
}
