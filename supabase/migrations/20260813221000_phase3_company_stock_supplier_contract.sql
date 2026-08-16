-- Reconcile the dashboard low-stock contract with the official schema.
-- `linha` belongs to the related item records and is not stored on company_stock.
ALTER TABLE public.company_stock
  ADD COLUMN IF NOT EXISTS supplier_name text;
