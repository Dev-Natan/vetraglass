import type { QuoteItem } from './types';

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const computeTotals = (items: QuoteItem[], discountPercent: number) => {
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = totalAmount * (discountPercent / 100);
  const finalAmount = totalAmount - discountAmount;
  return { totalAmount, discountAmount, finalAmount };
};

export const mapItemForInsert = (item: QuoteItem, quoteId: string) => ({
  quote_id: quoteId,
  company_product_id: item.company_product_id || null,
  product_template_id: item.product_template_id || null,
  company_item_id: item.company_item_id || null,
  item_type: item.item_type || 'product',
  description: item.description,
  width: item.width || null,
  height: item.height || null,
  quantity: item.quantity,
  unit_price: item.unit_price,
  total_price: item.total_price,
  unit: item.unit || null,
  has_glass: item.has_glass ?? false,
  glass_color: item.glass_color || null,
  glass_thickness: item.glass_thickness || null,
  include_contramarco: item.include_contramarco ?? true,
  excluded_optional_ids: item.excluded_optional_ids || [],
  notes: item.notes || null,
});
