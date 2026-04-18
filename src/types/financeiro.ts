export interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  discount_percent: number | null;
  payment_method: string;
  payment_status: string;
  sale_type: string | null;
  created_at: string;
  notes: string | null;
  ordem_servico_id: string | null;
  quote_id: string | null;
}

export type PaymentFilter = 'all' | 'dinheiro' | 'cartao' | 'pix';
export type StatusFilter = 'all' | 'paid' | 'pending' | 'cancelled';
