
-- 1. product_templates: add company_id + parent_template_id
ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES public.product_templates(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_templates_company_id ON public.product_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_product_templates_parent_template_id ON public.product_templates(parent_template_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_templates_company_parent
  ON public.product_templates(company_id, parent_template_id)
  WHERE company_id IS NOT NULL AND parent_template_id IS NOT NULL;

-- 2. product_template_items: add parent_item_id
ALTER TABLE public.product_template_items
  ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES public.product_template_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_template_items_parent_item_id ON public.product_template_items(parent_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_template_items_company_parent
  ON public.product_template_items(company_id, parent_item_id)
  WHERE company_id IS NOT NULL AND parent_item_id IS NOT NULL;

-- 3. RLS on product_templates: allow companies to manage their own copies
DROP POLICY IF EXISTS "SaaS admins can manage product templates" ON public.product_templates;
DROP POLICY IF EXISTS "Manage product templates by scope" ON public.product_templates;

CREATE POLICY "Manage product templates by scope" ON public.product_templates
  FOR ALL TO authenticated
  USING (
    (company_id IS NULL AND is_saas_admin(auth.uid()))
    OR (company_id IS NOT NULL AND user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role))
  )
  WITH CHECK (
    (company_id IS NULL AND is_saas_admin(auth.uid()))
    OR (company_id IS NOT NULL AND user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role))
  );

-- 4. Rewrite get_cutting_plan_items: per-item override
CREATE OR REPLACE FUNCTION public.get_cutting_plan_items(_template_id uuid, _company_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  id uuid, quantity_formula text, pieces_formula text, pieces_quantity integer,
  cut_angle integer, cut_angle_start integer, cut_angle_end integer,
  is_optional boolean, notes text, width_formula text, height_formula text,
  item_template_id uuid, item_template_name text, item_template_type text, item_template_image_url text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH global_items AS (
    SELECT pti.* FROM public.product_template_items pti
    WHERE pti.product_template_id = _template_id AND pti.company_id IS NULL
  ),
  company_overrides AS (
    SELECT pti.* FROM public.product_template_items pti
    WHERE pti.product_template_id = _template_id
      AND _company_id IS NOT NULL
      AND pti.company_id = _company_id
      AND pti.parent_item_id IS NOT NULL
  ),
  company_only AS (
    SELECT pti.* FROM public.product_template_items pti
    WHERE pti.product_template_id = _template_id
      AND _company_id IS NOT NULL
      AND pti.company_id = _company_id
      AND pti.parent_item_id IS NULL
  ),
  effective AS (
    -- override wins per global item
    SELECT co.* FROM company_overrides co
    UNION ALL
    SELECT gi.* FROM global_items gi
    WHERE NOT EXISTS (SELECT 1 FROM company_overrides co WHERE co.parent_item_id = gi.id)
    UNION ALL
    SELECT * FROM company_only
  )
  SELECT
    e.id, e.quantity_formula, e.pieces_formula, e.pieces_quantity,
    e.cut_angle, e.cut_angle_start, e.cut_angle_end,
    e.is_optional, e.notes, e.width_formula, e.height_formula,
    it.id, it.name, it.type::text, it.image_url
  FROM effective e
  LEFT JOIN public.item_templates it ON it.id = e.item_template_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cutting_plan_items(uuid, uuid) TO authenticated, anon;

-- 5. Copy-on-write save
CREATE OR REPLACE FUNCTION public.save_composition_item(_item_id uuid, _company_id uuid, _patch jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.product_template_items%ROWTYPE;
  _new_id uuid;
BEGIN
  IF NOT public.user_has_role_in_company(auth.uid(), _company_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _row FROM public.product_template_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;

  IF _row.company_id = _company_id THEN
    -- update in place
    UPDATE public.product_template_items SET
      quantity_formula = COALESCE(_patch->>'quantity_formula', quantity_formula),
      pieces_formula   = COALESCE(_patch->>'pieces_formula', pieces_formula),
      pieces_quantity  = COALESCE((_patch->>'pieces_quantity')::int, pieces_quantity),
      cut_angle        = COALESCE((_patch->>'cut_angle')::int, cut_angle),
      cut_angle_start  = COALESCE((_patch->>'cut_angle_start')::int, cut_angle_start),
      cut_angle_end    = COALESCE((_patch->>'cut_angle_end')::int, cut_angle_end),
      width_formula    = COALESCE(_patch->>'width_formula', width_formula),
      height_formula   = COALESCE(_patch->>'height_formula', height_formula),
      is_optional      = COALESCE((_patch->>'is_optional')::boolean, is_optional),
      notes            = COALESCE(_patch->>'notes', notes),
      loss_percent     = COALESCE((_patch->>'loss_percent')::numeric, loss_percent),
      section          = COALESCE(_patch->>'section', section),
      side             = COALESCE(_patch->>'side', side),
      calculation_type = COALESCE(_patch->>'calculation_type', calculation_type),
      applies_to       = COALESCE(_patch->>'applies_to', applies_to),
      item_template_id = COALESCE((_patch->>'item_template_id')::uuid, item_template_id)
    WHERE id = _item_id;
    RETURN _item_id;
  ELSIF _row.company_id IS NULL THEN
    -- copy-on-write: clone with overrides
    INSERT INTO public.product_template_items (
      product_template_id, item_template_id,
      quantity_formula, pieces_formula, pieces_quantity,
      cut_angle, cut_angle_start, cut_angle_end,
      is_optional, notes, width_formula, height_formula,
      loss_percent, section, side, calculation_type, applies_to,
      company_id, parent_item_id
    ) VALUES (
      _row.product_template_id,
      COALESCE((_patch->>'item_template_id')::uuid, _row.item_template_id),
      COALESCE(_patch->>'quantity_formula', _row.quantity_formula),
      COALESCE(_patch->>'pieces_formula', _row.pieces_formula),
      COALESCE((_patch->>'pieces_quantity')::int, _row.pieces_quantity),
      COALESCE((_patch->>'cut_angle')::int, _row.cut_angle),
      COALESCE((_patch->>'cut_angle_start')::int, _row.cut_angle_start),
      COALESCE((_patch->>'cut_angle_end')::int, _row.cut_angle_end),
      COALESCE((_patch->>'is_optional')::boolean, _row.is_optional),
      COALESCE(_patch->>'notes', _row.notes),
      COALESCE(_patch->>'width_formula', _row.width_formula),
      COALESCE(_patch->>'height_formula', _row.height_formula),
      COALESCE((_patch->>'loss_percent')::numeric, _row.loss_percent),
      COALESCE(_patch->>'section', _row.section),
      COALESCE(_patch->>'side', _row.side),
      COALESCE(_patch->>'calculation_type', _row.calculation_type),
      COALESCE(_patch->>'applies_to', _row.applies_to),
      _company_id, _item_id
    ) RETURNING id INTO _new_id;
    RETURN _new_id;
  ELSE
    RAISE EXCEPTION 'cannot edit item belonging to another company';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_composition_item(uuid, uuid, jsonb) TO authenticated;

-- 6. Reset override -> delete company copy
CREATE OR REPLACE FUNCTION public.reset_composition_item(_item_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cid uuid;
BEGIN
  SELECT company_id INTO _cid FROM public.product_template_items WHERE id = _item_id;
  IF _cid IS NULL THEN
    RAISE EXCEPTION 'cannot reset a global item';
  END IF;
  IF NOT public.user_has_role_in_company(auth.uid(), _cid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.product_template_items WHERE id = _item_id AND company_id = _cid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_composition_item(uuid) TO authenticated;

-- 7. Effective product templates listing
CREATE OR REPLACE FUNCTION public.list_effective_product_templates(_company_id uuid)
RETURNS SETOF public.product_templates
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pt.* FROM public.product_templates pt
  WHERE pt.company_id = _company_id
     OR (
       pt.company_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.product_templates c
         WHERE c.company_id = _company_id AND c.parent_template_id = pt.id
       )
     );
$$;

GRANT EXECUTE ON FUNCTION public.list_effective_product_templates(uuid) TO authenticated;
