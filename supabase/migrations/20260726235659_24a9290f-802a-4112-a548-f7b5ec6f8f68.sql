DROP FUNCTION IF EXISTS public.get_cutting_plan_items(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_cutting_plan_items(_template_id uuid, _company_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  id uuid,
  item_template_id uuid,
  item_template_name text,
  item_template_type text,
  item_template_image_url text,
  section text,
  side text,
  bar_length_mm numeric,
  pieces_quantity numeric,
  width_formula text,
  height_formula text,
  quantity_formula text,
  pieces_formula text,
  cut_angle numeric,
  cut_angle_start numeric,
  cut_angle_end numeric,
  is_optional boolean,
  notes text,
  source text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_product_id uuid;
  v_has_company_items boolean := false;
BEGIN
  -- 1) Try to find a company_products row linked to this admin template for this company
  IF _company_id IS NOT NULL THEN
    SELECT cp.id INTO v_company_product_id
    FROM public.company_products cp
    WHERE cp.company_id = _company_id
      AND (cp.product_template_id = _template_id OR cp.id = _template_id)
    ORDER BY (cp.product_template_id = _template_id) DESC
    LIMIT 1;

    IF v_company_product_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.company_product_items cpi
        WHERE cpi.company_product_id = v_company_product_id
      ) INTO v_has_company_items;
    END IF;
  END IF;

  -- 2) If company has customized composition, return ONLY company items
  IF v_has_company_items THEN
    RETURN QUERY
    SELECT
      cpi.id,
      COALESCE(cpi.item_template_id, it.id) AS item_template_id,
      COALESCE(cpi.name, it.name) AS item_template_name,
      COALESCE(cpi.type, it.type) AS item_template_type,
      COALESCE(cpi.image_url, it.image_url) AS item_template_image_url,
      cpi.section,
      cpi.side,
      cpi.bar_length_mm,
      cpi.pieces_quantity,
      cpi.width_formula,
      cpi.height_formula,
      cpi.quantity_formula,
      NULL::text AS pieces_formula,
      cpi.cut_angle,
      NULL::numeric AS cut_angle_start,
      NULL::numeric AS cut_angle_end,
      cpi.is_optional,
      NULL::text AS notes,
      'company'::text AS source
    FROM public.company_product_items cpi
    LEFT JOIN public.item_templates it ON it.id = cpi.item_template_id
    WHERE cpi.company_product_id = v_company_product_id
    ORDER BY cpi.sort_order NULLS LAST, COALESCE(cpi.name, it.name);
    RETURN;
  END IF;

  -- 3) Fallback: return the admin's default template composition
  RETURN QUERY
  SELECT
    pti.id,
    COALESCE(pti.item_template_id, it.id) AS item_template_id,
    COALESCE(pti.name, it.name) AS item_template_name,
    COALESCE(pti.type, it.type) AS item_template_type,
    COALESCE(pti.image_url, it.image_url) AS item_template_image_url,
    pti.section,
    pti.side,
    pti.bar_length_mm,
    pti.pieces_quantity,
    pti.width_formula,
    pti.height_formula,
    pti.quantity_formula,
    pti.pieces_formula,
    pti.cut_angle,
    pti.cut_angle_start,
    pti.cut_angle_end,
    pti.is_optional,
    pti.notes,
    'template'::text AS source
  FROM public.product_template_items pti
  LEFT JOIN public.item_templates it ON it.id = pti.item_template_id
  WHERE pti.product_template_id = _template_id
  ORDER BY pti.sort_order NULLS LAST, COALESCE(pti.name, it.name);
END $function$;

GRANT EXECUTE ON FUNCTION public.get_cutting_plan_items(uuid, uuid) TO authenticated, anon, service_role;