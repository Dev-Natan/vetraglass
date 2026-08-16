export interface Client {
  id: string;
  company_id: string;
  name: string;
  client_type: 'cliente' | 'fornecedor' | 'ambos';
  document: string | null;
  document_type: 'CPF' | 'CNPJ' | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}
