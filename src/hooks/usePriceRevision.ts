import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuoteItemWithRevision {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  company_product_id: string | null;
  product_template_id: string | null;
  glass_thickness: string | null;
  glass_color: string | null;
  has_glass: boolean | null;
  // Price revision fields
  currentProductPrice: number | null;
  currentGlassPrice: number | null;
  currentTotalPricePerSqm: number | null;
  currentCalculatedTotal: number | null;
  priceDifference: number;
  percentDifference: number;
  needsRevision: boolean;
}

interface UsePriceRevisionProps {
  items: Array<{
    id: string;
    description: string;
    width: number | null;
    height: number | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    company_product_id?: string | null;
    product_template_id?: string | null;
    glass_thickness?: string | null;
    glass_color?: string | null;
    has_glass?: boolean | null;
  }>;
  companyId?: string;
}

export function usePriceRevision({ items, companyId }: UsePriceRevisionProps) {
  // Fetch current product prices
  const productIds = items
    .map(item => item.company_product_id)
    .filter((id): id is string => !!id);

  const { data: currentProducts } = useQuery({
    queryKey: ['current-product-prices', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('company_products')
        .select('id, price_per_sqm, base_price, commercial_name')
        .in('id', productIds);
      
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  // Fetch current glass prices
  const { data: currentGlassPrices } = useQuery({
    queryKey: ['current-glass-prices', productIds, companyId],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('product_glass_prices')
        .select('*')
        .in('company_product_id', productIds)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  // Calculate revised items
  const revisedItems = useMemo((): QuoteItemWithRevision[] => {
    return items.map(item => {
      const product = currentProducts?.find(p => p.id === item.company_product_id);
      const productPricePerSqm = Number(product?.price_per_sqm) || Number(product?.base_price) || 0;
      
      // Find matching glass price
      let glassPricePerSqm = 0;
      if (item.has_glass && item.glass_thickness && currentGlassPrices) {
        const glassPrice = currentGlassPrices.find(gp => 
          gp.company_product_id === item.company_product_id &&
          gp.thickness_mm === Number(item.glass_thickness?.replace('mm', '')) &&
          (gp.glass_color === item.glass_color || !item.glass_color)
        );
        glassPricePerSqm = glassPrice?.price_per_sqm || 0;
      }

      const currentTotalPricePerSqm = productPricePerSqm + glassPricePerSqm;
      
      // Calculate area and new total
      const width = item.width || 0;
      const height = item.height || 0;
      const areaSqm = (width * height) / 1000000; // Convert mm² to m²
      const currentCalculatedTotal = areaSqm * currentTotalPricePerSqm * item.quantity;
      
      const priceDifference = currentCalculatedTotal - item.total_price;
      const percentDifference = item.total_price > 0 
        ? ((priceDifference / item.total_price) * 100) 
        : 0;

      return {
        ...item,
        company_product_id: item.company_product_id || null,
        product_template_id: item.product_template_id || null,
        glass_thickness: item.glass_thickness || null,
        glass_color: item.glass_color || null,
        has_glass: item.has_glass || null,
        currentProductPrice: productPricePerSqm,
        currentGlassPrice: glassPricePerSqm,
        currentTotalPricePerSqm,
        currentCalculatedTotal,
        priceDifference,
        percentDifference,
        needsRevision: Math.abs(percentDifference) > 1, // More than 1% difference
      };
    });
  }, [items, currentProducts, currentGlassPrices]);

  const hasAnyPriceChanges = revisedItems.some(item => item.needsRevision);
  
  const totalOriginal = items.reduce((sum, item) => sum + item.total_price, 0);
  const totalWithCurrentPrices = revisedItems.reduce(
    (sum, item) => sum + (item.currentCalculatedTotal || item.total_price), 
    0
  );
  const totalDifference = totalWithCurrentPrices - totalOriginal;

  return {
    revisedItems,
    hasAnyPriceChanges,
    totalOriginal,
    totalWithCurrentPrices,
    totalDifference,
  };
}
