export interface StockItem {
  id: string;
  item_template_id: string | null;
  company_item_id: string | null;
  company_id: string;
  quantity: number;
  /** Reserva ativa derivada de stock_reservations; não é persistida em company_stock. */
  reserved_quantity: number;
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
    default_price: number | null;
    default_cost: number | null;
    default_sale_price: number | null;
    bar_length_mm: number | null;
    weight_per_meter: number | null;
    weight_per_bar: number | null;
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
