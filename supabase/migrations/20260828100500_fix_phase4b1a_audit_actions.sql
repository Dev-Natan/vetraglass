-- Phase 4B.1A follow-up: audit_logs uses create/update/delete, not SQL verb names.
CREATE OR REPLACE FUNCTION public.set_company_profile_variant_active(
  _company_id uuid,
  _company_item_id uuid,
  _aluminum_color_id uuid,
  _is_active boolean,
  _cost numeric DEFAULT NULL,
  _sale_price numeric DEFAULT NULL
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.company_items;
  v_color public.admin_aluminum_colors;
  v_variant public.company_item_variants;
  v_old jsonb;
BEGIN
  IF v_user_id IS NULL OR NOT public.phase3e_can_manage_pricing(v_user_id, _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id = _company_item_id AND company_id = _company_id FOR UPDATE;
  IF v_item.id IS NULL OR lower(v_item.type) NOT IN ('profile','perfil') THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;
  SELECT * INTO v_color FROM public.admin_aluminum_colors
  WHERE id = _aluminum_color_id AND is_active;
  IF v_color.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_PROFILE_COLOR';
  END IF;
  IF COALESCE(_cost, 0) < 0 OR COALESCE(_sale_price, 0) < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICE';
  END IF;

  SELECT * INTO v_variant FROM public.company_item_variants
  WHERE company_id = _company_id
    AND company_item_id = _company_item_id
    AND aluminum_color_id = _aluminum_color_id
  FOR UPDATE;
  v_old := CASE WHEN v_variant.id IS NULL THEN NULL ELSE to_jsonb(v_variant) END;

  IF v_variant.id IS NULL THEN
    INSERT INTO public.company_item_variants(
      company_id, company_item_id, variant_type, profile_color,
      cost, sale_price, is_active, pricing_basis, attributes,
      attribute_signature, aluminum_color_id
    ) VALUES (
      _company_id, _company_item_id, 'PROFILE', v_color.name,
      _cost, _sale_price, _is_active, 'LENGTH',
      jsonb_build_object('color', upper(v_color.slug)),
      'COLOR_ID=' || v_color.id::text, v_color.id
    ) RETURNING * INTO v_variant;
  ELSE
    UPDATE public.company_item_variants
    SET profile_color = v_color.name,
        cost = COALESCE(_cost, cost),
        sale_price = COALESCE(_sale_price, sale_price),
        is_active = _is_active,
        pricing_basis = 'LENGTH',
        attributes = jsonb_build_object('color', upper(v_color.slug)),
        attribute_signature = 'COLOR_ID=' || v_color.id::text,
        updated_at = now()
    WHERE id = v_variant.id
    RETURNING * INTO v_variant;
  END IF;

  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,old_data,new_data,metadata)
  VALUES (v_user_id,_company_id,
    CASE WHEN v_old IS NULL THEN 'create' ELSE 'update' END,
    'company_item_variants',v_variant.id,v_old,to_jsonb(v_variant),
    jsonb_build_object('source','phase4b1a_profile_variant_activation'));
  RETURN v_variant;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase4b1a_audit_global_color()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,old_data,new_data,metadata)
  VALUES (auth.uid(),NULL,CASE WHEN TG_OP='INSERT' THEN 'create' ELSE 'update' END,
    'admin_aluminum_colors',NEW.id,
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),
    jsonb_build_object('source','phase4b1a_global_profile_colors'));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric)
  TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.phase4b1a_audit_global_color()
  FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';
