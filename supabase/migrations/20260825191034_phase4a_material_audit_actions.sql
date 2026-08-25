-- Keep audit_logs' global action contract intact and correct only Phase 4A RPC writers.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_company_material_variant(
  _company_id uuid, _family_id uuid, _option_ids uuid[], _cost numeric, _basis text, _value numeric
)
RETURNS public.company_item_variants
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_family public.item_templates; v_item public.company_items; v_variant public.company_item_variants;
  v_signature text; v_attributes jsonb; v_markup numeric; v_sale numeric; v_created boolean := false;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED'; END IF;
  SELECT * INTO v_family FROM public.item_templates WHERE id=_family_id AND is_commercial_area_material AND is_active AND (company_id IS NULL OR company_id=_company_id);
  IF v_family.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_FAMILY_NOT_FOUND'; END IF;
  v_signature:=public.phase4a_material_attribute_signature(_family_id,_option_ids,true);
  SELECT COALESCE(jsonb_object_agg(lower(a.attribute_code),COALESCE(o.canonical_value,to_jsonb(o.option_code))),'{}'::jsonb)
  INTO v_attributes FROM public.item_template_attribute_options o JOIN public.item_template_attributes a ON a.id=o.attribute_id
  WHERE o.id=ANY(COALESCE(_option_ids,ARRAY[]::uuid[]));
  IF _cost IS NULL OR _cost<=0 THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MISSING_COST'; END IF;
  IF upper(_basis)='MARKUP' AND _value IS NOT NULL AND _value>=0 THEN v_markup:=_value; v_sale:=round(_cost*(1+_value/100),4);
  ELSIF upper(_basis)='SALE_PRICE' AND _value IS NOT NULL AND _value>=_cost THEN v_sale:=_value; v_markup:=round(((_value/_cost)-1)*100,4);
  ELSE RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_PRICING_INPUT'; END IF;
  INSERT INTO public.company_items(company_id,item_template_id,name,description,type,unit,pricing_basis,pricing_unit,variant_attribute_schema,is_custom,is_active,is_commercial_area_material,commercial_material_family,cost,markup_percent,sale_price)
  VALUES(_company_id,v_family.id,v_family.name,v_family.description,v_family.type::text,v_family.unit,COALESCE(v_family.pricing_basis,'AREA'),COALESCE(v_family.pricing_unit,v_family.unit),v_family.variant_attribute_schema,false,true,true,upper(v_family.commercial_material_family),NULL,NULL,NULL)
  ON CONFLICT(company_id,item_template_id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,type=EXCLUDED.type,unit=EXCLUDED.unit,pricing_basis=EXCLUDED.pricing_basis,pricing_unit=EXCLUDED.pricing_unit,variant_attribute_schema=EXCLUDED.variant_attribute_schema,is_commercial_area_material=true,commercial_material_family=EXCLUDED.commercial_material_family,is_active=true,updated_at=now()
  RETURNING * INTO v_item;
  SELECT * INTO v_variant FROM public.company_item_variants
  WHERE company_item_id=v_item.id AND pricing_basis=v_item.pricing_basis AND (attribute_signature=v_signature OR (attribute_signature IS NULL AND attributes=v_attributes))
  ORDER BY attribute_signature NULLS LAST,updated_at DESC LIMIT 1 FOR UPDATE;
  IF v_variant.id IS NULL THEN
    v_created:=true;
    INSERT INTO public.company_item_variants(company_id,company_item_id,variant_type,pricing_basis,attributes,attribute_signature,glass_type,glass_color,glass_thickness_mm,cost,markup_percent,sale_price,is_active)
    VALUES(_company_id,v_item.id,upper(v_family.commercial_material_family),v_item.pricing_basis,v_attributes,v_signature,v_attributes->>'type',v_attributes->>'color',CASE WHEN v_attributes?'thickness_mm' THEN (v_attributes->>'thickness_mm')::numeric ELSE NULL END,_cost,v_markup,v_sale,true)
    RETURNING * INTO v_variant;
  ELSE
    UPDATE public.company_item_variants SET variant_type=upper(v_family.commercial_material_family),attributes=v_attributes,attribute_signature=v_signature,glass_type=v_attributes->>'type',glass_color=v_attributes->>'color',glass_thickness_mm=CASE WHEN v_attributes?'thickness_mm' THEN (v_attributes->>'thickness_mm')::numeric ELSE NULL END,cost=_cost,markup_percent=v_markup,sale_price=v_sale,is_active=true,updated_at=now()
    WHERE id=v_variant.id RETURNING * INTO v_variant;
  END IF;
  DELETE FROM public.company_item_variant_options WHERE variant_id=v_variant.id;
  INSERT INTO public.company_item_variant_options(variant_id,attribute_id,option_id)
  SELECT v_variant.id,o.attribute_id,o.id FROM public.item_template_attribute_options o WHERE o.id=ANY(COALESCE(_option_ids,ARRAY[]::uuid[]));
  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),_company_id,CASE WHEN v_created THEN 'create' ELSE 'update' END,'company_item_variants',v_variant.id,to_jsonb(v_variant),jsonb_build_object('source','save_company_material_variant','family_id',_family_id));
  RETURN v_variant;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_material_family(_id uuid,_code text,_name text,_description text,_pricing_basis text,_pricing_unit text,_sort_order integer,_active boolean)
RETURNS public.item_templates LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_result public.item_templates; v_code text:=public.phase4a_normalize_catalog_code(_code); v_created boolean:=_id IS NULL;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_saas_admin(auth.uid()) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED'; END IF;
  IF NULLIF(v_code,'') IS NULL OR NULLIF(btrim(_name),'') IS NULL OR upper(_pricing_basis) NOT IN('AREA','LENGTH','UNIT','WEIGHT','VOLUME') OR NULLIF(btrim(_pricing_unit),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_MATERIAL_FAMILY'; END IF;
  IF v_created THEN
    INSERT INTO public.item_templates(name,description,type,unit,is_active,company_id,is_commercial_area_material,commercial_material_family,pricing_basis,pricing_unit,sort_order,variant_attribute_schema)
    VALUES(btrim(_name),NULLIF(btrim(_description),''),'sheet',btrim(_pricing_unit),COALESCE(_active,true),NULL,true,v_code,upper(_pricing_basis),btrim(_pricing_unit),COALESCE(_sort_order,0),'[]') RETURNING * INTO v_result;
  ELSE
    UPDATE public.item_templates SET name=btrim(_name),description=NULLIF(btrim(_description),''),unit=btrim(_pricing_unit),is_active=COALESCE(_active,is_active),pricing_basis=upper(_pricing_basis),pricing_unit=btrim(_pricing_unit),sort_order=COALESCE(_sort_order,sort_order),updated_at=now()
    WHERE id=_id AND is_commercial_area_material AND company_id IS NULL RETURNING * INTO v_result;
  END IF;
  IF v_result.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MATERIAL_FAMILY_NOT_FOUND'; END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),CASE WHEN v_created THEN 'create' ELSE 'update' END,'item_templates',v_result.id,to_jsonb(v_result),jsonb_build_object('source','admin_upsert_material_family'));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_material_attribute(_id uuid,_family_id uuid,_code text,_label text,_data_type text,_required boolean,_sort_order integer,_active boolean)
RETURNS public.item_template_attributes LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_result public.item_template_attributes; v_code text:=public.phase4a_normalize_catalog_code(_code); v_created boolean:=_id IS NULL;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_saas_admin(auth.uid()) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.item_templates WHERE id=_family_id AND is_commercial_area_material AND company_id IS NULL) OR NULLIF(v_code,'') IS NULL OR NULLIF(btrim(_label),'') IS NULL OR upper(_data_type) NOT IN('SELECT','TEXT','NUMBER','BOOLEAN') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_MATERIAL_ATTRIBUTE'; END IF;
  IF v_created THEN
    INSERT INTO public.item_template_attributes(item_template_id,attribute_code,label,data_type,is_required,sort_order,is_active)
    VALUES(_family_id,v_code,btrim(_label),upper(_data_type),COALESCE(_required,true),COALESCE(_sort_order,0),COALESCE(_active,true)) RETURNING * INTO v_result;
  ELSE
    UPDATE public.item_template_attributes SET label=btrim(_label),data_type=upper(_data_type),is_required=COALESCE(_required,is_required),sort_order=COALESCE(_sort_order,sort_order),is_active=COALESCE(_active,is_active),updated_at=now()
    WHERE id=_id AND item_template_id=_family_id RETURNING * INTO v_result;
  END IF;
  IF v_result.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MATERIAL_ATTRIBUTE_NOT_FOUND'; END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),CASE WHEN v_created THEN 'create' ELSE 'update' END,'item_template_attributes',v_result.id,to_jsonb(v_result),jsonb_build_object('family_id',_family_id));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_material_option(_id uuid,_attribute_id uuid,_code text,_label text,_value jsonb,_sort_order integer,_active boolean)
RETURNS public.item_template_attribute_options LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_result public.item_template_attribute_options; v_code text:=public.phase4a_normalize_catalog_code(_code); v_created boolean:=_id IS NULL;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_saas_admin(auth.uid()) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.item_template_attributes a JOIN public.item_templates it ON it.id=a.item_template_id WHERE a.id=_attribute_id AND it.is_commercial_area_material AND it.company_id IS NULL) OR NULLIF(v_code,'') IS NULL OR NULLIF(btrim(_label),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_MATERIAL_OPTION'; END IF;
  IF v_created THEN
    INSERT INTO public.item_template_attribute_options(attribute_id,option_code,label,canonical_value,sort_order,is_active)
    VALUES(_attribute_id,v_code,btrim(_label),COALESCE(_value,to_jsonb(v_code)),COALESCE(_sort_order,0),COALESCE(_active,true)) RETURNING * INTO v_result;
  ELSE
    UPDATE public.item_template_attribute_options SET label=btrim(_label),canonical_value=COALESCE(_value,canonical_value),sort_order=COALESCE(_sort_order,sort_order),is_active=COALESCE(_active,is_active),updated_at=now()
    WHERE id=_id AND attribute_id=_attribute_id RETURNING * INTO v_result;
  END IF;
  IF v_result.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MATERIAL_OPTION_NOT_FOUND'; END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),CASE WHEN v_created THEN 'create' ELSE 'update' END,'item_template_attribute_options',v_result.id,to_jsonb(v_result),jsonb_build_object('attribute_id',_attribute_id));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_company_material_variant(uuid,uuid,uuid[],numeric,text,numeric),public.admin_upsert_material_family(uuid,text,text,text,text,text,integer,boolean),public.admin_upsert_material_attribute(uuid,uuid,text,text,text,boolean,integer,boolean),public.admin_upsert_material_option(uuid,uuid,text,text,jsonb,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_company_material_variant(uuid,uuid,uuid[],numeric,text,numeric),public.admin_upsert_material_family(uuid,text,text,text,text,text,integer,boolean),public.admin_upsert_material_attribute(uuid,uuid,text,text,text,boolean,integer,boolean),public.admin_upsert_material_option(uuid,uuid,text,text,jsonb,integer,boolean) TO authenticated,service_role;

COMMIT;
