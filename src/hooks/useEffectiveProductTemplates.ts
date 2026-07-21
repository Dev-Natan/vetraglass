import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lista os modelos de produto efetivos para a empresa logada:
 * - versão customizada pela empresa quando existir (company_id = empresa)
 * - senão o template global (company_id NULL)
 *
 * Usa a RPC `list_effective_product_templates` (herança com override).
 */
export function useEffectiveProductTemplates() {
  const { currentCompany } = useAuth();

  return useQuery({
    queryKey: ['effective-product-templates', currentCompany?.id],
    enabled: !!currentCompany?.id,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_effective_product_templates', {
        _company_id: currentCompany!.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
