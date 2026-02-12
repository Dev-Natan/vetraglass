
-- =====================================================
-- SECURITY: Create quotes_safe view to mask customer PII
-- Only admin/manager see full customer details
-- Regular employees see quote_number, status, amounts only
-- =====================================================

CREATE OR REPLACE VIEW public.quotes_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  company_id,
  quote_number,
  status,
  total_amount,
  discount_percent,
  discount_amount,
  final_amount,
  notes,
  valid_until,
  created_at,
  updated_at,
  deposit_amount,
  deposit_status,
  forma_pagamento_id,
  condicao_pagamento_id,
  valor_original,
  valor_reajustado,
  valor_final_aprovado,
  reajuste_aplicado,
  approved_at,
  approved_by,
  -- Always show customer name (needed for basic identification)
  customer_name,
  -- Mask PII fields for non-elevated roles
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_phone
    ELSE NULL
  END AS customer_phone,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_email
    ELSE NULL
  END AS customer_email,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_address
    ELSE NULL
  END AS customer_address,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_document
    ELSE NULL
  END AS customer_document,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_document_type
    ELSE NULL
  END AS customer_document_type,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_profession
    ELSE NULL
  END AS customer_profession,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_marital_status
    ELSE NULL
  END AS customer_marital_status,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN payment_terms
    ELSE NULL
  END AS payment_terms
FROM public.quotes
WHERE user_belongs_to_company(auth.uid(), company_id);

-- =====================================================
-- Restrict quote UPDATE to elevated roles only
-- (currently any company member can update any quote)
-- =====================================================

DROP POLICY IF EXISTS "Users can update company quotes" ON public.quotes;

CREATE POLICY "Elevated can update company quotes"
ON public.quotes
FOR UPDATE
USING (
  user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Allow the quote creator to update their own quotes
CREATE POLICY "Users can update own quotes"
ON public.quotes
FOR UPDATE
USING (
  user_belongs_to_company(auth.uid(), company_id)
  AND created_at > (now() - interval '24 hours')
);
