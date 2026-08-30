-- Phase 4B.1B: canonical tenant operations over the catalog projection.

CREATE OR REPLACE FUNCTION public.create_private_company_color(
  _company_id uuid, _name text, _code text, _hex_color text DEFAULT NULL
)
RETURNS public.company_colors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_color public.company_colors;
BEGIN
  IF auth.uid() IS NULL OR NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF NULLIF(btrim(_name),'') IS NULL OR NULLIF(btrim(_code),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_COLOR';
  END IF;
  SELECT * INTO v_color FROM public.company_colors
  WHERE company_id=_company_id AND lower(btrim(code))=lower(btrim(_code)) FOR UPDATE;
  IF v_color.id IS NULL THEN
    INSERT INTO public.company_colors(company_id,name,code,hex_color,catalog_origin,is_active)
    VALUES (_company_id,btrim(_name),upper(btrim(_code)),NULLIF(btrim(_hex_color),''),'PRIVATE',true)
    RETURNING * INTO v_color;
  ELSIF v_color.catalog_origin <> 'PRIVATE' THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='COLOR_CODE_IN_USE';
  ELSE
    UPDATE public.company_colors SET name=btrim(_name),
      hex_color=COALESCE(NULLIF(btrim(_hex_color),''),hex_color),is_active=true,updated_at=now()
    WHERE id=v_color.id RETURNING * INTO v_color;
  END IF;
  RETURN v_color;
END;
$$;
REVOKE ALL ON FUNCTION public.create_private_company_color(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_private_company_color(uuid,text,text,text)
  TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.create_private_company_item(
  _company_id uuid,
  _name text,
  _code text,
  _type text,
  _purchase_unit text,
  _stock_unit text,
  _consumption_unit text,
  _canonical_unit text,
  _purchase_factor numeric,
  _stock_factor numeric,
  _consumption_factor numeric,
  _nominal_length_mm numeric DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_item public.company_items; v_dimension text; v_unit text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF NULLIF(btrim(_name),'') IS NULL OR NULLIF(btrim(_code),'') IS NULL
     OR upper(btrim(_canonical_unit)) NOT IN ('MM','MM2','UNIT','G')
     OR LEAST(_purchase_factor,_stock_factor,_consumption_factor) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_ITEM_CONFIGURATION';
  END IF;
  v_dimension := CASE upper(btrim(_canonical_unit)) WHEN 'MM' THEN 'LENGTH'
    WHEN 'MM2' THEN 'AREA' WHEN 'G' THEN 'MASS' ELSE 'COUNT' END;
  v_unit := CASE v_dimension WHEN 'LENGTH' THEN 'm' WHEN 'AREA' THEN 'm²'
    WHEN 'MASS' THEN 'kg' ELSE 'un' END;

  SELECT * INTO v_item FROM public.company_items
  WHERE company_id=_company_id AND catalog_origin='PRIVATE'
    AND lower(btrim(code))=lower(btrim(_code)) FOR UPDATE;
  IF v_item.id IS NULL THEN
    INSERT INTO public.company_items(
      company_id,item_template_id,name,description,type,unit,cost,sale_price,
      is_custom,is_active,catalog_origin,code,pricing_basis
    ) VALUES (
      _company_id,NULL,btrim(_name),NULLIF(btrim(_description),''),lower(btrim(_type)),v_unit,
      0,0,true,true,'PRIVATE',upper(btrim(_code)),
      CASE WHEN v_dimension='AREA' THEN 'AREA' WHEN v_dimension='LENGTH' THEN 'LENGTH' ELSE 'UNIT' END
    ) RETURNING * INTO v_item;
  ELSE
    UPDATE public.company_items SET name=btrim(_name),description=COALESCE(NULLIF(btrim(_description),''),description),
      type=lower(btrim(_type)),unit=v_unit,is_active=true,updated_at=now()
    WHERE id=v_item.id RETURNING * INTO v_item;
  END IF;

  INSERT INTO public.inventory_item_units(
    company_id,company_item_id,physical_dimension,purchase_unit,stock_unit,consumption_unit,
    canonical_unit,purchase_to_canonical_factor,stock_to_canonical_factor,
    consumption_to_canonical_factor,nominal_length_mm,cost_policy,legacy_status,sale_unit,cost_unit
  ) VALUES (
    _company_id,v_item.id,v_dimension,upper(btrim(_purchase_unit)),upper(btrim(_stock_unit)),
    upper(btrim(_consumption_unit)),upper(btrim(_canonical_unit)),_purchase_factor,_stock_factor,
    _consumption_factor,_nominal_length_mm,'MANUAL','CONFIGURED',upper(btrim(_consumption_unit)),
    upper(btrim(_consumption_unit))
  ) ON CONFLICT (company_id,company_item_id) DO UPDATE SET
    physical_dimension=EXCLUDED.physical_dimension,purchase_unit=EXCLUDED.purchase_unit,
    stock_unit=EXCLUDED.stock_unit,consumption_unit=EXCLUDED.consumption_unit,
    canonical_unit=EXCLUDED.canonical_unit,purchase_to_canonical_factor=EXCLUDED.purchase_to_canonical_factor,
    stock_to_canonical_factor=EXCLUDED.stock_to_canonical_factor,
    consumption_to_canonical_factor=EXCLUDED.consumption_to_canonical_factor,
    nominal_length_mm=EXCLUDED.nominal_length_mm,legacy_status='CONFIGURED',updated_at=now();
  RETURN jsonb_build_object('company_item_id',v_item.id,'created',v_item.created_at=v_item.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.create_private_company_item(uuid,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_private_company_item(uuid,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,text)
  TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.resolve_company_profile_variant(
  _company_id uuid, _company_item_id uuid, _company_color_id uuid
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_item public.company_items; v_color public.company_colors; v_variant public.company_item_variants;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id=_company_item_id AND company_id=_company_id FOR UPDATE;
  IF v_item.id IS NULL OR lower(v_item.type) NOT IN ('profile','perfil') THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_COMPANY_ITEM';
  END IF;
  SELECT * INTO v_color FROM public.company_colors
  WHERE id=_company_color_id AND company_id=_company_id AND is_active;
  IF v_color.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='INVALID_PROFILE_COLOR';
  END IF;
  SELECT * INTO v_variant FROM public.company_item_variants
  WHERE company_id=_company_id AND company_item_id=_company_item_id
    AND company_color_id=_company_color_id FOR UPDATE;
  IF v_variant.id IS NULL THEN
    INSERT INTO public.company_item_variants(
      company_id,company_item_id,variant_type,profile_color,is_active,pricing_basis,
      attributes,attribute_signature,aluminum_color_id,company_color_id
    ) VALUES (
      _company_id,_company_item_id,'PROFILE',v_color.name,true,v_item.pricing_basis,
      jsonb_build_object('color',upper(v_color.code)),
      'COMPANY_COLOR_ID='||v_color.id::text,v_color.admin_color_id,v_color.id
    ) RETURNING * INTO v_variant;
  ELSE
    UPDATE public.company_item_variants SET profile_color=v_color.name,is_active=true,
      aluminum_color_id=v_color.admin_color_id,attributes=jsonb_build_object('color',upper(v_color.code)),
      attribute_signature='COMPANY_COLOR_ID='||v_color.id::text,updated_at=now()
    WHERE id=v_variant.id RETURNING * INTO v_variant;
  END IF;
  RETURN v_variant;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_company_profile_variant(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_profile_variant(uuid,uuid,uuid)
  TO authenticated,service_role;

-- Transparent default location + atomic variant resolution. The underlying
-- Phase 3F RPC remains the only writer of physical balances and compatibility stock.
CREATE OR REPLACE FUNCTION public.record_tenant_stock_movement(
  _company_id uuid,
  _company_item_id uuid,
  _direction text,
  _original_quantity numeric,
  _original_unit text,
  _reason text,
  _company_color_id uuid DEFAULT NULL,
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
    v_variant := public.resolve_company_profile_variant(_company_id,_company_item_id,_company_color_id);
  END IF;
  v_result := public.record_physical_stock_movement(
    _company_id,_company_item_id,_direction,_original_quantity,_original_unit,
    v_location_id,_reason,v_variant.id,_conversion_factor,_total_cost,_idempotency_key,
    _lot_code,_supplier_name,_document_reference,_width_mm,_height_mm,
    COALESCE(_metadata,'{}'::jsonb)||jsonb_build_object('company_color_id',_company_color_id)
  );
  IF _new_sale_price IS NOT NULL THEN
    IF _new_sale_price < 0 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICE';
    END IF;
    IF v_variant.id IS NOT NULL THEN
      UPDATE public.company_item_variants SET sale_price=_new_sale_price,updated_at=now()
      WHERE id=v_variant.id AND company_id=_company_id;
    ELSE
      UPDATE public.company_items SET sale_price=_new_sale_price,updated_at=now()
      WHERE id=_company_item_id AND company_id=_company_id;
    END IF;
  END IF;
  RETURN v_result||jsonb_build_object('location_id',v_location_id,
    'variant_id',v_variant.id,'company_color_id',_company_color_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_tenant_stock_movement(uuid,uuid,text,numeric,text,text,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_tenant_stock_movement(uuid,uuid,text,numeric,text,text,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb)
  TO authenticated,service_role;

-- Stock-independent color choices. Selecting a color creates variants later,
-- atomically, for the profile components that actually need them.
CREATE OR REPLACE FUNCTION public.get_company_product_profile_colors(
  _company_id uuid, _company_product_id uuid
)
RETURNS TABLE(color_id uuid,color_code text,color_name text,hex_color text,sort_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT cc.id,cc.code,cc.name,cc.hex_color,
    COALESCE(ac.sort_order,100000)+row_number() OVER (ORDER BY cc.name)::integer
  FROM public.company_colors cc
  LEFT JOIN public.admin_aluminum_colors ac ON ac.id=cc.admin_color_id
  WHERE auth.uid() IS NOT NULL
    AND public.user_belongs_to_company(auth.uid(),_company_id)
    AND cc.company_id=_company_id AND cc.is_active
    AND EXISTS (SELECT 1 FROM public.company_products cp
                WHERE cp.id=_company_product_id AND cp.company_id=_company_id)
  ORDER BY COALESCE(ac.sort_order,100000),cc.name;
$$;
REVOKE ALL ON FUNCTION public.get_company_product_profile_colors(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_company_product_profile_colors(uuid,uuid)
  TO authenticated,service_role;

-- Freeze the tenant color identity and readable fields. Global colors also keep
-- the legacy admin color UUID for backwards-compatible snapshots.
CREATE OR REPLACE FUNCTION public.phase4b1a_freeze_quote_profile_color()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_company_id uuid; v_company_color_id uuid; v_color public.company_colors;
  v_material jsonb; v_materials jsonb := '[]'::jsonb; v_variant public.company_item_variants;
BEGIN
  IF NEW.composition_snapshot IS NULL OR jsonb_typeof(NEW.composition_snapshot)<>'object' THEN RETURN NEW; END IF;
  SELECT company_id INTO v_company_id FROM public.quotes WHERE id=NEW.quote_id;
  v_company_color_id := NULLIF(NEW.composition_snapshot#>>'{variants,profile_company_color_id}','')::uuid;
  IF v_company_color_id IS NULL THEN
    SELECT cc.id INTO v_company_color_id FROM public.company_colors cc
    WHERE cc.company_id=v_company_id
      AND cc.admin_color_id=NULLIF(NEW.composition_snapshot#>>'{variants,profile_color_id}','')::uuid;
  END IF;
  IF v_company_color_id IS NULL THEN
    NEW.profile_company_color_id:=NULL; NEW.profile_color_id:=NULL;
    NEW.profile_color_code:=NULL; NEW.profile_color_name:=NULL; RETURN NEW;
  END IF;
  SELECT * INTO v_color FROM public.company_colors
  WHERE id=v_company_color_id AND company_id=v_company_id AND is_active;
  IF v_color.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='INVALID_PROFILE_COLOR'; END IF;
  NEW.profile_company_color_id:=v_color.id; NEW.profile_color_id:=v_color.admin_color_id;
  NEW.profile_color_code:=v_color.code; NEW.profile_color_name:=v_color.name; NEW.aluminum_color:=v_color.name;
  NEW.composition_snapshot:=jsonb_set(NEW.composition_snapshot,'{variants}',
    COALESCE(NEW.composition_snapshot->'variants','{}'::jsonb)||jsonb_build_object(
      'profile_company_color_id',v_color.id,'profile_color_id',v_color.admin_color_id,
      'profile_color_origin',v_color.catalog_origin,'profile_color_code',v_color.code,
      'profile_color_name',v_color.name,'profile_color',v_color.name),true);
  IF jsonb_typeof(NEW.composition_snapshot->'materials')='array' THEN
    FOR v_material IN SELECT value FROM jsonb_array_elements(NEW.composition_snapshot->'materials') LOOP
      IF lower(COALESCE(v_material->>'material_type','')) IN ('profile','perfil')
         AND NULLIF(v_material->>'company_item_id','') IS NOT NULL THEN
        v_variant:=public.resolve_company_profile_variant(v_company_id,
          (v_material->>'company_item_id')::uuid,v_color.id);
        v_material:=v_material||jsonb_build_object('variant_id',v_variant.id,
          'profile_company_color_id',v_color.id,'profile_color_id',v_color.admin_color_id,
          'profile_color_origin',v_color.catalog_origin,'profile_color_code',v_color.code,
          'profile_color_name',v_color.name);
      END IF;
      v_materials:=v_materials||jsonb_build_array(v_material);
    END LOOP;
    NEW.composition_snapshot:=jsonb_set(NEW.composition_snapshot,'{materials}',v_materials,true);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.phase4b1a_freeze_quote_profile_color() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.phase4b1a_sync_document_profile_color()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.profile_company_color_id:=NULLIF(NEW.engineering_snapshot#>>'{variants,profile_company_color_id}','')::uuid;
  NEW.profile_color_id:=NULLIF(NEW.engineering_snapshot#>>'{variants,profile_color_id}','')::uuid;
  NEW.profile_color_code:=NULLIF(NEW.engineering_snapshot#>>'{variants,profile_color_code}','');
  NEW.profile_color_name:=NULLIF(NEW.engineering_snapshot#>>'{variants,profile_color_name}','');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.phase4b1a_sync_document_profile_color() FROM PUBLIC,anon,authenticated;

-- Existing global snapshots receive their tenant projection without changing readable history.
UPDATE public.quote_items qi SET profile_company_color_id=cc.id
FROM public.quotes q,public.company_colors cc
WHERE q.id=qi.quote_id AND cc.company_id=q.company_id
  AND cc.admin_color_id=qi.profile_color_id AND qi.profile_company_color_id IS NULL;
UPDATE public.sale_items si SET profile_company_color_id=cc.id
FROM public.sales s,public.company_colors cc
WHERE s.id=si.sale_id AND cc.company_id=s.company_id
  AND cc.admin_color_id=si.profile_color_id AND si.profile_company_color_id IS NULL;
UPDATE public.os_items oi SET profile_company_color_id=cc.id
FROM public.ordens_servico os,public.company_colors cc
WHERE os.id=oi.os_id AND cc.company_id=os.company_id
  AND cc.admin_color_id=oi.profile_color_id AND oi.profile_company_color_id IS NULL;
