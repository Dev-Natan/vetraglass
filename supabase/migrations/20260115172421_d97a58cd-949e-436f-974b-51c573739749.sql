-- Drop partial policies if any
DROP POLICY IF EXISTS "Elevated role or assigned can view service orders" ON public.ordens_servico;

-- Create new restricted policies for ordens_servico
-- Only managers/admins OR assigned employees can view service orders
CREATE POLICY "Elevated role or assigned can view service orders"
ON public.ordens_servico
FOR SELECT
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
  OR (assigned_to IS NOT NULL AND assigned_to::uuid = auth.uid())
);

-- Only managers/admins can insert service orders
CREATE POLICY "Elevated role can insert service orders"
ON public.ordens_servico
FOR INSERT
WITH CHECK (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Only managers/admins can update service orders
CREATE POLICY "Elevated role can update service orders"
ON public.ordens_servico
FOR UPDATE
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Only admins can delete service orders
CREATE POLICY "Admin can delete service orders"
ON public.ordens_servico
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid()
      AND company_id = ordens_servico.company_id
      AND is_active = true
      AND role = 'admin'
  )
);

-- Create new restricted policies for notas_fiscais (only managers/admins)
CREATE POLICY "Elevated role can view invoices"
ON public.notas_fiscais
FOR SELECT
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

CREATE POLICY "Elevated role can insert invoices"
ON public.notas_fiscais
FOR INSERT
WITH CHECK (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

CREATE POLICY "Elevated role can update invoices"
ON public.notas_fiscais
FOR UPDATE
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

CREATE POLICY "Admin can delete invoices"
ON public.notas_fiscais
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid()
      AND company_id = notas_fiscais.company_id
      AND is_active = true
      AND role = 'admin'
  )
);