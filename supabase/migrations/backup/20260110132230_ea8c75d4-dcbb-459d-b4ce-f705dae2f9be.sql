-- Create clients table for each company
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text, -- CPF or CNPJ
  document_type text CHECK (document_type IN ('CPF', 'CNPJ')),
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view company clients"
ON public.clients FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company clients"
ON public.clients FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company clients"
ON public.clients FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company clients"
ON public.clients FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Index for faster lookups
CREATE INDEX idx_clients_company_id ON public.clients(company_id);
CREATE INDEX idx_clients_document ON public.clients(document) WHERE document IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();