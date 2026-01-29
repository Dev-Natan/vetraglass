import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface StockItem {
  id: string;
  item_template_id: string;
  company_id: string;
  quantity: number;
  min_quantity: number | null;
  location: string | null;
  is_active: boolean;
  allow_fractional: boolean;
  item_template?: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
  } | null;
  priceInfo?: {
    id: string;
    item_template_id: string;
    cost: number | null;
    price: number;
  } | null;
}

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
      
      const { data, error } = await supabase
        .from('company_stock')
        .select('id, item_template_id, company_id, quantity, min_quantity, location, is_active, allow_fractional')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });

  const templatesQuery = useQuery({
    queryKey: ['item-templates-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, name, type, unit, image_url, linha')
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    staleTime: 60000, // 1 minute (templates change less frequently)
  });

  const pricesQuery = useQuery({
    queryKey: ['company-item-prices', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('company_item_prices')
        .select('id, item_template_id, cost, price')
        .eq('company_id', companyId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 30000,
  });

  // Combine and memoize stock items with templates and prices
  const stockItems = useMemo<StockItem[]>(() => {
    if (!stockQuery.data || !templatesQuery.data) return [];
    
    const templatesMap = new Map(templatesQuery.data.map(t => [t.id, t]));
    const pricesMap = new Map(pricesQuery.data?.map(p => [p.item_template_id, p]) || []);
    
    return stockQuery.data.map((stock) => ({
      ...stock,
      item_template: templatesMap.get(stock.item_template_id) || null,
      priceInfo: pricesMap.get(stock.item_template_id) || null,
    }));
  }, [stockQuery.data, templatesQuery.data, pricesQuery.data]);

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
    
    // Calculate total value (quantity × cost)
    const totalValue = activeItems.reduce((acc, item) => {
      const cost = item.priceInfo?.cost || 0;
      return acc + (item.quantity * cost);
    }, 0);
    
    const lowStockCount = lowStockItems.length;
    
    const zeroStockCount = activeItems.filter(item => item.quantity === 0).length;
    
    return {
      totalItems,
      totalValue,
      lowStockCount,
      zeroStockCount,
    };
  }, [activeItems, lowStockItems]);

  const isLoading = stockQuery.isLoading || templatesQuery.isLoading || pricesQuery.isLoading;
  const error = stockQuery.error || templatesQuery.error || pricesQuery.error;

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
