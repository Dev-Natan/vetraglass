-- ============================================================
-- FASE 5.17 — Reconciliação de colunas, FKs e RPCs
-- ============================================================

-- ---------- COMPANIES ----------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS enable_presentation_page boolean NOT NULL DEFAULT false;

-- ---------- ORDENS_SERVICO ----------
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS estimated_end date,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS current_stage text,
  ADD COLUMN IF NOT EXISTS stages jsonb DEFAULT '[]'::jsonb;

-- ---------- OS_ITEMS ----------
ALTER TABLE public.os_items
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS width_sold numeric,
  ADD COLUMN IF NOT EXISTS height_sold numeric,
  ADD COLUMN IF NOT EXISTS width_sold_b numeric,
  ADD COLUMN IF NOT EXISTS height_sold_b numeric,
  ADD COLUMN IF NOT EXISTS width_production numeric,
  ADD COLUMN IF NOT EXISTS height_production numeric,
  ADD COLUMN IF NOT EXISTS width_production_b numeric,
  ADD COLUMN IF NOT EXISTS height_production_b numeric;

-- ---------- OS_CUTTING_PLAN ----------
ALTER TABLE public.os_cutting_plan
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS profile_name text,
  ADD COLUMN IF NOT EXISTS waste_percent numeric,
  ADD COLUMN IF NOT EXISTS cuts_data jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS glass_cuts_data jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS item_status jsonb DEFAULT '{}'::jsonb;

-- ---------- AUDIT_LOGS ----------
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS table_name text;

-- ---------- QUOTES ----------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_id uuid,
  ADD COLUMN IF NOT EXISTS valor_original numeric,
  ADD COLUMN IF NOT EXISTS valor_final_aprovado numeric;

-- ---------- PERMISSION_PROFILES ----------
ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS profile_type text DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS hide_prices boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_costs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_operate_cash boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_discounts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_cancel_sales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_reports boolean NOT NULL DEFAULT false;

-- ---------- PURCHASE_ORDER_ITEMS ----------
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS os_material_id uuid,
  ADD COLUMN IF NOT EXISTS width_mm numeric,
  ADD COLUMN IF NOT EXISTS height_mm numeric,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric,
  ADD COLUMN IF NOT EXISTS notes text;

-- ---------- COMPANY_NOTIFICATIONS ----------
ALTER TABLE public.company_notifications
  ADD COLUMN IF NOT EXISTS from_user_id uuid,
  ADD COLUMN IF NOT EXISTS to_role text,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS action_taken boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS action_by uuid,
  ADD COLUMN IF NOT EXISTS action_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_company_notifications_updated ON public.company_notifications;
CREATE TRIGGER trg_company_notifications_updated
  BEFORE UPDATE ON public.company_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- SERVICE_APPOINTMENTS ----------
ALTER TABLE public.service_appointments
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS assigned_to_name text;

ALTER TABLE public.service_appointments
  ALTER COLUMN scheduled_at DROP NOT NULL;

-- ---------- FOREIGN KEYS PARA POSTGREST JOINS ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_commissions_employee_id_fkey'
      AND conrelid = 'public.employee_commissions'::regclass
  ) THEN
    ALTER TABLE public.employee_commissions
      ADD CONSTRAINT employee_commissions_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_orders_ordem_servico_id_fkey'
      AND conrelid = 'public.purchase_orders'::regclass
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_ordem_servico_id_fkey
      FOREIGN KEY (ordem_servico_id) REFERENCES public.ordens_servico(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------- RPCs: activate_product_template_for_company ----------
DROP FUNCTION IF EXISTS public.activate_product_template_for_company(uuid, uuid);
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.company_products (
    company_id, product_template_id, name, description, category, linha, type, unit,
    image_url, side, has_multiple_sides, uses_glass, pieces_quantity, pieces_formula,
    width_formula, height_formula, quantity_formula
  )
  SELECT _company_id, pt.id, pt.name, pt.description, pt.category, pt.linha, pt.type, pt.unit,
    pt.image_url, pt.side, pt.has_multiple_sides, false, pt.pieces_quantity, pt.pieces_formula,
    pt.width_formula, pt.height_formula, pt.quantity_formula
  FROM public.product_templates pt WHERE pt.id = _product_template_id
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- ---------- RPCs: create_custom_product ----------
DROP FUNCTION IF EXISTS public.create_custom_product(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.create_custom_product(
  _company_id uuid,
  _name text,
  _category text DEFAULT NULL,
  _base_price numeric DEFAULT NULL,
  _linha text DEFAULT NULL,
  _description text DEFAULT NULL,
  _image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.company_products (
    company_id, name, category, linha, is_custom, description, image_url
  )
  VALUES (
    _company_id, _name, _category, COALESCE(_linha,'Personalizado'), true, _description, _image_url
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- ---------- RPCs: reset_company_product_item ----------
DROP FUNCTION IF EXISTS public.reset_company_product_item(uuid);
CREATE OR REPLACE FUNCTION public.reset_company_product_item(
  p_company_product_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.company_product_items WHERE id = p_company_product_item_id;
  RETURN jsonb_build_object('success', true, 'action', 'reset');
END $$;

-- ---------- RPCs: reset_company_product_to_template ----------
DROP FUNCTION IF EXISTS public.reset_company_product_to_template(uuid);
CREATE OR REPLACE FUNCTION public.reset_company_product_to_template(
  p_company_product_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.company_product_items
   WHERE company_product_id = p_company_product_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'items_deleted', deleted_count,
    'items_created', 0
  );
END $$;

-- Grants para novas RPCs
GRANT EXECUTE ON FUNCTION public.activate_product_template_for_company(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_product(uuid, text, text, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_company_product_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_company_product_to_template(uuid, uuid) TO authenticated;