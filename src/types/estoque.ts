export interface StockItem {
  id: string;
  item_template_id: string | null;
  company_item_id: string | null;
  company_id: string;
  quantity: number;
  canonical_quantity?: number;
  canonical_unit?: 'MM' | 'MM2' | 'UNIT' | 'G' | null;
  package_quantity?: number;
  purchase_unit?: string | null;
  stock_unit?: string | null;
  consumption_unit?: string | null;
  purchase_to_canonical_factor?: number | null;
  consumption_to_canonical_factor?: number | null;
  nominal_length_mm?: number | null;
  average_unit_cost?: number | null;
  inventory_value?: number | null;
  unit_status?: 'CONFIGURED' | 'REVIEW_REQUIRED' | 'AMBIGUOUS' | null;
  location_count?: number;
  locations?: Array<{
    id: string;
    code: string;
    name: string;
    canonical_quantity: number;
    package_quantity: number;
    needs_review: boolean;
  }>;
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
    pricing_unit?: string | null;
    glass_color?: string | null;
    thickness_mm?: number | null;
  } | null;
  priceInfo?: {
    id: string;
    item_template_id: string;
    cost: number | null;
    price: number;
  } | null;
}
