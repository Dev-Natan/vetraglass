export interface ApprovalQuote {
  id: string;
  client_id?: string | null;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  total_amount: number;
  discount_percent?: number | null;
  discount_amount?: number | null;
  final_amount: number;
  created_at?: string;
}

export interface ApprovalQuoteItem {
  id: string;
  description: string;
  width: number | null;
  width_b?: number | null;
  width_c?: number | null;
  height: number | null;
  height_b?: number | null;
  height_c?: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  company_product_id?: string | null;
  product_template_id?: string | null;
  glass_thickness?: string | null;
  glass_color?: string | null;
  has_glass?: boolean | null;
  include_contramarco?: boolean | null;
}

export interface AprovarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: ApprovalQuote | null;
  items: ApprovalQuoteItem[];
  onSuccess?: () => void;
}

export type ApprovalStep = 'payment' | 'confirm';
export type EntryPaymentMethod = 'dinheiro' | 'cartao' | 'pix';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface ApprovalFormState {
  selectedFormaId: string | null;
  selectedCondicaoId: string | null;
  entryAmount: string;
  entryPaymentMethod: EntryPaymentMethod;
  cardActualReceived: string;
  balanceDueDate: Date | undefined;
  receiveOnCompletion: boolean;
  estimatedEnd: Date | undefined;
  priority: Priority;
  notes: string;
}
