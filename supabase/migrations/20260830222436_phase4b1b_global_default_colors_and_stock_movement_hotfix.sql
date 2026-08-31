-- Final Phase 4B.1B hotfix: keep the global color catalog available to every
-- tenant and make stock exits consume only an already-existing physical
-- identity. Historical NULL variants remain explicit legacy stock.

INSERT INTO public.admin_aluminum_colors(name,slug,hex_color,sort_order,is_active)
VALUES
  ('Branco','branco','#ffffff',1,true),
  ('Preto','preto','#000000',2,true),
  ('Bronze','bronze','#a9a760',3,true),
  ('Amadeirado','amadeirado','#8b5a2b',4,true),
  ('Fosco','fosco','#c9c9c9',5,true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.company_colors(
  company_id,admin_color_id,name,code,hex_color,catalog_origin,is_active
)
SELECT c.id,ac.id,ac.name,ac.slug,ac.hex_color,'GLOBAL',true
FROM public.companies c
CROSS JOIN public.admin_aluminum_colors ac
WHERE ac.slug IN ('branco','preto','bronze','amadeirado','fosco')
  AND ac.is_active
ON CONFLICT (company_id,admin_color_id) WHERE admin_color_id IS NOT NULL
DO UPDATE SET
  name=EXCLUDED.name,
  code=EXCLUDED.code,
  hex_color=EXCLUDED.hex_color,
  catalog_origin='GLOBAL',
  is_active=true,
  updated_at=now();

CREATE OR REPLACE FUNCTION public.record_tenant_stock_movement(
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
DECLARE
  v_location_id uuid;
  v_variant public.company_item_variants;
  v_result jsonb;
  v_direction text := upper(btrim(_direction));
BEGIN
  IF auth.uid() IS NULL OR NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF v_direction NOT IN ('IN','OUT') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_MOVEMENT_DIRECTION';
  END IF;

  SELECT id INTO v_location_id
  FROM public.stock_locations
  WHERE company_id=_company_id AND code='DEFAULT_STOCK' AND is_active AND NOT needs_review;
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_LOCATION';
  END IF;

  IF v_direction='IN' AND _company_color_id IS NOT NULL THEN
    v_variant:=public.resolve_company_profile_variant(
      _company_id,_company_item_id,_company_color_id
    );
    IF _variant_id IS NOT NULL AND _variant_id<>v_variant.id THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='VARIANT_STOCK_MISMATCH';
    END IF;
  ELSIF _variant_id IS NOT NULL THEN
    SELECT * INTO v_variant
    FROM public.company_item_variants
    WHERE id=_variant_id
      AND company_id=_company_id
      AND company_item_id=_company_item_id
      AND is_active;
    IF v_variant.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='VARIANT_STOCK_MISMATCH';
    END IF;
    IF _company_color_id IS NOT NULL
       AND _company_color_id IS DISTINCT FROM v_variant.company_color_id THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='VARIANT_STOCK_MISMATCH';
    END IF;
  ELSIF v_direction='OUT' AND _company_color_id IS NOT NULL THEN
    -- Exits never materialize a variant. The caller must select an existing
    -- physical variant ID; NULL/NULL remains the explicit legacy balance.
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='EXISTING_VARIANT_REQUIRED';
  END IF;

  IF v_direction='OUT' AND _new_sale_price IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICE';
  END IF;

  v_result:=public.record_physical_stock_movement(
    _company_id,_company_item_id,v_direction,_original_quantity,_original_unit,
    v_location_id,_reason,v_variant.id,_conversion_factor,_total_cost,_idempotency_key,
    _lot_code,_supplier_name,_document_reference,_width_mm,_height_mm,
    COALESCE(_metadata,'{}'::jsonb)||jsonb_build_object(
      'company_color_id',COALESCE(_company_color_id,v_variant.company_color_id),
      'variant_resolution',CASE WHEN v_direction='IN' THEN 'ENTRY' ELSE 'EXISTING_ONLY' END
    )
  );

  IF _new_sale_price IS NOT NULL THEN
    IF _new_sale_price<0 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICE';
    END IF;
    IF v_variant.id IS NOT NULL THEN
      UPDATE public.company_item_variants
      SET sale_price=_new_sale_price,updated_at=now()
      WHERE id=v_variant.id AND company_id=_company_id;
    ELSE
      UPDATE public.company_items
      SET sale_price=_new_sale_price,updated_at=now()
      WHERE id=_company_item_id AND company_id=_company_id;
    END IF;
  END IF;

  RETURN v_result||jsonb_build_object(
    'location_id',v_location_id,
    'variant_id',v_variant.id,
    'company_color_id',COALESCE(_company_color_id,v_variant.company_color_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) TO authenticated,service_role;

COMMENT ON FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) IS 'Canonical tenant stock movement: entries may resolve variants; exits consume only an existing variant or the explicit legacy NULL balance.';

NOTIFY pgrst,'reload schema';
