import { z } from 'zod';
import type { Json } from '@/integrations/supabase/types';

export const quoteSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
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

export interface QuoteComponent {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface QuoteItem {
  id?: string;
  company_product_id?: string;
  product_template_id?: string | null;
  company_item_id?: string;
  item_type?: 'product' | 'item';
  description: string;
  width?: number;
  height?: number;
  vao_width?: number;
  vao_height?: number;
  width_b?: number;
  height_b?: number;
  vao_width_b?: number;
  vao_height_b?: number;
  width_c?: number;
  height_c?: number;
  quantity: number;
  leaves_count?: number;
  glasses_count?: number;
  panels_count?: number;
  sides_count?: number;
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
  notes?: string;
  components?: QuoteComponent[];
  composition_mode?: 'fixed' | 'parametric';
  composition_snapshot?: Json | null;
  parametric_snapshot_version?: number | null;
}

export interface Quote {
  id: string;
  client_id?: string | null;
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
  show_measures_column?: boolean | null;
  show_m2_column?: boolean | null;
}

export interface NovoOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote | null;
  duplicate?: boolean;
}

export type Step = 'client' | 'products' | 'summary' | 'finalize';

export const DEFAULT_FORM_VALUES: QuoteFormData = {
  client_id: null,
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
