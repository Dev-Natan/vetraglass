import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ProductStockSummary {
  minQuantity: number;   // menor saldo entre os perfis que compõem o produto
  totalProfiles: number; // perfis distintos na composição
  withStock: number;     // quantos têm saldo > 0
}

/**
 * Para um lote de produtos (companyProductIds), retorna um Map indicando
 * o pior saldo (mínimo) dos PERFIS que compõem cada produto. Usado no
 * catálogo de orçamentos para alertar o vendedor sobre falta de estoque.
 *
 * Uma única query pega:
 *   company_product_items → item_templates(id, type=profile)
 * outra pega company_stock por item_template_id.
 */
export function useProductsProfileStock(productIds: string[]) {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const ids = Array.from(new Set(productIds.filter(Boolean))).sort();

  return useQuery({
    queryKey: ['products-profile-stock', companyId, ids],
    queryFn: async () => {
      const result = new Map<string, ProductStockSummary>();
      if (!companyId || ids.length === 0) return result;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      // 1) composições: quais item_template_id (perfis) cada produto usa
      const { data: comps, error: e1 } = await sb
        .from('company_product_items')
        .select('company_product_id, item_template:item_templates(id, type)')
        .in('company_product_id', ids);
      if (e1) throw e1;

      const productToTemplates = new Map<string, Set<string>>();
      const allTemplateIds = new Set<string>();
      for (const row of comps ?? []) {
        const t = row.item_template;
        if (!t || t.type !== 'profile') continue;
        allTemplateIds.add(t.id);
        if (!productToTemplates.has(row.company_product_id))
          productToTemplates.set(row.company_product_id, new Set());
        productToTemplates.get(row.company_product_id)!.add(t.id);
      }

      // 2) estoque agrupado por template
      const stockByTemplate = new Map<string, number>();
      if (allTemplateIds.size > 0) {
        const { data: stock, error: e2 } = await sb
          .from('company_stock')
          .select('quantity, item_template_id')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .in('item_template_id', Array.from(allTemplateIds));
        if (e2) throw e2;
        for (const row of stock ?? []) {
          const prev = stockByTemplate.get(row.item_template_id) ?? 0;
          stockByTemplate.set(row.item_template_id, prev + Number(row.quantity ?? 0));
        }
      }

      // 3) compõe resultado por produto
      for (const pid of ids) {
        const tmpls = productToTemplates.get(pid);
        if (!tmpls || tmpls.size === 0) {
          result.set(pid, { minQuantity: 0, totalProfiles: 0, withStock: 0 });
          continue;
        }
        let min = Number.POSITIVE_INFINITY;
        let withStock = 0;
        for (const tid of tmpls) {
          const q = stockByTemplate.get(tid) ?? 0;
          if (q > 0) withStock++;
          if (q < min) min = q;
        }
        result.set(pid, {
          minQuantity: Number.isFinite(min) ? min : 0,
          totalProfiles: tmpls.size,
          withStock,
        });
      }

      return result;
    },
    enabled: !!companyId && ids.length > 0,
    staleTime: 30_000,
  });
}
