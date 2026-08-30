CREATE OR REPLACE FUNCTION public.resolve_company_profile_variant(
  _company_id uuid,
  _company_item_id uuid,
  _company_color_id uuid
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_item public.company_items;
  v_color public.company_colors;
  v_variant public.company_item_variants;
  v_attributes jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;

  SELECT * INTO v_item
  FROM public.company_items
  WHERE id=_company_item_id AND company_id=_company_id
  FOR UPDATE;
  IF v_item.id IS NULL OR lower(v_item.type) NOT IN ('profile','perfil') THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='MISSING_COMPANY_ITEM';
  END IF;

  SELECT * INTO v_color
  FROM public.company_colors
  WHERE id=_company_color_id AND company_id=_company_id AND is_active;
  IF v_color.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='INVALID_PROFILE_COLOR';
  END IF;

  v_attributes := jsonb_build_object('color', upper(v_color.code));

  -- The physical/commercial variant identity is its canonical attributes,
  -- not the particular global/private color row that supplied those values.
  -- Upsert makes concurrent replay safe and reuses an existing equivalent.
  INSERT INTO public.company_item_variants(
    company_id, company_item_id, variant_type, profile_color, is_active,
    pricing_basis, attributes, attribute_signature,
    aluminum_color_id, company_color_id
  ) VALUES (
    _company_id, _company_item_id, 'PROFILE', v_color.name, true,
    v_item.pricing_basis, v_attributes,
    'COMPANY_COLOR_ID=' || v_color.id::text,
    v_color.admin_color_id, v_color.id
  )
  ON CONFLICT (company_item_id, pricing_basis, attributes)
  DO UPDATE SET
    profile_color=EXCLUDED.profile_color,
    is_active=true,
    aluminum_color_id=EXCLUDED.aluminum_color_id,
    company_color_id=EXCLUDED.company_color_id,
    attribute_signature=EXCLUDED.attribute_signature,
    updated_at=now()
  RETURNING * INTO v_variant;

  RETURN v_variant;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_company_profile_variant(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_company_profile_variant(uuid,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_profile_variant(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_profile_variant(uuid,uuid,uuid) TO service_role;

COMMENT ON FUNCTION public.resolve_company_profile_variant(uuid,uuid,uuid) IS
  'Idempotently resolves the tenant profile variant by canonical attributes while preserving strict company ownership.';

CREATE OR REPLACE FUNCTION public.get_company_product_profile_colors(
  _company_id uuid,
  _company_product_id uuid
)
RETURNS TABLE(
  color_id uuid,
  color_code text,
  color_name text,
  hex_color text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    COALESCE(cc.admin_color_id, cc.id) AS color_id,
    cc.code,
    cc.name,
    cc.hex_color,
    COALESCE(ac.sort_order,100000) + row_number() OVER (ORDER BY cc.name)::integer
  FROM public.company_colors cc
  LEFT JOIN public.admin_aluminum_colors ac ON ac.id=cc.admin_color_id
  WHERE auth.uid() IS NOT NULL
    AND public.user_belongs_to_company(auth.uid(),_company_id)
    AND cc.company_id=_company_id
    AND cc.is_active
    AND EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id=_company_product_id AND cp.company_id=_company_id
    )
  ORDER BY COALESCE(ac.sort_order,100000),cc.name;
$function$;

REVOKE ALL ON FUNCTION public.get_company_product_profile_colors(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_company_product_profile_colors(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_company_product_profile_colors(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_product_profile_colors(uuid,uuid) TO service_role;

COMMENT ON FUNCTION public.get_company_product_profile_colors(uuid,uuid) IS
  'Returns the canonical selector identity: global admin color id when present, otherwise the tenant-private color id.';
