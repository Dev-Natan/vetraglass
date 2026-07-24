-- ============================================================
-- FASE 5.19 — Reconciliação final
-- ============================================================

-- ---------- OS_PHOTOS ----------
ALTER TABLE public.os_photos
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS photo_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS uploaded_at timestamp with time zone DEFAULT now();
ALTER TABLE public.os_photos ALTER COLUMN photo_url DROP NOT NULL;

-- ---------- OS_MATERIALS ----------
ALTER TABLE public.os_materials
  ADD COLUMN IF NOT EXISTS waste_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- ---------- FINANCIAL_CATEGORIES ----------
ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
UPDATE public.financial_categories SET active = is_active WHERE active IS DISTINCT FROM is_active;

-- ---------- SYSTEM_MODULE_SETTINGS ----------
ALTER TABLE public.system_module_settings
  ADD COLUMN IF NOT EXISTS module_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon text;
UPDATE public.system_module_settings SET module_name = module_key WHERE module_name IS NULL;

-- ---------- FORMAS_PAGAMENTO ----------
ALTER TABLE public.formas_pagamento
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
UPDATE public.formas_pagamento SET nome = name WHERE nome IS NULL;

-- ---------- CONDICOES_PAGAMENTO ----------
ALTER TABLE public.condicoes_pagamento
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS parcelas integer,
  ADD COLUMN IF NOT EXISTS dias_entre_parcelas integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS juros_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
UPDATE public.condicoes_pagamento SET nome = name WHERE nome IS NULL;
UPDATE public.condicoes_pagamento SET parcelas = installments WHERE parcelas IS NULL;

-- ---------- CASH_MOVEMENTS ----------
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

-- ---------- PURCHASE_ORDERS ----------
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS procurement_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS expected_delivery date,
  ADD COLUMN IF NOT EXISTS item_template_id uuid REFERENCES public.item_templates(id) ON DELETE SET NULL;

-- ---------- COMPANIES ----------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='logo_size' AND data_type='text') THEN
    ALTER TABLE public.companies ALTER COLUMN logo_size TYPE numeric USING NULLIF(logo_size,'')::numeric;
  END IF;
END $$;

-- ---------- RPC: save_composition_item (nova assinatura) ----------
DROP FUNCTION IF EXISTS public.save_composition_item(jsonb);
CREATE OR REPLACE FUNCTION public.save_composition_item(_item_id uuid, _company_id uuid, _patch jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_template_id uuid;
  v_product_template_id uuid;
BEGIN
  -- Verifica se o item pertence à empresa (override) ou é do template global
  SELECT id INTO v_existing_id
  FROM public.company_product_items
  WHERE id = _item_id AND company_id = _company_id;

  IF v_existing_id IS NOT NULL THEN
    -- Update in-place na cópia da empresa
    UPDATE public.company_product_items SET
      name = COALESCE(_patch->>'name', name),
      type = COALESCE(_patch->>'type', type),
      unit = COALESCE(_patch->>'unit', unit),
      section = COALESCE(_patch->>'section', section),
      side = COALESCE(_patch->>'side', side),
      is_optional = COALESCE((_patch->>'is_optional')::boolean, is_optional),
      bar_length_mm = COALESCE(NULLIF(_patch->>'bar_length_mm','')::numeric, bar_length_mm),
      pieces_quantity = COALESCE(NULLIF(_patch->>'pieces_quantity','')::numeric, pieces_quantity),
      width_formula = COALESCE(_patch->>'width_formula', width_formula),
      height_formula = COALESCE(_patch->>'height_formula', height_formula),
      quantity_formula = COALESCE(_patch->>'quantity_formula', quantity_formula),
      updated_at = now()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  -- Copia o item global do template para a empresa
  SELECT product_template_id INTO v_product_template_id
  FROM public.product_template_items WHERE id = _item_id;

  INSERT INTO public.company_product_items (
    company_id, item_template_id, name, type, unit, section, side,
    is_optional, bar_length_mm, pieces_quantity, width_formula, height_formula, quantity_formula
  )
  SELECT
    _company_id, pti.item_template_id,
    COALESCE(_patch->>'name', pti.name),
    COALESCE(_patch->>'type', pti.type),
    COALESCE(_patch->>'unit', pti.unit),
    COALESCE(_patch->>'section', pti.section),
    COALESCE(_patch->>'side', pti.side),
    COALESCE((_patch->>'is_optional')::boolean, pti.is_optional),
    COALESCE(NULLIF(_patch->>'bar_length_mm','')::numeric, pti.bar_length_mm),
    COALESCE(NULLIF(_patch->>'pieces_quantity','')::numeric, pti.pieces_quantity),
    COALESCE(_patch->>'width_formula', pti.width_formula),
    COALESCE(_patch->>'height_formula', pti.height_formula),
    COALESCE(_patch->>'quantity_formula', pti.quantity_formula)
  FROM public.product_template_items pti
  WHERE pti.id = _item_id
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END $$;

-- ---------- RPC: get_cash_flow_projection (retorno alinhado) ----------
DROP FUNCTION IF EXISTS public.get_cash_flow_projection(uuid, date, date);
CREATE OR REPLACE FUNCTION public.get_cash_flow_projection(p_company_id uuid, p_start date, p_end date)
RETURNS TABLE(date date, realized_in numeric, realized_out numeric, projected_in numeric, projected_out numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), p_company_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  WITH days AS (SELECT generate_series(p_start, p_end, interval '1 day')::date AS d),
  ar AS (
    SELECT due_date::date AS d,
      SUM(CASE WHEN status='paid' THEN COALESCE(paid_amount,total_amount) ELSE 0 END) AS realized,
      SUM(CASE WHEN status<>'paid' THEN total_amount ELSE 0 END) AS projected
    FROM public.accounts_receivable
    WHERE company_id = p_company_id AND status <> 'cancelled'
      AND due_date BETWEEN p_start AND p_end
    GROUP BY due_date::date
  ),
  ap AS (
    SELECT due_date::date AS d,
      SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) AS realized,
      SUM(CASE WHEN status<>'paid' THEN amount ELSE 0 END) AS projected
    FROM public.expenses
    WHERE company_id = p_company_id AND status <> 'cancelled'
      AND due_date BETWEEN p_start AND p_end
    GROUP BY due_date::date
  )
  SELECT days.d,
         COALESCE(ar.realized, 0),
         COALESCE(ap.realized, 0),
         COALESCE(ar.projected, 0),
         COALESCE(ap.projected, 0)
  FROM days LEFT JOIN ar ON ar.d = days.d LEFT JOIN ap ON ap.d = days.d
  ORDER BY days.d;
END $$;