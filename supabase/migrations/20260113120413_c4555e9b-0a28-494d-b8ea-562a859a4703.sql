-- Add new fields to quotes table for contract generation
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS customer_document text,
ADD COLUMN IF NOT EXISTS customer_document_type text DEFAULT 'fisica',
ADD COLUMN IF NOT EXISTS customer_profession text,
ADD COLUMN IF NOT EXISTS customer_marital_status text,
ADD COLUMN IF NOT EXISTS payment_terms text;