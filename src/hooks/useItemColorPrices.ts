import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface ItemTemplateColorPrice {
  id?: string;
  item_template_id: string;
  color_name: string;
  cost_per_meter: number | null;
  price_per_meter: number | null;
}

export interface CompanyItemColorPrice extends ItemTemplateColorPrice {
  company_id: string;
}

/** Admin — sugerido por template (todos podem ler; só SaaS admin edita) */
export function useItemTemplateColorPrices(itemTemplateId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['item-template-color-prices', itemTemplateId ?? 'all'],
    queryFn: async () => {
      const q = sb.from('item_template_color_prices').select('*');
      if (itemTemplateId) q.eq('item_template_id', itemTemplateId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ItemTemplateColorPrice[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: ItemTemplateColorPrice) => {
      const { error } = await sb
        .from('item_template_color_prices')
        .upsert(row, { onConflict: 'item_template_id,color_name' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item-template-color-prices'] });
      qc.invalidateQueries({ queryKey: ['item-template-color-prices-cache'] });
      toast.success('Preço sugerido salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('item_template_color_prices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item-template-color-prices'] });
      qc.invalidateQueries({ queryKey: ['item-template-color-prices-cache'] });
      toast.success('Removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert, remove };
}

/** Empresa — override por template */
export function useCompanyItemColorPrices(itemTemplateId?: string) {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['company-item-color-prices', companyId, itemTemplateId ?? 'all'],
    queryFn: async () => {
      if (!companyId) return [] as CompanyItemColorPrice[];
      const q = sb.from('company_item_color_prices').select('*').eq('company_id', companyId);
      if (itemTemplateId) q.eq('item_template_id', itemTemplateId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CompanyItemColorPrice[];
    },
    enabled: !!companyId,
  });

  const upsert = useMutation({
    mutationFn: async (row: Omit<CompanyItemColorPrice, 'company_id' | 'id'>) => {
      if (!companyId) throw new Error('Sem empresa ativa');
      const payload = { ...row, company_id: companyId };
      const { error } = await sb
        .from('company_item_color_prices')
        .upsert(payload, { onConflict: 'company_id,item_template_id,color_name' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-item-color-prices'] });
      qc.invalidateQueries({ queryKey: ['company-item-color-prices-cache'] });
      toast.success('Preço salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert };
}

/** Cache global (usado pelo motor de precificação) */
export function useAllItemTemplateColorPrices() {
  return useQuery({
    queryKey: ['item-template-color-prices-cache'],
    queryFn: async () => {
      const { data, error } = await sb.from('item_template_color_prices').select('*');
      if (error) throw error;
      return (data ?? []) as ItemTemplateColorPrice[];
    },
    staleTime: 60_000,
  });
}

export function useAllCompanyItemColorPrices() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  return useQuery({
    queryKey: ['company-item-color-prices-cache', companyId],
    queryFn: async () => {
      if (!companyId) return [] as CompanyItemColorPrice[];
      const { data, error } = await sb
        .from('company_item_color_prices')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as CompanyItemColorPrice[];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

/** Lista os item_templates do tipo perfil de uma empresa (para "Meus Preços") */
export function useProfileTemplates() {
  return useQuery({
    queryKey: ['profile-item-templates'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('item_templates')
        .select('id, name, linha, is_active')
        .eq('type', 'profile')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; linha: string | null; is_active: boolean }>;
    },
    staleTime: 60_000,
  });
}

/** Retorna as cores disponíveis (union admin + empresa) para uma lista de templates */
export function useAvailableColorsForTemplates(templateIds: string[]) {
  return useQuery({
    queryKey: ['available-colors-for-templates', [...templateIds].sort()],
    queryFn: async () => {
      if (!templateIds.length) return [] as string[];
      const [adminRes, companyRes] = await Promise.all([
        sb.from('item_template_color_prices').select('color_name').in('item_template_id', templateIds),
        sb.from('company_item_color_prices').select('color_name').in('item_template_id', templateIds),
      ]);
      const set = new Set<string>();
      (adminRes.data ?? []).forEach((r: { color_name: string }) => set.add(r.color_name));
      (companyRes.data ?? []).forEach((r: { color_name: string }) => set.add(r.color_name));
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
    enabled: templateIds.length > 0,
    staleTime: 60_000,
  });
}
