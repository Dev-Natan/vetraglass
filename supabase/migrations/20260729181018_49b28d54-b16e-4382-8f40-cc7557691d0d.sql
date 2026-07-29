-- Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_company_access" ON public.suppliers;
CREATE POLICY "suppliers_company_access" ON public.suppliers FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers(company_id);

-- Party link on cash movements
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS party_type text,
  ADD COLUMN IF NOT EXISTS party_id uuid,
  ADD COLUMN IF NOT EXISTS party_name text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_movements_party_type_check') THEN
    ALTER TABLE public.cash_movements
      ADD CONSTRAINT cash_movements_party_type_check
      CHECK (party_type IS NULL OR party_type IN ('cliente','fornecedor','funcionario'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_movements_party ON public.cash_movements(party_type, party_id);