import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProductLinhas, type ProductLinha } from '@/hooks/useProductLinhas';

/**
 * Returns the product linhas available to the current company.
 * If the company has explicitly enabled specific linhas (via ManageLinhasDialog),
 * only those are returned. Otherwise, all globally-active linhas are returned.
 *
 * This hook is the drop-in replacement for `useProductLinhas` in every
 * company-facing surface (stock, products, quotes, cutting plan, sales…).
 */
export function useCompanyLinhas() {
  const { currentCompany } = useAuth();
  const { data: allLinhas, ...rest } = useProductLinhas();

  const { data: enabledSlugs } = useQuery({
    queryKey: ['company-enabled-linhas', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [] as string[];
      const { data, error } = await supabase
        .from('company_enabled_linhas')
        .select('linha_slug')
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      return (data || []).map((r: any) => (r.linha_slug as string).toLowerCase());
    },
    enabled: !!currentCompany?.id,
  });

  const enabledSet = useMemo(() => new Set(enabledSlugs || []), [enabledSlugs]);

  const data = useMemo<ProductLinha[] | undefined>(() => {
    if (!allLinhas) return allLinhas;
    if (enabledSet.size === 0) return allLinhas;
    return allLinhas.filter(l => enabledSet.has(l.slug.toLowerCase()));
  }, [allLinhas, enabledSet]);

  return { ...rest, data };
}
