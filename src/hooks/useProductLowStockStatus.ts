import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns sets of product IDs (template / company) that have at least one
 * composition item with stock at or below the configured minimum (or zero).
 *
 * Used to show visual alerts on the catalog so the user knows that
 * selling/configuring that product may face a stock shortage.
 */
export function useProductLowStockStatus(companyId: string | undefined) {
  // 1) Stock rows for this company - identify low/zero stock items
  const stockQuery = useQuery({
    queryKey: ['low-stock-map', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_stock')
        .select('item_template_id, company_item_id, quantity, min_quantity')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });

  // 2) Template composition rows (global: company_id IS NULL)
  const templateCompQuery = useQuery({
    queryKey: ['template-composition-index'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_template_items')
        .select('product_template_id, item_template_id')
        .is('company_id', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    gcTime: 0,
  });

  // 3) Company-specific composition rows
  const companyCompQuery = useQuery({
    queryKey: ['company-composition-index', companyId],
    queryFn: async (): Promise<Array<{ company_product_id: string | null; item_template_id: string | null; company_item_id: string | null }>> => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from('company_product_items')
        .select('company_product_id, item_template_id, company_item_id')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });

  return useMemo(() => {
    const stockRows = stockQuery.data || [];

    const lowTemplateIds = new Set<string>();
    const lowCompanyItemIds = new Set<string>();
    const zeroTemplateIds = new Set<string>();
    const zeroCompanyItemIds = new Set<string>();

    for (const s of stockRows) {
      const qty = Number(s.quantity || 0);
      const min = Number(s.min_quantity || 0);
      const isZero = qty <= 0;
      const isLow = !isZero && min > 0 && qty <= min;
      if (!isZero && !isLow) continue;
      if (s.item_template_id) {
        if (isZero) zeroTemplateIds.add(s.item_template_id);
        else lowTemplateIds.add(s.item_template_id);
      }
      if (s.company_item_id) {
        if (isZero) zeroCompanyItemIds.add(s.company_item_id);
        else lowCompanyItemIds.add(s.company_item_id);
      }
    }

    // Build per-product alert level: 'zero' | 'low' | null
    const templateProductStatus = new Map<string, 'zero' | 'low'>();
    for (const row of templateCompQuery.data || []) {
      if (!row.product_template_id || !row.item_template_id) continue;
      const isZero = zeroTemplateIds.has(row.item_template_id);
      const isLow = lowTemplateIds.has(row.item_template_id);
      if (!isZero && !isLow) continue;
      const prev = templateProductStatus.get(row.product_template_id);
      if (isZero) templateProductStatus.set(row.product_template_id, 'zero');
      else if (!prev) templateProductStatus.set(row.product_template_id, 'low');
    }

    const companyProductStatus = new Map<string, 'zero' | 'low'>();
    for (const row of companyCompQuery.data || []) {
      if (!row.company_product_id) continue;
      const isZero =
        (row.item_template_id && zeroTemplateIds.has(row.item_template_id)) ||
        (row.company_item_id && zeroCompanyItemIds.has(row.company_item_id));
      const isLow =
        (row.item_template_id && lowTemplateIds.has(row.item_template_id)) ||
        (row.company_item_id && lowCompanyItemIds.has(row.company_item_id));
      if (!isZero && !isLow) continue;
      const prev = companyProductStatus.get(row.company_product_id);
      if (isZero) companyProductStatus.set(row.company_product_id, 'zero');
      else if (!prev) companyProductStatus.set(row.company_product_id, 'low');
    }

    return {
      isLoading:
        stockQuery.isLoading ||
        templateCompQuery.isLoading ||
        companyCompQuery.isLoading,
      templateProductStatus,
      companyProductStatus,
      /** Get the alert level for a product, considering both template and company composition. */
      getStatus: (
        productTemplateId?: string | null,
        companyProductId?: string | null,
      ): 'zero' | 'low' | null => {
        const a = companyProductId ? companyProductStatus.get(companyProductId) : undefined;
        const b = productTemplateId ? templateProductStatus.get(productTemplateId) : undefined;
        if (a === 'zero' || b === 'zero') return 'zero';
        if (a === 'low' || b === 'low') return 'low';
        return null;
      },
    };
  }, [stockQuery.data, templateCompQuery.data, companyCompQuery.data, stockQuery.isLoading, templateCompQuery.isLoading, companyCompQuery.isLoading]);
}
