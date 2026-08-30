-- The legacy default 'none' violates the current canonical pricing constraint.
ALTER TABLE public.company_products
  ALTER COLUMN pricing_type SET DEFAULT 'COMPOSITION';

COMMENT ON COLUMN public.company_products.pricing_type IS
  'Canonical pricing strategy. Private products default to composition and use the same engine as global products.';
