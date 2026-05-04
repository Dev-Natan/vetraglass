import { z } from 'zod';

export const quoteSchema = z.object({
  customer_name: z.string().min(2, 'Nome do cliente é obrigatório (mínimo 2 caracteres)').max(100, 'Nome deve ter no máximo 100 caracteres'),
  customer_phone: z.string().optional().refine(val => {
    if (!val) return true;
    return val.replace(/\D/g, '').length >= 10;
  }, { message: 'Telefone deve ter pelo menos 10 dígitos' }),
  customer_email: z.string().email('Formato de e-mail inválido (ex: nome@email.com)').optional().or(z.literal('')),
  customer_address: z.string().max(200, 'Endereço deve ter no máximo 200 caracteres').optional(),
  customer_document: z.string().optional(),
  customer_document_type: z.string().optional(),
  customer_profession: z.string().max(100, 'Profissão deve ter no máximo 100 caracteres').optional(),
  customer_marital_status: z.string().optional(),
  payment_terms: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().max(1000, 'Observações devem ter no máximo 1000 caracteres').optional(),
});

export type QuoteFormData = z.infer<typeof quoteSchema>;

export interface QuoteItem {
  id?: string;
  company_product_id?: string;
  product_template_id?: string;
  company_item_id?: string;
  item_type?: 'product' | 'item';
  description: string;
  width?: number;
  height?: number;
  vao_width?: number;
  vao_height?: number;
  quantity: number;
  base_price_m2: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
  linha?: string | null;
  category?: string;
  unit?: string;
  has_glass?: boolean;
  glass_color?: string;
  glass_thickness?: string;
  aluminum_color?: string;
  include_contramarco?: boolean;
  excluded_optional_ids?: string[];
}

export interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  customer_document?: string | null;
  customer_document_type?: string | null;
  customer_profession?: string | null;
  customer_marital_status?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  valid_until: string | null;
}

export interface NovoOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote | null;
}

export type Step = 'client' | 'products' | 'review';

export const DEFAULT_FORM_VALUES: QuoteFormData = {
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  customer_address: '',
  customer_document: '',
  customer_document_type: 'fisica',
  customer_profession: '',
  customer_marital_status: '',
  payment_terms: '',
  valid_until: '',
  notes: '',
};
