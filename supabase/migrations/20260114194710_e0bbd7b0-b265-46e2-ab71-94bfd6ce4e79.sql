-- Add logo_size column to companies table for PDF logo sizing
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_size integer DEFAULT 40;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.logo_size IS 'Logo size in mm for PDF generation (width). Default is 40mm.';