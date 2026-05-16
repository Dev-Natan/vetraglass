-- Adicionar política de INSERT para company_linhas
CREATE POLICY "Users can create linhas for their company"
ON public.company_linhas
FOR INSERT
TO authenticated
WITH CHECK (
  user_belongs_to_company(auth.uid(), company_id)
);

-- Garantir que políticas de UPDATE e DELETE também existam
CREATE POLICY "Users can update linhas for their company"
ON public.company_linhas
FOR UPDATE
TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can delete linhas for their company"
ON public.company_linhas
FOR DELETE
TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id));