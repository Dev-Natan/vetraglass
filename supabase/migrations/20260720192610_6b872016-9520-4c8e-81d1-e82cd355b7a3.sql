DROP FUNCTION IF EXISTS public.get_cutting_plan_items(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_cutting_plan_items(_template_id uuid, _company_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, quantity_formula text, pieces_formula text, pieces_quantity integer, cut_angle integer, cut_angle_start integer, cut_angle_end integer, is_optional boolean, notes text, width_formula text, height_formula text, item_template_id uuid, item_template_name text, item_template_type text, item_template_image_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _has_plan boolean;
  _use_company boolean := false;
BEGIN
  SELECT pt.has_cutting_plan INTO _has_plan
  FROM public.product_templates pt
  WHERE pt.id = _template_id;

  IF _has_plan IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Este produto não possui plano de corte configurado.'
      USING ERRCODE = 'check_violation';
  END IF;

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
$function$;

GRANT EXECUTE ON FUNCTION public.get_cutting_plan_items(uuid, uuid) TO authenticated, anon, service_role;