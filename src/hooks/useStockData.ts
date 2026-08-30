import { useQuery } from '@tanstack/react-query';
import { estoqueService } from '@/services/estoqueService';
import type { StockItem } from '@/types/estoque';
import { useMemo } from 'react';

// Type moved to @/types/estoque


interface UseStockDataOptions {
  companyId: string | undefined;
}

interface StockDataResult {
  stockItems: StockItem[];
  lowStockItems: StockItem[];
  activeItems: StockItem[];
  inactiveItems: StockItem[];
  itemTemplates: Array<{
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
    category_id: string | null;
    line_id: string | null;
    default_price: number | null;
    default_cost: number | null;
    default_sale_price: number | null;
    bar_length_mm: number | null;
    weight_per_meter: number | null;
    weight_per_bar: number | null;
  }>;
  itemPrices: Array<{
    id: string;
    item_template_id: string;
    cost: number | null;
    price: number;
  }>;
  isLoading: boolean;
  error: Error | null;
  // KPI data
  kpis: {
    totalItems: number;
    totalValue: number;
    unknownValuationCount: number;
    lowStockCount: number;
    zeroStockCount: number;
  };
}

export function useStockData({ companyId }: UseStockDataOptions): StockDataResult {
  // Parallel queries using Promise.all pattern via React Query
  const stockQuery = useQuery({
    queryKey: ['company-stock', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      await estoqueService.ensureCompanyCatalog(companyId);
      return estoqueService.fetchStockItems(companyId);
    },

    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch company items (includes custom items)
  const companyItemsQuery = useQuery({
    queryKey: ['company-items', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return estoqueService.fetchCompanyItems(companyId);
    },

    enabled: !!companyId,
    staleTime: 30000,
  });

  const templatesQuery = useQuery({
    queryKey: ['item-templates-stock'],
    queryFn: async () => {
      return estoqueService.fetchItemTemplates();
    },

    staleTime: 60000, // 1 minute (templates change less frequently)
  });

  const pricesQuery = useQuery({
    queryKey: ['company-item-prices', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return estoqueService.fetchItemPrices(companyId);
    },

    enabled: !!companyId,
    staleTime: 30000,
  });

  // Combine and memoize stock items with templates, company items, and prices
  const stockItems = useMemo<StockItem[]>(() => {
    if (!templatesQuery.data) return [];
    
    const templatesMap = new Map(templatesQuery.data.map(t => [t.id, t]));
    const companyItemsMap = new Map(companyItemsQuery.data?.map(ci => [ci.id, ci]) || []);
    const pricesMap = new Map(pricesQuery.data?.map(p => [p.item_template_id, p]) || []);
    
    // Map existing stock items
    const existingStockItems = (stockQuery.data || []).map((stock) => ({
      ...stock,
      item_template: stock.item_template_id ? templatesMap.get(stock.item_template_id) || null : null,
      company_item: stock.company_item_id ? companyItemsMap.get(stock.company_item_id) || null : null,
      priceInfo: stock.item_template_id ? pricesMap.get(stock.item_template_id) || null : null,
    }));

    const existingCompanyItemIds = new Set(existingStockItems.map(s => s.company_item_id).filter(Boolean));

    // Every tenant item is operational even before its first physical movement.
    const virtualItems = (companyItemsQuery.data || [])
      .filter(item => !existingCompanyItemIds.has(item.id))
      .map(item => ({
        id: `virtual-${item.id}`,
        item_template_id: item.item_template_id,
        company_item_id: item.id,
        company_id: companyId || '',
        quantity: 0,
        canonical_quantity: 0,
        package_quantity: 0,
        reserved_quantity: 0,
        min_quantity: 0,
        location: null,
        is_active: item.is_active,
        allow_fractional: item.type === 'profile',
        updated_at: new Date().toISOString(),
        item_template: item.item_template_id ? templatesMap.get(item.item_template_id) || null : null,
        company_item: item,
        priceInfo: null,
      } as StockItem));

    return [...existingStockItems, ...virtualItems];
  }, [stockQuery.data, templatesQuery.data, companyItemsQuery.data, pricesQuery.data, companyId]);

  // Memoized filtered lists
  const activeItems = useMemo(
    () => stockItems.filter(i => i.is_active !== false),
    [stockItems]
  );

  const inactiveItems = useMemo(
    () => stockItems.filter(i => i.is_active === false),
    [stockItems]
  );

  const lowStockItems = useMemo(
    () => activeItems.filter(
      item => item.quantity <= (item.min_quantity || 0) && (item.min_quantity || 0) > 0
    ),
    [activeItems]
  );

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalItems = activeItems.length;
    
    // Physical valuation is intentionally independent from commercial pricing.
    const totalValue = activeItems.reduce((acc, item) => acc + Number(item.inventory_value || 0), 0);
    const unknownValuationCount = activeItems.filter(
      item => item.quantity > 0 && item.average_unit_cost == null
    ).length;
    
    const lowStockCount = lowStockItems.length;
    
    const zeroStockCount = activeItems.filter(item => item.quantity === 0).length;
    
    return {
      totalItems,
      totalValue,
      unknownValuationCount,
      lowStockCount,
      zeroStockCount,
    };
  }, [activeItems, lowStockItems]);

  const isLoading = stockQuery.isLoading || templatesQuery.isLoading || pricesQuery.isLoading || companyItemsQuery.isLoading;
  const error = stockQuery.error || templatesQuery.error || pricesQuery.error || companyItemsQuery.error;

  return {
    stockItems,
    lowStockItems,
    activeItems,
    inactiveItems,
    itemTemplates: templatesQuery.data || [],
    itemPrices: pricesQuery.data || [],
    isLoading,
    error: error as Error | null,
    kpis,
  };
}
