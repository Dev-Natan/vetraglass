
-- 1. Function that returns cutting plan composition ONLY if has_cutting_plan is true
CREATE OR REPLACE FUNCTION public.get_cutting_plan_items(
  _template_id uuid,
  _company_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  quantity_formula text,
  pieces_formula text,
  pieces_quantity integer,
  cut_angle text,
  cut_angle_start text,
  cut_angle_end text,
  is_optional boolean,
  notes text,
  width_formula text,
  height_formula text,
  item_template_id uuid,
  item_template_name text,
  item_template_type text,
  item_template_image_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_plan boolean;
  _use_company boolean := false;
BEGIN
  -- Backend enforcement: block when product does not have a cutting plan
  SELECT pt.has_cutting_plan INTO _has_plan
  FROM public.product_templates pt
  WHERE pt.id = _template_id;

  IF _has_plan IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Este produto não possui plano de corte configurado.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Prefer company-specific composition when available
  IF _company_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.product_template_items pti
      WHERE pti.product_template_id = _template_id
        AND pti.company_id = _company_id
    ) INTO _use_company;
  END IF;

  RETURN QUERY
  SELECT
    pti.id,
    pti.quantity_formula,
    pti.pieces_formula,
    pti.pieces_quantity,
    pti.cut_angle,
    pti.cut_angle_start,
    pti.cut_angle_end,
    pti.is_optional,
    pti.notes,
    pti.width_formula,
    pti.height_formula,
    it.id AS item_template_id,
    it.name AS item_template_name,
    it.type AS item_template_type,
    it.image_url AS item_template_image_url
  FROM public.product_template_items pti
  LEFT JOIN public.item_templates it ON it.id = pti.item_template_id
  WHERE pti.product_template_id = _template_id
    AND (
      (_use_company AND pti.company_id = _company_id)
      OR (NOT _use_company AND pti.company_id IS NULL)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cutting_plan_items(uuid, uuid) TO authenticated, service_role;

-- 2. Function that lists ONLY templates with an active cutting plan
CREATE OR REPLACE FUNCTION public.list_cutting_plan_templates(
  _linha text DEFAULT NULL,
  _category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  linha text,
  category text,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pt.id, pt.name, pt.linha, pt.category, pt.image_url
  FROM public.product_templates pt
  WHERE pt.is_active = true
    AND pt.has_cutting_plan = true
    AND (_linha IS NULL OR pt.linha = _linha)
    AND (_category IS NULL OR pt.category = _category)
  ORDER BY pt.name;
$$;

GRANT EXECUTE ON FUNCTION public.list_cutting_plan_templates(text, text) TO authenticated, anon, service_role;
