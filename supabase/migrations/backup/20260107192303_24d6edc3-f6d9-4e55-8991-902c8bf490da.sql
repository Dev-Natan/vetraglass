-- Add pieces_quantity column to product_template_items
-- This field stores how many pieces of each profile are needed per product unit
ALTER TABLE public.product_template_items 
ADD COLUMN pieces_quantity INTEGER NOT NULL DEFAULT 1;

-- Add a comment to clarify the column purpose
COMMENT ON COLUMN public.product_template_items.pieces_quantity IS 'Number of pieces of this item needed per product unit';

-- Update existing data based on notes patterns
-- Montantes typically have 2 pieces
UPDATE public.product_template_items 
SET pieces_quantity = 2 
WHERE notes ILIKE '%montante%' OR notes ILIKE '%(2 peças)%' OR notes ILIKE '%(2 pç)%';

-- Travessas with 4 pieces
UPDATE public.product_template_items 
SET pieces_quantity = 4 
WHERE notes ILIKE '%(4 peças)%' OR notes ILIKE '%(4 pç)%';

-- Travessas with 2 pieces (if not already set to 4)
UPDATE public.product_template_items 
SET pieces_quantity = 2 
WHERE (notes ILIKE '%travessa%' AND pieces_quantity = 1);