-- Create quotes (orçamentos) table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote items table
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_product_id UUID REFERENCES public.company_products(id),
  description TEXT NOT NULL,
  width NUMERIC,
  height NUMERIC,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Policies for quotes
CREATE POLICY "Users can view company quotes"
ON public.quotes
FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company quotes"
ON public.quotes
FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company quotes"
ON public.quotes
FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company quotes"
ON public.quotes
FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Policies for quote items
CREATE POLICY "Users can view quote items"
ON public.quote_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

CREATE POLICY "Users can manage quote items"
ON public.quote_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

-- Trigger for updated_at
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();