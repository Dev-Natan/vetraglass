import { useState } from 'react';
import type { QuoteItem } from '../types';

export function useQuoteItems() {
  const [items, setItems] = useState<QuoteItem[]>([]);

  const addItem = (item: QuoteItem) => setItems(prev => [...prev, item]);
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof QuoteItem, value: unknown) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;

      const updated = { ...item, [field]: value } as QuoteItem;

      // Only auto-calculate prices for products or m2 items when dimensions/quantity/base_price/components change
      if (field === 'width' || field === 'height' || field === 'width_b' || field === 'height_b' || field === 'quantity' || field === 'base_price_m2' || field === 'unit_price' || field === 'components') {
        const isProduct = updated.item_type !== 'item';
        const isM2Item = updated.item_type === 'item' && updated.unit === 'm2';
        
        const width = field === 'width' ? (value as number) : updated.width || 0;
        const height = field === 'height' ? (value as number) : updated.height || 0;
        const isMultiSide = updated.width_b !== undefined;
        const widthB = field === 'width_b' ? (value as number) : updated.width_b || 0;
        const heightB = field === 'height_b' ? (value as number) : updated.height_b || 0;
        const quantity = field === 'quantity' ? (value as number) : updated.quantity || 1;
        
        let unitPrice = updated.unit_price;
        
        if (isProduct || isM2Item) {
          const basePriceM2 = field === 'base_price_m2' ? (value as number) : updated.base_price_m2 || 0;
          const areaM2 = ((width + (isMultiSide ? widthB : 0)) / 1000) * (height / 1000);
          unitPrice = areaM2 * basePriceM2;
        } else if (field === 'unit_price') {
          unitPrice = value as number;
        }

        const componentsTotal = updated.components?.reduce((sum, c) => sum + (c.unit_price * c.quantity), 0) || 0;
        const totalPrice = (unitPrice * quantity) + componentsTotal;

        return {
          ...updated,
          width,
          height,
          // Preserve undefined for single-side products so Lado B fields don't appear
          ...(isMultiSide ? { width_b: widthB, height_b: heightB } : {}),
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
        };
      }

      return updated;
    }));
  };

  return { items, setItems, addItem, removeItem, updateItem };
}
