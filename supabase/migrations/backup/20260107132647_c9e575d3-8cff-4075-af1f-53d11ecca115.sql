-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can manage quote items" ON public.quote_items;

-- Create specific policies for each operation
CREATE POLICY "Users can insert quote items"
ON public.quote_items
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

CREATE POLICY "Users can update quote items"
ON public.quote_items
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

CREATE POLICY "Users can delete quote items"
ON public.quote_items
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));