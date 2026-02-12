-- Fix: company_items INSERT policy uses employees table instead of user_companies
-- This blocks company owners who aren't in the employees table

DROP POLICY IF EXISTS "Users can insert company items" ON public.company_items;
CREATE POLICY "Users can insert company items"
  ON public.company_items
  FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can update company items" ON public.company_items;
CREATE POLICY "Users can update company items"
  ON public.company_items
  FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can delete company items" ON public.company_items;
CREATE POLICY "Users can delete company items"
  ON public.company_items
  FOR DELETE
  USING (user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can view company items" ON public.company_items;
CREATE POLICY "Users can view company items"
  ON public.company_items
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));