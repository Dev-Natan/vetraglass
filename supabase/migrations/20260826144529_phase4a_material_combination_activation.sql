-- Phase 4A final: global valid material combinations and lazy tenant activation.
-- Global catalog identity lives here; company_item_variants remains the only price source.

CREATE TABLE public.item_template_variant_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_template_id uuid NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  attribute_signature text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT item_template_variant_definitions_family_signature_key
    UNIQUE (item_template_id, attribute_signature),
  CONSTRAINT item_template_variant_definitions_id_family_key
    UNIQUE (id, item_template_id)
);

CREATE TABLE public.item_template_variant_definition_options (
  definition_id uuid NOT NULL,
  item_template_id uuid NOT NULL,
  attribute_id uuid NOT NULL,
  option_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (definition_id, attribute_id),
  CONSTRAINT item_template_variant_definition_options_definition_option_key
    UNIQUE (definition_id, option_id),
  CONSTRAINT item_template_variant_definition_options_definition_family_fkey
    FOREIGN KEY (definition_id, item_template_id)
    REFERENCES public.item_template_variant_definitions(id, item_template_id) ON DELETE CASCADE,
  CONSTRAINT item_template_variant_definition_options_attribute_family_fkey
    FOREIGN KEY (attribute_id, item_template_id)
    REFERENCES public.item_template_attributes(id, item_template_id) ON DELETE RESTRICT,
  CONSTRAINT item_template_variant_definition_options_option_attribute_fkey
    FOREIGN KEY (option_id, attribute_id)
    REFERENCES public.item_template_attribute_options(id, attribute_id) ON DELETE RESTRICT
);

CREATE INDEX item_template_variant_definitions_family_active_idx
  ON public.item_template_variant_definitions(item_template_id, is_active, sort_order, id);
CREATE INDEX item_template_variant_definition_options_family_idx
  ON public.item_template_variant_definition_options(item_template_id, definition_id);
CREATE INDEX item_template_variant_definition_options_attribute_idx
  ON public.item_template_variant_definition_options(attribute_id, definition_id);
CREATE INDEX item_template_variant_definition_options_option_attribute_idx
  ON public.item_template_variant_definition_options(option_id, attribute_id);

ALTER TABLE public.company_item_variants
  ADD COLUMN variant_definition_id uuid;
ALTER TABLE public.company_item_variants
  ADD CONSTRAINT company_item_variants_variant_definition_id_fkey
  FOREIGN KEY (variant_definition_id)
  REFERENCES public.item_template_variant_definitions(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX company_item_variants_company_definition_uidx
  ON public.company_item_variants(company_item_id, variant_definition_id)
  WHERE variant_definition_id IS NOT NULL;
CREATE INDEX company_item_variants_definition_company_idx
  ON public.company_item_variants(variant_definition_id, company_id);

-- Existing commercial prices are the only safe source for initial valid combinations.
-- Abort rather than guess if a priced variant lacks canonical option identity.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.company_item_variants civ
    JOIN public.company_items ci ON ci.id=civ.company_item_id
    JOIN public.item_templates it ON it.id=ci.item_template_id
    WHERE it.is_commercial_area_material
      AND (civ.attribute_signature IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.company_item_variant_options civo WHERE civo.variant_id=civ.id
      ))
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='AMBIGUOUS_EXISTING_MATERIAL_VARIANT';
  END IF;
END $$;

INSERT INTO public.item_template_variant_definitions(
  item_template_id,attribute_signature,is_active,sort_order
)
SELECT DISTINCT ci.item_template_id,civ.attribute_signature,true,0
FROM public.company_item_variants civ
JOIN public.company_items ci ON ci.id=civ.company_item_id
JOIN public.item_templates it ON it.id=ci.item_template_id
WHERE it.is_commercial_area_material AND civ.attribute_signature IS NOT NULL
ON CONFLICT (item_template_id,attribute_signature) DO NOTHING;

INSERT INTO public.item_template_variant_definition_options(
  definition_id,item_template_id,attribute_id,option_id
)
SELECT DISTINCT d.id,d.item_template_id,civo.attribute_id,civo.option_id
FROM public.company_item_variants civ
JOIN public.company_items ci ON ci.id=civ.company_item_id
JOIN public.item_template_variant_definitions d
  ON d.item_template_id=ci.item_template_id AND d.attribute_signature=civ.attribute_signature
JOIN public.company_item_variant_options civo ON civo.variant_id=civ.id
ON CONFLICT DO NOTHING;

UPDATE public.company_item_variants civ
SET variant_definition_id=d.id
FROM public.company_items ci
JOIN public.item_template_variant_definitions d ON d.item_template_id=ci.item_template_id
WHERE ci.id=civ.company_item_id AND d.attribute_signature=civ.attribute_signature
  AND civ.variant_definition_id IS DISTINCT FROM d.id;

CREATE OR REPLACE FUNCTION public.admin_save_material_combination(
  _id uuid,
  _family_id uuid,
  _option_ids uuid[],
  _sort_order integer DEFAULT 0,
  _active boolean DEFAULT true
)
RETURNS public.item_template_variant_definitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_signature text;
  v_definition public.item_template_variant_definitions;
  v_created boolean := false;
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.item_templates
    WHERE id=_family_id AND company_id IS NULL AND is_commercial_area_material
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_FAMILY_NOT_FOUND';
  END IF;
  v_signature:=public.phase4a_material_attribute_signature(_family_id,_option_ids,true);

  IF _id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.item_template_variant_definitions
      WHERE item_template_id=_family_id AND attribute_signature=v_signature
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='DUPLICATE_MATERIAL_COMBINATION';
    END IF;
    INSERT INTO public.item_template_variant_definitions(
      item_template_id,attribute_signature,is_active,sort_order,created_by,updated_by
    ) VALUES (
      _family_id,v_signature,COALESCE(_active,true),COALESCE(_sort_order,0),auth.uid(),auth.uid()
    ) RETURNING * INTO v_definition;
    INSERT INTO public.item_template_variant_definition_options(
      definition_id,item_template_id,attribute_id,option_id
    )
    SELECT v_definition.id,_family_id,o.attribute_id,o.id
    FROM public.item_template_attribute_options o
    WHERE o.id=ANY(COALESCE(_option_ids,ARRAY[]::uuid[]));
    v_created:=true;
  ELSE
    SELECT * INTO v_definition
    FROM public.item_template_variant_definitions
    WHERE id=_id AND item_template_id=_family_id
    FOR UPDATE;
    IF v_definition.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_COMBINATION_NOT_FOUND';
    END IF;
    IF v_definition.attribute_signature<>v_signature THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='IMMUTABLE_MATERIAL_COMBINATION';
    END IF;
    UPDATE public.item_template_variant_definitions
    SET is_active=COALESCE(_active,is_active),sort_order=COALESCE(_sort_order,sort_order),
        updated_at=now(),updated_by=auth.uid()
    WHERE id=_id RETURNING * INTO v_definition;
  END IF;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),CASE WHEN v_created THEN 'create' ELSE 'update' END,
    'item_template_variant_definitions',v_definition.id,to_jsonb(v_definition),
    jsonb_build_object('source','admin_save_material_combination','family_id',_family_id));
  RETURN v_definition;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_material_combination_active(
  _definition_id uuid,
  _active boolean
)
RETURNS public.item_template_variant_definitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_definition public.item_template_variant_definitions;
  v_option_ids uuid[];
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT * INTO v_definition FROM public.item_template_variant_definitions
  WHERE id=_definition_id FOR UPDATE;
  IF v_definition.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_COMBINATION_NOT_FOUND';
  END IF;
  IF COALESCE(_active,false) THEN
    SELECT array_agg(option_id ORDER BY attribute_id) INTO v_option_ids
    FROM public.item_template_variant_definition_options WHERE definition_id=_definition_id;
    PERFORM public.phase4a_material_attribute_signature(v_definition.item_template_id,v_option_ids,true);
  END IF;
  UPDATE public.item_template_variant_definitions
  SET is_active=COALESCE(_active,false),updated_at=now(),updated_by=auth.uid()
  WHERE id=_definition_id RETURNING * INTO v_definition;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),'update','item_template_variant_definitions',v_definition.id,to_jsonb(v_definition),
    jsonb_build_object('source','admin_set_material_combination_active','active',_active));
  RETURN v_definition;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_material_families_activation(_company_id uuid)
RETURNS TABLE(
  id uuid,code text,name text,description text,pricing_basis text,pricing_unit text,
  sort_order integer,global_combinations bigint,active_combinations bigint,priced_combinations bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT it.id,it.commercial_material_family,it.name,it.description,
    COALESCE(it.pricing_basis,'AREA'),COALESCE(it.pricing_unit,it.unit),it.sort_order,
    count(DISTINCT d.id) FILTER(WHERE d.is_active),
    count(DISTINCT civ.id) FILTER(WHERE d.is_active AND civ.is_active),
    count(DISTINCT civ.id) FILTER(WHERE d.is_active AND civ.is_active
      AND civ.cost IS NOT NULL AND civ.cost>0 AND civ.sale_price IS NOT NULL AND civ.sale_price>=civ.cost)
  FROM public.item_templates it
  LEFT JOIN public.item_template_variant_definitions d ON d.item_template_id=it.id
  LEFT JOIN public.company_items ci ON ci.company_id=_company_id AND ci.item_template_id=it.id
  LEFT JOIN public.company_item_variants civ
    ON civ.company_item_id=ci.id AND civ.variant_definition_id=d.id AND civ.company_id=_company_id
  WHERE it.is_commercial_area_material AND it.is_active
    AND (it.company_id IS NULL OR it.company_id=_company_id)
  GROUP BY it.id,it.commercial_material_family,it.name,it.description,
    it.pricing_basis,it.pricing_unit,it.unit,it.sort_order
  ORDER BY it.sort_order,it.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_material_family_combinations(
  _company_id uuid,
  _family_id uuid
)
RETURNS TABLE(
  definition_id uuid,attribute_signature text,sort_order integer,option_ids uuid[],
  option_labels text[],attributes jsonb,company_variant_id uuid,company_active boolean,
  cost numeric,markup_percent numeric,sale_price numeric,status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.item_templates
    WHERE id=_family_id AND is_commercial_area_material AND is_active
      AND (company_id IS NULL OR company_id=_company_id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_FAMILY_NOT_FOUND';
  END IF;
  RETURN QUERY
  SELECT d.id,d.attribute_signature,d.sort_order,opt.option_ids,opt.option_labels,opt.attributes,
    civ.id,COALESCE(civ.is_active,false),civ.cost,civ.markup_percent,civ.sale_price,
    CASE
      WHEN civ.id IS NULL OR NOT civ.is_active THEN 'INACTIVE'
      WHEN civ.cost IS NULL OR civ.cost<=0 OR civ.sale_price IS NULL OR civ.sale_price<civ.cost THEN 'ACTIVE_UNPRICED'
      ELSE 'ACTIVE_READY'
    END
  FROM public.item_template_variant_definitions d
  JOIN LATERAL (
    SELECT array_agg(o.id ORDER BY a.sort_order,a.id) option_ids,
      array_agg(o.label ORDER BY a.sort_order,a.id) option_labels,
      jsonb_object_agg(lower(a.attribute_code),COALESCE(o.canonical_value,to_jsonb(o.option_code))) attributes
    FROM public.item_template_variant_definition_options link
    JOIN public.item_template_attributes a ON a.id=link.attribute_id
    JOIN public.item_template_attribute_options o ON o.id=link.option_id
    WHERE link.definition_id=d.id
  ) opt ON true
  LEFT JOIN public.company_items ci ON ci.company_id=_company_id AND ci.item_template_id=d.item_template_id
  LEFT JOIN public.company_item_variants civ
    ON civ.company_item_id=ci.id AND civ.variant_definition_id=d.id AND civ.company_id=_company_id
  WHERE d.item_template_id=_family_id AND d.is_active
  ORDER BY d.sort_order,opt.option_labels,d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_company_material_combination_active(
  _company_id uuid,
  _definition_id uuid,
  _active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_definition public.item_template_variant_definitions;
  v_family public.item_templates;
  v_item public.company_items;
  v_variant public.company_item_variants;
  v_attributes jsonb;
  v_before_active boolean;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT * INTO v_definition FROM public.item_template_variant_definitions WHERE id=_definition_id;
  IF v_definition.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_COMBINATION_NOT_FOUND';
  END IF;
  SELECT * INTO v_family FROM public.item_templates
  WHERE id=v_definition.item_template_id AND is_commercial_area_material
    AND (company_id IS NULL OR company_id=_company_id);
  IF v_family.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF COALESCE(_active,false) AND (NOT v_definition.is_active OR NOT v_family.is_active) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MATERIAL_COMBINATION_INACTIVE';
  END IF;

  IF NOT COALESCE(_active,false) THEN
    SELECT civ.* INTO v_variant
    FROM public.company_item_variants civ
    JOIN public.company_items ci ON ci.id=civ.company_item_id
    WHERE ci.company_id=_company_id AND ci.item_template_id=v_family.id
      AND civ.variant_definition_id=v_definition.id
    FOR UPDATE OF civ;
    IF v_variant.id IS NULL THEN
      RETURN jsonb_build_object('definition_id',v_definition.id,'company_variant_id',NULL,'status','INACTIVE');
    END IF;
    v_before_active:=v_variant.is_active;
    UPDATE public.company_item_variants SET is_active=false,updated_at=now()
    WHERE id=v_variant.id RETURNING * INTO v_variant;
    IF v_before_active THEN
      INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,new_data,metadata)
      VALUES(auth.uid(),_company_id,'update','company_item_variants',v_variant.id,to_jsonb(v_variant),
        jsonb_build_object('source','set_company_material_combination_active','active',false,
          'definition_id',v_definition.id));
    END IF;
    RETURN jsonb_build_object('definition_id',v_definition.id,'company_variant_id',v_variant.id,'status','INACTIVE');
  END IF;

  INSERT INTO public.company_items(
    company_id,item_template_id,name,description,type,unit,pricing_basis,pricing_unit,
    variant_attribute_schema,is_custom,is_active,is_commercial_area_material,commercial_material_family,
    cost,markup_percent,sale_price
  ) VALUES (
    _company_id,v_family.id,v_family.name,v_family.description,v_family.type::text,v_family.unit,
    COALESCE(v_family.pricing_basis,'AREA'),COALESCE(v_family.pricing_unit,v_family.unit),
    v_family.variant_attribute_schema,false,true,true,upper(v_family.commercial_material_family),NULL,NULL,NULL
  ) ON CONFLICT(company_id,item_template_id) DO UPDATE SET
    name=EXCLUDED.name,description=EXCLUDED.description,type=EXCLUDED.type,unit=EXCLUDED.unit,
    pricing_basis=EXCLUDED.pricing_basis,pricing_unit=EXCLUDED.pricing_unit,
    variant_attribute_schema=EXCLUDED.variant_attribute_schema,is_active=true,updated_at=now()
  RETURNING * INTO v_item;

  SELECT COALESCE(jsonb_object_agg(lower(a.attribute_code),COALESCE(o.canonical_value,to_jsonb(o.option_code))),'{}'::jsonb)
  INTO v_attributes
  FROM public.item_template_variant_definition_options link
  JOIN public.item_template_attributes a ON a.id=link.attribute_id
  JOIN public.item_template_attribute_options o ON o.id=link.option_id
  WHERE link.definition_id=v_definition.id;

  INSERT INTO public.company_item_variants(
    company_id,company_item_id,variant_definition_id,variant_type,pricing_basis,attributes,
    attribute_signature,glass_type,glass_color,glass_thickness_mm,cost,markup_percent,sale_price,is_active
  ) VALUES (
    _company_id,v_item.id,v_definition.id,upper(v_family.commercial_material_family),
    COALESCE(v_family.pricing_basis,'AREA'),v_attributes,v_definition.attribute_signature,
    v_attributes->>'type',v_attributes->>'color',
    CASE WHEN v_attributes?'thickness_mm' THEN (v_attributes->>'thickness_mm')::numeric ELSE NULL END,
    NULL,NULL,NULL,true
  ) ON CONFLICT(company_item_id,pricing_basis,attribute_signature)
    WHERE attribute_signature IS NOT NULL
  DO UPDATE SET variant_definition_id=EXCLUDED.variant_definition_id,is_active=true,
    attributes=EXCLUDED.attributes,updated_at=now()
  RETURNING * INTO v_variant;

  DELETE FROM public.company_item_variant_options WHERE variant_id=v_variant.id;
  INSERT INTO public.company_item_variant_options(variant_id,attribute_id,option_id)
  SELECT v_variant.id,attribute_id,option_id
  FROM public.item_template_variant_definition_options WHERE definition_id=v_definition.id;

  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),_company_id,CASE WHEN v_variant.created_at=v_variant.updated_at THEN 'create' ELSE 'update' END,
    'company_item_variants',v_variant.id,to_jsonb(v_variant),
    jsonb_build_object('source','set_company_material_combination_active','active',true,
      'definition_id',v_definition.id));
  RETURN jsonb_build_object('definition_id',v_definition.id,'company_variant_id',v_variant.id,
    'status',CASE WHEN v_variant.cost IS NOT NULL AND v_variant.cost>0 AND v_variant.sale_price IS NOT NULL
      AND v_variant.sale_price>=v_variant.cost THEN 'ACTIVE_READY' ELSE 'ACTIVE_UNPRICED' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_material_variant_price(
  _company_id uuid,
  _definition_id uuid,
  _cost numeric,
  _basis text,
  _value numeric
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_state jsonb;
  v_variant public.company_item_variants;
  v_markup numeric;
  v_sale numeric;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF _cost IS NULL OR _cost<=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MISSING_COST';
  END IF;
  IF upper(_basis)='MARKUP' AND _value IS NOT NULL AND _value>=0 THEN
    v_markup:=_value; v_sale:=round(_cost*(1+_value/100),4);
  ELSIF upper(_basis)='SALE_PRICE' AND _value IS NOT NULL AND _value>=_cost THEN
    v_sale:=_value; v_markup:=round(((_value/_cost)-1)*100,4);
  ELSE
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_PRICING_INPUT';
  END IF;
  v_state:=public.set_company_material_combination_active(_company_id,_definition_id,true);
  UPDATE public.company_item_variants
  SET cost=_cost,markup_percent=v_markup,sale_price=v_sale,is_active=true,updated_at=now()
  WHERE id=(v_state->>'company_variant_id')::uuid
  RETURNING * INTO v_variant;
  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),_company_id,'update','company_item_variants',v_variant.id,to_jsonb(v_variant),
    jsonb_build_object('source','save_company_material_variant_price','definition_id',_definition_id));
  RETURN v_variant;
END;
$$;

-- Compatibility contract: option IDs must now resolve to an Admin-defined global combination.
CREATE OR REPLACE FUNCTION public.save_company_material_variant(
  _company_id uuid,_family_id uuid,_option_ids uuid[],_cost numeric,_basis text,_value numeric
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_signature text;
  v_definition_id uuid;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  v_signature:=public.phase4a_material_attribute_signature(_family_id,_option_ids,true);
  SELECT id INTO v_definition_id FROM public.item_template_variant_definitions
  WHERE item_template_id=_family_id AND attribute_signature=v_signature AND is_active;
  IF v_definition_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MATERIAL_COMBINATION_NOT_CATALOGED';
  END IF;
  RETURN public.save_company_material_variant_price(
    _company_id,v_definition_id,_cost,_basis,_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_company_material_price(
  _company_id uuid,_family_id uuid,_option_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_signature text;
  v_variant public.company_item_variants;
  v_family public.item_templates;
  v_definition public.item_template_variant_definitions;
  v_company_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT * INTO v_family FROM public.item_templates
  WHERE id=_family_id AND is_commercial_area_material AND is_active
    AND (company_id IS NULL OR company_id=_company_id);
  IF v_family.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_FAMILY_NOT_FOUND';
  END IF;
  v_signature:=public.phase4a_material_attribute_signature(_family_id,_option_ids,true);
  SELECT * INTO v_definition FROM public.item_template_variant_definitions
  WHERE item_template_id=_family_id AND attribute_signature=v_signature AND is_active;
  IF v_definition.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MATERIAL_COMBINATION_NOT_CATALOGED';
  END IF;
  SELECT civ.* INTO v_variant
  FROM public.company_items ci
  JOIN public.company_item_variants civ ON civ.company_item_id=ci.id
  WHERE ci.company_id=_company_id AND ci.item_template_id=_family_id
    AND civ.company_id=_company_id AND civ.variant_definition_id=v_definition.id;
  v_company_status:=CASE
    WHEN v_variant.id IS NULL OR NOT v_variant.is_active THEN 'INACTIVE'
    WHEN v_variant.cost IS NULL OR v_variant.cost<=0 OR v_variant.sale_price IS NULL
      OR v_variant.sale_price<v_variant.cost THEN 'ACTIVE_UNPRICED'
    ELSE 'ACTIVE_READY' END;
  IF v_company_status<>'ACTIVE_READY' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MISSING_PRICE_VARIANT',
      DETAIL=jsonb_build_object('family_id',_family_id,'family',v_family.commercial_material_family,
        'definition_id',v_definition.id,'option_ids',_option_ids,'status',v_company_status)::text;
  END IF;
  RETURN jsonb_build_object(
    'family_id',_family_id,'family',v_family.commercial_material_family,
    'variant_definition_id',v_definition.id,'company_id',_company_id,
    'company_item_id',v_variant.company_item_id,'variant_id',v_variant.id,
    'signature',v_signature,'option_ids',_option_ids,'attributes',v_variant.attributes,
    'cost',v_variant.cost,'markup_percent',v_variant.markup_percent,
    'sale_price',v_variant.sale_price,'pricing_basis',v_variant.pricing_basis,
    'pricing_unit',v_family.pricing_unit,'status',v_company_status
  );
END;
$$;

ALTER TABLE public.item_template_variant_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_template_variant_definition_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY item_template_variant_definitions_select
ON public.item_template_variant_definitions FOR SELECT TO authenticated
USING (
  public.is_saas_admin((SELECT auth.uid())) OR (
    is_active AND EXISTS (
      SELECT 1 FROM public.item_templates it WHERE it.id=item_template_id AND it.is_active
        AND (it.company_id IS NULL OR public.user_belongs_to_company((SELECT auth.uid()),it.company_id))
    )
  )
);
CREATE POLICY item_template_variant_definitions_admin_manage
ON public.item_template_variant_definitions FOR ALL TO authenticated
USING (public.is_saas_admin((SELECT auth.uid())))
WITH CHECK (public.is_saas_admin((SELECT auth.uid())));

CREATE POLICY item_template_variant_definition_options_select
ON public.item_template_variant_definition_options FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.item_template_variant_definitions d
  JOIN public.item_templates it ON it.id=d.item_template_id
  WHERE d.id=definition_id AND (
    public.is_saas_admin((SELECT auth.uid())) OR (
      d.is_active AND it.is_active AND
      (it.company_id IS NULL OR public.user_belongs_to_company((SELECT auth.uid()),it.company_id))
    )
  )
));
CREATE POLICY item_template_variant_definition_options_admin_manage
ON public.item_template_variant_definition_options FOR ALL TO authenticated
USING (public.is_saas_admin((SELECT auth.uid())))
WITH CHECK (public.is_saas_admin((SELECT auth.uid())));

REVOKE ALL ON TABLE public.item_template_variant_definitions,
  public.item_template_variant_definition_options FROM anon,authenticated;
GRANT SELECT ON TABLE public.item_template_variant_definitions,
  public.item_template_variant_definition_options TO authenticated;
GRANT ALL ON TABLE public.item_template_variant_definitions,
  public.item_template_variant_definition_options TO service_role;

REVOKE ALL ON FUNCTION public.admin_save_material_combination(uuid,uuid,uuid[],integer,boolean),
  public.admin_set_material_combination_active(uuid,boolean),
  public.list_company_material_families_activation(uuid),
  public.list_company_material_family_combinations(uuid,uuid),
  public.set_company_material_combination_active(uuid,uuid,boolean),
  public.save_company_material_variant_price(uuid,uuid,numeric,text,numeric),
  public.save_company_material_variant(uuid,uuid,uuid[],numeric,text,numeric),
  public.resolve_company_material_price(uuid,uuid,uuid[]) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.admin_save_material_combination(uuid,uuid,uuid[],integer,boolean),
  public.admin_set_material_combination_active(uuid,boolean),
  public.list_company_material_families_activation(uuid),
  public.list_company_material_family_combinations(uuid,uuid),
  public.set_company_material_combination_active(uuid,uuid,boolean),
  public.save_company_material_variant_price(uuid,uuid,numeric,text,numeric),
  public.save_company_material_variant(uuid,uuid,uuid[],numeric,text,numeric),
  public.resolve_company_material_price(uuid,uuid,uuid[]) TO authenticated,service_role;

COMMENT ON TABLE public.item_template_variant_definitions IS
  'Global or future-private valid material combinations. Never stores tenant prices.';
COMMENT ON COLUMN public.company_item_variants.variant_definition_id IS
  'Canonical global/private combination selected by this tenant; price remains tenant-owned.';
