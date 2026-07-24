-- Fase 5.20

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS parent_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.quote_deposits
  ADD COLUMN IF NOT EXISTS cash_register_id uuid REFERENCES public.cash_registers(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS valor_financeiro numeric;

ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_refunds boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_name text;
UPDATE public.permission_profiles SET profile_name = name WHERE profile_name IS NULL;

ALTER TABLE public.os_glass_projects
  ADD COLUMN IF NOT EXISTS procurement_status text DEFAULT 'pending';

ALTER TABLE public.support_attachments
  ADD COLUMN IF NOT EXISTS file_path text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS "number" text,
  ADD COLUMN IF NOT EXISTS complement text;

-- Ajusta RPC de perfil de permissão
DROP FUNCTION IF EXISTS public.get_user_permission_profile(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_user_permission_profile(_user_id uuid, _company_id uuid)
RETURNS TABLE(
  profile_id uuid,
  profile_type text,
  profile_name text,
  permissions jsonb,
  hide_prices boolean,
  hide_costs boolean,
  can_operate_cash boolean,
  can_approve_discounts boolean,
  can_cancel_sales boolean,
  can_manage_stock boolean,
  can_view_reports boolean,
  can_approve_refunds boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pp.id, COALESCE(pp.profile_type,'custom')::text, COALESCE(pp.profile_name, pp.name),
         pp.permissions,
         pp.hide_prices, pp.hide_costs, pp.can_operate_cash,
         pp.can_approve_discounts, pp.can_cancel_sales,
         pp.can_manage_stock, pp.can_view_reports,
         pp.can_approve_refunds
  FROM public.employees e
  JOIN public.permission_profiles pp ON pp.id = e.permission_profile_id
  WHERE e.user_id = _user_id AND e.company_id = _company_id
  LIMIT 1;
$$;