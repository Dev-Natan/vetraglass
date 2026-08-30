-- Preserve an existing physical variant or resolve a new tenant color atomically.
DROP FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
);

CREATE FUNCTION public.record_tenant_stock_movement(
  _company_id uuid,
  _company_item_id uuid,
  _direction text,
  _original_quantity numeric,
  _original_unit text,
  _reason text,
  _company_color_id uuid DEFAULT NULL,
  _variant_id uuid DEFAULT NULL,
  _conversion_factor numeric DEFAULT NULL,
  _total_cost numeric DEFAULT NULL,
  _new_sale_price numeric DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _lot_code text DEFAULT '',
  _supplier_name text DEFAULT NULL,
  _document_reference text DEFAULT NULL,
  _width_mm numeric DEFAULT NULL,
  _height_mm numeric DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_location_id uuid; v_variant public.company_item_variants; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT id INTO v_location_id FROM public.stock_locations
  WHERE company_id=_company_id AND code='DEFAULT_STOCK' AND is_active AND NOT needs_review;
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_LOCATION';
  END IF;
  IF _company_color_id IS NOT NULL THEN
    v_variant:=public.resolve_company_profile_variant(_company_id,_company_item_id,_company_color_id);
    IF _variant_id IS NOT NULL AND _variant_id<>v_variant.id THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='VARIANT_STOCK_MISMATCH';
    END IF;
  ELSIF _variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.company_item_variants
    WHERE id=_variant_id AND company_id=_company_id AND company_item_id=_company_item_id;
    IF v_variant.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='VARIANT_STOCK_MISMATCH';
    END IF;
  END IF;
  v_result:=public.record_physical_stock_movement(
    _company_id,_company_item_id,_direction,_original_quantity,_original_unit,
    v_location_id,_reason,v_variant.id,_conversion_factor,_total_cost,_idempotency_key,
    _lot_code,_supplier_name,_document_reference,_width_mm,_height_mm,
    COALESCE(_metadata,'{}'::jsonb)||jsonb_build_object(
      'company_color_id',COALESCE(_company_color_id,v_variant.company_color_id))
  );
  IF _new_sale_price IS NOT NULL THEN
    IF _new_sale_price<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICE'; END IF;
    IF v_variant.id IS NOT NULL THEN
      UPDATE public.company_item_variants SET sale_price=_new_sale_price,updated_at=now()
      WHERE id=v_variant.id AND company_id=_company_id;
    ELSE
      UPDATE public.company_items SET sale_price=_new_sale_price,updated_at=now()
      WHERE id=_company_item_id AND company_id=_company_id;
    END IF;
  END IF;
  RETURN v_result||jsonb_build_object('location_id',v_location_id,
    'variant_id',v_variant.id,'company_color_id',COALESCE(_company_color_id,v_variant.company_color_id));
END;
$$;

REVOKE ALL ON FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) TO authenticated,service_role;
