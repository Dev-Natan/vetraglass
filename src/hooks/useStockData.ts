import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface StockItem {
  id: string;
  item_template_id: string | null;
  company_item_id: string | null;
  company_id: string;
  quantity: number;
  min_quantity: number | null;
  location: string | null;
  is_active: boolean;
  allow_fractional: boolean;
  updated_at: string;
  item_template?: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
  } | null;
  company_item?: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
    is_custom: boolean;
    cost: number | null;
    sale_price: number | null;
    bar_length_mm: number | null;
    weight_per_meter: number | null;
    weight_kg: number | null;
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
        .select('id, item_template_id, company_item_id, company_id, quantity, min_quantity, location, is_active, allow_fractional, updated_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch company items (includes custom items)
  const companyItemsQuery = useQuery({
    queryKey: ['company-items', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('company_items')
        .select('id, name, type, unit, image_url, linha, is_custom, cost, sale_price, bar_length_mm, weight_per_meter, weight_kg')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 30000,
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

  // Combine and memoize stock items with templates, company items, and prices
  const stockItems = useMemo<StockItem[]>(() => {
    if (!stockQuery.data) return [];
    
    const templatesMap = new Map(templatesQuery.data?.map(t => [t.id, t]) || []);
    const companyItemsMap = new Map(companyItemsQuery.data?.map(ci => [ci.id, ci]) || []);
    const pricesMap = new Map(pricesQuery.data?.map(p => [p.item_template_id, p]) || []);
    
    return stockQuery.data.map((stock) => ({
      ...stock,
      item_template: stock.item_template_id ? templatesMap.get(stock.item_template_id) || null : null,
      company_item: stock.company_item_id ? companyItemsMap.get(stock.company_item_id) || null : null,
      priceInfo: stock.item_template_id ? pricesMap.get(stock.item_template_id) || null : null,
    }));
  }, [stockQuery.data, templatesQuery.data, companyItemsQuery.data, pricesQuery.data]);

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
    
    // Calculate total value (quantity × cost) - prefer company_item cost for custom items
    const totalValue = activeItems.reduce((acc, item) => {
      const cost = item.company_item?.cost || item.priceInfo?.cost || 0;
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
