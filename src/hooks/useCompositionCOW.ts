import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

/**
 * Copy-on-write helpers for `product_template_items` overrides per company.
 *
 * - `saveItem(itemId, patch)` — se `itemId` é global (company_id NULL), cria uma
 *   cópia da empresa vinculada ao original via `parent_item_id`. Se já é cópia
 *   da empresa, atualiza in-place. Retorna o id efetivo (novo ou atualizado).
 * - `resetItem(itemId)` — deleta a cópia da empresa, o sistema volta ao global.
 */
export function useCompositionCOW(productTemplateId?: string) {
  const { currentCompany } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['product-template-items-cutting', productTemplateId] });
    qc.invalidateQueries({ queryKey: ['product-template-items', productTemplateId] });
    qc.invalidateQueries({ queryKey: ['product-templates'] });
    qc.invalidateQueries({ queryKey: ['effective-product-templates'] });
  };

  const saveItem = useMutation({
    mutationFn: async ({ itemId, patch }: { itemId: string; patch: Record<string, any> }) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      const { data, error } = await supabase.rpc('save_composition_item', {
        _item_id: itemId,
        _company_id: currentCompany.id,
        _patch: patch,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Alteração salva', description: 'A customização é exclusiva desta empresa.' });
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const resetItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc('reset_composition_item', { _item_id: itemId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Restaurado ao padrão de fábrica' });
    },
    onError: (e: any) => toast({ title: 'Erro ao restaurar', description: e.message, variant: 'destructive' }),
  });

  return { saveItem, resetItem };
}
