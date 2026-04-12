-- Fix missing columns
ALTER TABLE public.product_templates ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;
