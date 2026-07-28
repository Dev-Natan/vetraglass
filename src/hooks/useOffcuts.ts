import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OffcutKind = 'vidro' | 'perfil';
export type OffcutStatus = 'available' | 'reserved' | 'used' | 'discarded';
export type OffcutSource = 'manual' | 'plano_corte' | 'os' | 'ajuste';

export interface Offcut {
  id: string;
  company_id: string;
  item_template_id: string | null;
  company_item_id: string | null;
  kind: OffcutKind;
  name: string;
  color: string | null;
  thickness: number | null;
  width_mm: number | null;
  height_mm: number | null;
  length_mm: number | null;
  quantity: number;
  status: OffcutStatus;
  source: OffcutSource;
  source_os_id: string | null;
  source_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type OffcutInput = Omit<Offcut, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export function useOffcuts(companyId: string | null | undefined, filters?: { kind?: OffcutKind; status?: OffcutStatus }) {
  return useQuery({
    queryKey: ['offcuts', companyId, filters],
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      let q = supabase.from('stock_offcuts').select('*').eq('company_id', companyId!).order('created_at', { ascending: false });
      if (filters?.kind) q = q.eq('kind', filters.kind);
      if (filters?.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Offcut[];
    },
  });
}

export function useCreateOffcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OffcutInput> & { company_id: string; kind: OffcutKind; name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...input, created_by: user?.id ?? null };
      const { data, error } = await supabase.from('stock_offcuts').insert(payload).select().single();
      if (error) throw error;
      return data as Offcut;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offcuts'] });
      toast.success('Retalho cadastrado no banco');
    },
    onError: (e: any) => toast.error('Erro ao cadastrar retalho', { description: e.message }),
  });
}

export function useUpdateOffcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Offcut> }) => {
      const { data, error } = await supabase.from('stock_offcuts').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as Offcut;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offcuts'] });
      toast.success('Retalho atualizado');
    },
    onError: (e: any) => toast.error('Erro ao atualizar', { description: e.message }),
  });
}

export function useDeleteOffcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stock_offcuts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offcuts'] });
      toast.success('Retalho removido');
    },
    onError: (e: any) => toast.error('Erro ao remover', { description: e.message }),
  });
}

/** Helper para registrar retalhos automaticamente a partir do Plano de Corte. */
export async function registerOffcutsFromCuttingPlan(params: {
  companyId: string;
  entries: Array<{
    kind: OffcutKind;
    name: string;
    color?: string | null;
    thickness?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
    length_mm?: number | null;
    item_template_id?: string | null;
    source_reference?: string | null;
    source_os_id?: string | null;
  }>;
}) {
  if (!params.entries.length) return [];
  const { data: { user } } = await supabase.auth.getUser();
  const rows = params.entries.map((e) => ({
    company_id: params.companyId,
    kind: e.kind,
    name: e.name,
    color: e.color ?? null,
    thickness: e.thickness ?? null,
    width_mm: e.width_mm ?? null,
    height_mm: e.height_mm ?? null,
    length_mm: e.length_mm ?? null,
    item_template_id: e.item_template_id ?? null,
    source: 'plano_corte' as const,
    source_reference: e.source_reference ?? null,
    source_os_id: e.source_os_id ?? null,
    quantity: 1,
    status: 'available' as const,
    created_by: user?.id ?? null,
  }));
  const { data, error } = await supabase.from('stock_offcuts').insert(rows).select();
  if (error) throw error;
  return data;
}
