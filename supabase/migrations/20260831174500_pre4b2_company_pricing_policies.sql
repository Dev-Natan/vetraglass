-- Pre-4B.2 commercial policy layer.
-- Global catalog rows remain technical suggestions. Operational cost, price,
-- stock and policy are always tenant-owned.

CREATE TABLE IF NOT EXISTS public.company_pricing_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.item_types(id) ON DELETE RESTRICT,
  markup_percent numeric NOT NULL CHECK (markup_percent >= 0),
  apply_automatically boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_pricing_policies_category_key
  ON public.company_pricing_policies(company_id,category_id)
  WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS company_pricing_policies_default_key
  ON public.company_pricing_policies(company_id)
  WHERE category_id IS NULL;
CREATE INDEX IF NOT EXISTS company_pricing_policies_company_idx
  ON public.company_pricing_policies(company_id);

ALTER TABLE public.company_pricing_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_pricing_policies_select ON public.company_pricing_policies;
CREATE POLICY company_pricing_policies_select
ON public.company_pricing_policies FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()),company_id));

REVOKE ALL ON TABLE public.company_pricing_policies FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.company_pricing_policies TO authenticated;

ALTER TABLE public.company_items
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS markup_override_percent numeric,
  ADD COLUMN IF NOT EXISTS pricing_source text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS pricing_calculated_at timestamptz;

ALTER TABLE public.company_items
  DROP CONSTRAINT IF EXISTS company_items_pricing_mode_check,
  DROP CONSTRAINT IF EXISTS company_items_markup_override_check,
  DROP CONSTRAINT IF EXISTS company_items_pricing_source_check;
ALTER TABLE public.company_items
  ADD CONSTRAINT company_items_pricing_mode_check
    CHECK (pricing_mode IN ('AUTO','MANUAL')),
  ADD CONSTRAINT company_items_markup_override_check
    CHECK (markup_override_percent IS NULL OR markup_override_percent >= 0),
  ADD CONSTRAINT company_items_pricing_source_check
    CHECK (pricing_source IN ('UNPRICED','MANUAL','ITEM_OVERRIDE','CATEGORY_POLICY','COMPANY_DEFAULT'));

ALTER TABLE public.company_item_variants
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS markup_override_percent numeric,
  ADD COLUMN IF NOT EXISTS pricing_source text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS pricing_calculated_at timestamptz;

ALTER TABLE public.company_item_variants
  DROP CONSTRAINT IF EXISTS company_item_variants_pricing_mode_check,
  DROP CONSTRAINT IF EXISTS company_item_variants_markup_override_check,
  DROP CONSTRAINT IF EXISTS company_item_variants_pricing_source_check;
ALTER TABLE public.company_item_variants
  ADD CONSTRAINT company_item_variants_pricing_mode_check
    CHECK (pricing_mode IN ('AUTO','MANUAL')),
  ADD CONSTRAINT company_item_variants_markup_override_check
    CHECK (markup_override_percent IS NULL OR markup_override_percent >= 0),
  ADD CONSTRAINT company_item_variants_pricing_source_check
    CHECK (pricing_source IN ('UNPRICED','MANUAL','ITEM_OVERRIDE','CATEGORY_POLICY','COMPANY_DEFAULT'));

-- Adding the columns with MANUAL defaults preserves every existing tenant row
-- without a data rewrite. Only future rows use automatic pricing by default.
ALTER TABLE public.company_items
  ALTER COLUMN pricing_mode SET DEFAULT 'AUTO',
  ALTER COLUMN pricing_source SET DEFAULT 'UNPRICED';
ALTER TABLE public.company_item_variants
  ALTER COLUMN pricing_mode SET DEFAULT 'AUTO',
  ALTER COLUMN pricing_source SET DEFAULT 'UNPRICED';

-- New operational unit contracts use weighted-average cost. Existing rows are
-- deliberately untouched.
ALTER TABLE public.inventory_item_units
  ALTER COLUMN cost_policy SET DEFAULT 'WEIGHTED_AVERAGE';

CREATE OR REPLACE FUNCTION public.pre4b2_prepare_global_company_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=''
AS $$
BEGIN
  IF NEW.item_template_id IS NOT NULL AND COALESCE(NEW.catalog_origin,'GLOBAL')='GLOBAL' THEN
    -- NULL means "inherit the current SaaS suggestion". A later tenant edit
    -- writes an override without changing the global template.
    NEW.bar_length_mm:=NULL;
    NEW.weight_per_meter:=NULL;
    NEW.weight_kg:=NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre4b2_prepare_global_company_item ON public.company_items;
CREATE TRIGGER trg_pre4b2_prepare_global_company_item
BEFORE INSERT ON public.company_items
FOR EACH ROW EXECUTE FUNCTION public.pre4b2_prepare_global_company_item();

REVOKE ALL ON FUNCTION public.pre4b2_prepare_global_company_item() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.pre4b2_item_category_id(_company_item_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path=''
AS $$
  SELECT COALESCE(it.category_id,(
    SELECT ty.id FROM public.item_types ty
    WHERE lower(ty.slug)=lower(ci.type) AND COALESCE(ty.is_active,true)
    ORDER BY ty.sort_order,ty.id LIMIT 1
  ))
  FROM public.company_items ci
  LEFT JOIN public.item_templates it ON it.id=ci.item_template_id
  WHERE ci.id=_company_item_id
$$;

CREATE OR REPLACE FUNCTION public.pre4b2_effective_bar_length_mm(_company_item_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path=''
AS $$
  SELECT COALESCE(NULLIF(ci.bar_length_mm,0),NULLIF(it.bar_length_mm,0),NULLIF(iu.nominal_length_mm,0))
  FROM public.company_items ci
  LEFT JOIN public.item_templates it ON it.id=ci.item_template_id
  LEFT JOIN public.inventory_item_units iu ON iu.company_item_id=ci.id AND iu.company_id=ci.company_id
  WHERE ci.id=_company_item_id
$$;

CREATE OR REPLACE FUNCTION public.pre4b2_effective_weight_per_meter(_company_item_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path=''
AS $$
  SELECT COALESCE(NULLIF(ci.weight_per_meter,0),NULLIF(it.weight_per_meter,0))
  FROM public.company_items ci
  LEFT JOIN public.item_templates it ON it.id=ci.item_template_id
  WHERE ci.id=_company_item_id
$$;

CREATE OR REPLACE FUNCTION public.phase3f_unit_factor(
  _company_item_id uuid,_unit text,_width_mm numeric DEFAULT NULL,_height_mm numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_config public.inventory_item_units;
  v_unit text:=public.phase3f_normalize_unit(_unit);
  v_weight_per_meter numeric;
  v_length numeric;
BEGIN
  SELECT * INTO v_config FROM public.inventory_item_units WHERE company_item_id=_company_item_id;
  IF v_config.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION'; END IF;
  IF v_config.legacy_status='AMBIGUOUS' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='AMBIGUOUS_LEGACY_STOCK'; END IF;
  IF v_unit IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_UNIT',DETAIL=COALESCE(_unit,'NULL'); END IF;

  IF v_config.physical_dimension='LENGTH' AND v_config.canonical_unit='MM' THEN
    v_weight_per_meter:=public.pre4b2_effective_weight_per_meter(_company_item_id);
    v_length:=public.pre4b2_effective_bar_length_mm(_company_item_id);
    IF v_unit='MM' THEN RETURN 1; END IF;
    IF v_unit='M' THEN RETURN 1000; END IF;
    IF v_unit='BAR' THEN
      IF COALESCE(v_length,0)<=0 THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_NOMINAL_LENGTH'; END IF;
      RETURN v_length;
    END IF;
    IF v_unit IN ('KG','G') THEN
      IF COALESCE(v_weight_per_meter,0)<=0 THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_LINEAR_WEIGHT'; END IF;
      IF v_unit='KG' THEN RETURN 1000/v_weight_per_meter; END IF;
      RETURN 1/v_weight_per_meter;
    END IF;
  END IF;
  IF v_unit='SHEET' THEN
    IF COALESCE(_width_mm,0)<=0 OR COALESCE(_height_mm,0)<=0 OR v_config.canonical_unit<>'MM2' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_DIMENSIONS';
    END IF;
    RETURN _width_mm*_height_mm;
  END IF;
  IF v_unit=public.phase3f_normalize_unit(v_config.purchase_unit) THEN
    IF v_config.purchase_to_canonical_factor IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION'; END IF;
    RETURN v_config.purchase_to_canonical_factor;
  ELSIF v_unit=public.phase3f_normalize_unit(v_config.stock_unit) THEN
    IF v_config.stock_to_canonical_factor IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION'; END IF;
    RETURN v_config.stock_to_canonical_factor;
  ELSIF v_unit=public.phase3f_normalize_unit(v_config.consumption_unit) THEN
    IF v_config.consumption_to_canonical_factor IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION'; END IF;
    RETURN v_config.consumption_to_canonical_factor;
  ELSIF v_unit=v_config.canonical_unit THEN RETURN 1;
  END IF;
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_UNIT',DETAIL=format('%s is not configured for company_item %s',_unit,_company_item_id);
END;
$$;
REVOKE ALL ON FUNCTION public.phase3f_unit_factor(uuid,text,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase3f_unit_factor(uuid,text,numeric,numeric) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.pre4b2_effective_cost(
  _company_id uuid,_company_item_id uuid,_variant_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_policy text;
  v_sale_unit text;
  v_factor numeric;
  v_cost numeric;
BEGIN
  SELECT iu.cost_policy,COALESCE(iu.sale_unit,iu.consumption_unit)
  INTO v_policy,v_sale_unit
  FROM public.inventory_item_units iu
  WHERE iu.company_id=_company_id AND iu.company_item_id=_company_item_id;

  IF v_policy IS NULL OR v_policy='MANUAL' THEN
    IF _variant_id IS NOT NULL THEN
      SELECT COALESCE(civ.cost,ci.cost) INTO v_cost
      FROM public.company_items ci LEFT JOIN public.company_item_variants civ
        ON civ.id=_variant_id AND civ.company_id=ci.company_id AND civ.company_item_id=ci.id
      WHERE ci.id=_company_item_id AND ci.company_id=_company_id;
    ELSE
      SELECT cost INTO v_cost FROM public.company_items WHERE id=_company_item_id AND company_id=_company_id;
    END IF;
    RETURN NULLIF(v_cost,0);
  END IF;

  v_factor:=public.phase3f_unit_factor(_company_item_id,v_sale_unit,NULL,NULL);
  IF v_policy='LAST_PURCHASE' THEN
    SELECT sm.unit_cost INTO v_cost
    FROM public.stock_movements sm
    WHERE sm.company_id=_company_id AND sm.company_item_id=_company_item_id
      AND sm.type='entrada' AND sm.unit_cost IS NOT NULL
      AND sm.variant_id IS NOT DISTINCT FROM _variant_id
    ORDER BY sm.created_at DESC,sm.id DESC LIMIT 1;
    RETURN NULLIF(v_cost,0);
  END IF;

  SELECT CASE WHEN sum(pb.canonical_quantity)>0
                   AND NOT bool_or(pb.inventory_value IS NULL AND pb.canonical_quantity>0)
              THEN sum(pb.inventory_value)/sum(pb.canonical_quantity)*v_factor END
  INTO v_cost
  FROM public.physical_stock_balances pb
  WHERE pb.company_id=_company_id AND pb.company_item_id=_company_item_id
    AND (_variant_id IS NULL OR pb.variant_id IS NOT DISTINCT FROM _variant_id);
  RETURN NULLIF(v_cost,0);
END;
$$;

CREATE OR REPLACE FUNCTION public.pre4b2_effective_markup(
  _company_id uuid,_company_item_id uuid,_variant_id uuid DEFAULT NULL
)
RETURNS TABLE(markup_percent numeric,pricing_source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  WITH target AS (
    SELECT ci.markup_override_percent item_override,
      civ.markup_override_percent variant_override,
      public.pre4b2_item_category_id(ci.id) category_id
    FROM public.company_items ci
    LEFT JOIN public.company_item_variants civ
      ON civ.id=_variant_id AND civ.company_id=ci.company_id AND civ.company_item_id=ci.id
    WHERE ci.id=_company_item_id AND ci.company_id=_company_id
  ), policy AS (
    SELECT p.markup_percent,p.category_id
    FROM public.company_pricing_policies p,target t
    WHERE p.company_id=_company_id AND p.is_active
      AND (p.category_id=t.category_id OR p.category_id IS NULL)
    ORDER BY p.category_id NULLS LAST LIMIT 1
  )
  SELECT COALESCE(t.variant_override,t.item_override,p.markup_percent),
    CASE WHEN t.variant_override IS NOT NULL OR t.item_override IS NOT NULL THEN 'ITEM_OVERRIDE'
         WHEN p.category_id IS NOT NULL THEN 'CATEGORY_POLICY'
         WHEN p.markup_percent IS NOT NULL THEN 'COMPANY_DEFAULT'
         ELSE 'UNPRICED' END
  FROM target t LEFT JOIN policy p ON true
$$;

CREATE OR REPLACE FUNCTION public.pre4b2_reprice_company_item(
  _company_id uuid,_company_item_id uuid,_variant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_mode text; v_cost numeric; v_markup numeric; v_source text; v_sale numeric;
BEGIN
  IF _variant_id IS NULL THEN
    SELECT pricing_mode INTO v_mode FROM public.company_items WHERE id=_company_item_id AND company_id=_company_id FOR UPDATE;
  ELSE
    SELECT pricing_mode INTO v_mode FROM public.company_item_variants
    WHERE id=_variant_id AND company_id=_company_id AND company_item_id=_company_item_id FOR UPDATE;
  END IF;
  IF v_mode IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MISSING_COMPANY_ITEM'; END IF;
  IF v_mode='MANUAL' THEN
    RETURN jsonb_build_object('pricing_mode','MANUAL','pricing_source','MANUAL');
  END IF;
  v_cost:=public.pre4b2_effective_cost(_company_id,_company_item_id,_variant_id);
  SELECT e.markup_percent,e.pricing_source INTO v_markup,v_source
  FROM public.pre4b2_effective_markup(_company_id,_company_item_id,_variant_id) e;
  v_sale:=CASE WHEN v_cost IS NOT NULL AND v_markup IS NOT NULL THEN round(v_cost*(1+v_markup/100),4) END;
  IF _variant_id IS NULL THEN
    UPDATE public.company_items SET cost=v_cost,markup_percent=v_markup,sale_price=v_sale,
      pricing_source=v_source,pricing_calculated_at=now(),updated_at=now()
    WHERE id=_company_item_id AND company_id=_company_id;
  ELSE
    UPDATE public.company_item_variants SET cost=v_cost,markup_percent=v_markup,sale_price=v_sale,
      pricing_source=v_source,pricing_calculated_at=now(),updated_at=now()
    WHERE id=_variant_id AND company_id=_company_id AND company_item_id=_company_item_id;
  END IF;
  RETURN jsonb_build_object('pricing_mode','AUTO','pricing_source',v_source,'cost',v_cost,
    'markup_percent',v_markup,'sale_price',v_sale);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_pricing_policy(
  _company_id uuid,_category_id uuid,_markup_percent numeric,
  _apply_automatically boolean DEFAULT true,_is_active boolean DEFAULT true
)
RETURNS public.company_pricing_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_policy public.company_pricing_policies; v_item record; v_variant record;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF _markup_percent IS NULL OR _markup_percent<0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_MARKUP';
  END IF;
  IF _category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.item_types WHERE id=_category_id) THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='INVALID_CATEGORY';
  END IF;
  SELECT * INTO v_policy FROM public.company_pricing_policies
  WHERE company_id=_company_id AND category_id IS NOT DISTINCT FROM _category_id FOR UPDATE;
  IF v_policy.id IS NULL THEN
    INSERT INTO public.company_pricing_policies(company_id,category_id,markup_percent,apply_automatically,is_active)
    VALUES(_company_id,_category_id,_markup_percent,COALESCE(_apply_automatically,true),COALESCE(_is_active,true))
    RETURNING * INTO v_policy;
  ELSE
    UPDATE public.company_pricing_policies SET markup_percent=_markup_percent,
      apply_automatically=COALESCE(_apply_automatically,true),is_active=COALESCE(_is_active,true),updated_at=now()
    WHERE id=v_policy.id RETURNING * INTO v_policy;
  END IF;
  IF v_policy.apply_automatically THEN
    FOR v_item IN SELECT ci.id FROM public.company_items ci
      WHERE ci.company_id=_company_id AND ci.pricing_mode='AUTO'
        AND (_category_id IS NULL OR public.pre4b2_item_category_id(ci.id)=_category_id)
    LOOP
      PERFORM public.pre4b2_reprice_company_item(_company_id,v_item.id,NULL);
      FOR v_variant IN SELECT id FROM public.company_item_variants
        WHERE company_id=_company_id AND company_item_id=v_item.id AND pricing_mode='AUTO'
      LOOP
        PERFORM public.pre4b2_reprice_company_item(_company_id,v_item.id,v_variant.id);
      END LOOP;
    END LOOP;
  END IF;
  RETURN v_policy;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_company_item_pricing_mode(
  _company_id uuid,_company_item_id uuid,_variant_id uuid DEFAULT NULL,
  _mode text DEFAULT 'AUTO',_markup_override numeric DEFAULT NULL,_manual_sale_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_mode text:=upper(btrim(_mode)); v_cost numeric; v_markup numeric;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF v_mode NOT IN ('AUTO','MANUAL') OR (_markup_override IS NOT NULL AND _markup_override<0) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICING_INPUT';
  END IF;
  IF v_mode='MANUAL' AND COALESCE(_manual_sale_price,0)<=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MISSING_PRICE';
  END IF;
  v_cost:=public.pre4b2_effective_cost(_company_id,_company_item_id,_variant_id);
  IF _variant_id IS NULL THEN
    IF v_mode='MANUAL' THEN
      v_markup:=CASE WHEN COALESCE(v_cost,0)>0 THEN round(((_manual_sale_price/v_cost)-1)*100,4) END;
      UPDATE public.company_items SET pricing_mode='MANUAL',markup_override_percent=NULL,
        cost=COALESCE(v_cost,cost),markup_percent=v_markup,sale_price=_manual_sale_price,
        pricing_source='MANUAL',pricing_calculated_at=now(),updated_at=now()
      WHERE id=_company_item_id AND company_id=_company_id;
    ELSE
      UPDATE public.company_items SET pricing_mode='AUTO',markup_override_percent=_markup_override,updated_at=now()
      WHERE id=_company_item_id AND company_id=_company_id;
    END IF;
  ELSE
    IF v_mode='MANUAL' THEN
      v_markup:=CASE WHEN COALESCE(v_cost,0)>0 THEN round(((_manual_sale_price/v_cost)-1)*100,4) END;
      UPDATE public.company_item_variants SET pricing_mode='MANUAL',markup_override_percent=NULL,
        cost=COALESCE(v_cost,cost),markup_percent=v_markup,sale_price=_manual_sale_price,
        pricing_source='MANUAL',pricing_calculated_at=now(),updated_at=now()
      WHERE id=_variant_id AND company_id=_company_id AND company_item_id=_company_item_id;
    ELSE
      UPDATE public.company_item_variants SET pricing_mode='AUTO',markup_override_percent=_markup_override,updated_at=now()
      WHERE id=_variant_id AND company_id=_company_id AND company_item_id=_company_item_id;
    END IF;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MISSING_COMPANY_ITEM'; END IF;
  IF v_mode='AUTO' THEN RETURN public.pre4b2_reprice_company_item(_company_id,_company_item_id,_variant_id); END IF;
  RETURN jsonb_build_object('pricing_mode','MANUAL','pricing_source','MANUAL','cost',v_cost,
    'markup_percent',v_markup,'sale_price',_manual_sale_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_item_technical_overrides(
  _company_id uuid,_company_item_id uuid,_bar_length_mm numeric DEFAULT NULL,
  _weight_per_meter numeric DEFAULT NULL,_restore_bar_length boolean DEFAULT false,
  _restore_weight boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF (_bar_length_mm IS NOT NULL AND _bar_length_mm<=0) OR (_weight_per_meter IS NOT NULL AND _weight_per_meter<=0) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_TECHNICAL_OVERRIDE';
  END IF;
  UPDATE public.company_items SET
    bar_length_mm=CASE WHEN _restore_bar_length THEN NULL ELSE COALESCE(_bar_length_mm,bar_length_mm) END,
    weight_per_meter=CASE WHEN _restore_weight THEN NULL ELSE COALESCE(_weight_per_meter,weight_per_meter) END,
    updated_at=now()
  WHERE id=_company_item_id AND company_id=_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MISSING_COMPANY_ITEM'; END IF;
  RETURN jsonb_build_object('bar_length_mm',public.pre4b2_effective_bar_length_mm(_company_item_id),
    'weight_per_meter',public.pre4b2_effective_weight_per_meter(_company_item_id),
    'bar_source',CASE WHEN (SELECT bar_length_mm FROM public.company_items WHERE id=_company_item_id) IS NULL THEN 'GLOBAL' ELSE 'TENANT' END,
    'weight_source',CASE WHEN (SELECT weight_per_meter FROM public.company_items WHERE id=_company_item_id) IS NULL THEN 'GLOBAL' ELSE 'TENANT' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_pricing_categories(_company_id uuid)
RETURNS TABLE(category_id uuid,category_code text,category_name text,item_count bigint,
  markup_percent numeric,apply_automatically boolean,is_active boolean,margin_percent numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT ty.id,ty.slug::text,ty.name::text,count(ci.id),p.markup_percent,
    COALESCE(p.apply_automatically,true),COALESCE(p.is_active,false),
    CASE WHEN p.markup_percent IS NOT NULL THEN round(p.markup_percent/(100+p.markup_percent)*100,4) END
  FROM public.item_types ty
  LEFT JOIN public.company_items ci ON ci.company_id=_company_id AND ci.is_active
    AND public.pre4b2_item_category_id(ci.id)=ty.id
  LEFT JOIN public.company_pricing_policies p ON p.company_id=_company_id AND p.category_id=ty.id
  WHERE COALESCE(ty.is_active,true)
  GROUP BY ty.id,ty.slug,ty.name,ty.sort_order,p.markup_percent,p.apply_automatically,p.is_active
  HAVING count(ci.id)>0
  ORDER BY ty.sort_order,ty.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_pricing_items(_company_id uuid,_category_id uuid)
RETURNS TABLE(company_item_id uuid,variant_id uuid,item_code text,item_name text,variant_name text,
  catalog_origin text,cost_policy text,pricing_mode text,effective_cost numeric,markup_percent numeric,
  sale_price numeric,pricing_source text,pricing_unit text,bar_length_mm numeric,weight_per_meter numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT ci.id,civ.id,COALESCE(ci.code,it.specifications->>'code'),ci.name,
    COALESCE(cc.name,civ.profile_color,civ.glass_color),ci.catalog_origin,iu.cost_policy,
    COALESCE(civ.pricing_mode,ci.pricing_mode),
    public.pre4b2_effective_cost(_company_id,ci.id,civ.id),
    COALESCE(civ.markup_percent,ci.markup_percent),COALESCE(civ.sale_price,ci.sale_price),
    COALESCE(civ.pricing_source,ci.pricing_source),COALESCE(ci.pricing_unit,iu.sale_unit,ci.unit),
    public.pre4b2_effective_bar_length_mm(ci.id),public.pre4b2_effective_weight_per_meter(ci.id)
  FROM public.company_items ci
  LEFT JOIN public.item_templates it ON it.id=ci.item_template_id
  JOIN public.inventory_item_units iu ON iu.company_id=ci.company_id AND iu.company_item_id=ci.id
  LEFT JOIN public.company_item_variants civ ON civ.company_id=ci.company_id AND civ.company_item_id=ci.id AND civ.is_active
  LEFT JOIN public.company_colors cc ON cc.id=civ.company_color_id AND cc.company_id=civ.company_id
  WHERE ci.company_id=_company_id AND ci.is_active
    AND public.pre4b2_item_category_id(ci.id)=_category_id
  ORDER BY ci.name,variant_name NULLS FIRST;
END;
$$;

-- Existing pricing RPCs remain the compatibility surface, now recording the
-- explicit source semantics.
CREATE OR REPLACE FUNCTION public.save_company_item_pricing(
  _company_id uuid,_company_item_id uuid,_cost numeric,_basis text,_value numeric,_pricing_unit text DEFAULT NULL
)
RETURNS public.company_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_result public.company_items; v_basis text:=upper(btrim(_basis));
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED'; END IF;
  IF _cost IS NULL OR _cost<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MISSING_COST'; END IF;
  IF v_basis='MARKUP' AND _value IS NOT NULL AND _value>=0 THEN
    UPDATE public.company_items SET cost=_cost,pricing_mode='AUTO',markup_override_percent=_value,
      markup_percent=_value,sale_price=round(_cost*(1+_value/100),4),pricing_source='ITEM_OVERRIDE',
      pricing_calculated_at=now(),pricing_unit=COALESCE(NULLIF(btrim(_pricing_unit),''),pricing_unit)
    WHERE id=_company_item_id AND company_id=_company_id RETURNING * INTO v_result;
  ELSIF v_basis='SALE_PRICE' AND _value IS NOT NULL AND _value>0 THEN
    UPDATE public.company_items SET cost=_cost,pricing_mode='MANUAL',markup_override_percent=NULL,
      sale_price=_value,markup_percent=round(((_value/_cost)-1)*100,4),pricing_source='MANUAL',
      pricing_calculated_at=now(),pricing_unit=COALESCE(NULLIF(btrim(_pricing_unit),''),pricing_unit)
    WHERE id=_company_item_id AND company_id=_company_id RETURNING * INTO v_result;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICING_INPUT'; END IF;
  IF v_result.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MISSING_COMPANY_ITEM'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_material_variant_price(
  _company_id uuid,_definition_id uuid,_cost numeric,_basis text,_value numeric
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_state jsonb; v_variant public.company_item_variants; v_markup numeric; v_sale numeric; v_mode text; v_source text;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED'; END IF;
  IF _cost IS NULL OR _cost<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MISSING_COST'; END IF;
  IF upper(_basis)='MARKUP' AND _value IS NOT NULL AND _value>=0 THEN
    v_markup:=_value;v_sale:=round(_cost*(1+_value/100),4);v_mode:='AUTO';v_source:='ITEM_OVERRIDE';
  ELSIF upper(_basis)='SALE_PRICE' AND _value IS NOT NULL AND _value>=_cost THEN
    v_sale:=_value;v_markup:=round(((_value/_cost)-1)*100,4);v_mode:='MANUAL';v_source:='MANUAL';
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICING_INPUT'; END IF;
  v_state:=public.set_company_material_combination_active(_company_id,_definition_id,true);
  UPDATE public.company_item_variants SET cost=_cost,markup_percent=v_markup,sale_price=v_sale,
    pricing_mode=v_mode,markup_override_percent=CASE WHEN v_mode='AUTO' THEN v_markup END,
    pricing_source=v_source,pricing_calculated_at=now(),is_active=true,updated_at=now()
  WHERE id=(v_state->>'company_variant_id')::uuid RETURNING * INTO v_variant;
  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),_company_id,'update','company_item_variants',v_variant.id,to_jsonb(v_variant),
    jsonb_build_object('source','save_company_material_variant_price','definition_id',_definition_id));
  RETURN v_variant;
END;
$$;

-- Opt-in wrapper used by the new UI. The proven physical writer remains
-- untouched; this wrapper only synchronizes tenant commercial state after a
-- successful canonical movement in the same transaction.
CREATE OR REPLACE FUNCTION public.record_tenant_stock_movement_with_pricing(
  _company_id uuid,_company_item_id uuid,_direction text,_original_quantity numeric,
  _original_unit text,_reason text,_company_color_id uuid DEFAULT NULL,
  _variant_id uuid DEFAULT NULL,_conversion_factor numeric DEFAULT NULL,
  _total_cost numeric DEFAULT NULL,_new_sale_price numeric DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,_lot_code text DEFAULT '',
  _supplier_name text DEFAULT NULL,_document_reference text DEFAULT NULL,
  _width_mm numeric DEFAULT NULL,_height_mm numeric DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_result jsonb; v_resolved_variant_id uuid; v_cost_policy text; v_mode text;
BEGIN
  v_result:=public.record_tenant_stock_movement(
    _company_id,_company_item_id,_direction,_original_quantity,_original_unit,_reason,
    _company_color_id,_variant_id,_conversion_factor,_total_cost,NULL,_idempotency_key,
    _lot_code,_supplier_name,_document_reference,_width_mm,_height_mm,_metadata
  );
  v_resolved_variant_id:=NULLIF(v_result->>'variant_id','')::uuid;

  IF upper(btrim(_direction))='IN' AND _total_cost IS NOT NULL THEN
    SELECT cost_policy INTO v_cost_policy FROM public.inventory_item_units
    WHERE company_id=_company_id AND company_item_id=_company_item_id;
    IF v_cost_policy<>'MANUAL' THEN
      IF v_resolved_variant_id IS NULL THEN
        SELECT pricing_mode INTO v_mode FROM public.company_items
        WHERE id=_company_item_id AND company_id=_company_id;
      ELSE
        SELECT pricing_mode INTO v_mode FROM public.company_item_variants
        WHERE id=v_resolved_variant_id AND company_id=_company_id AND company_item_id=_company_item_id;
      END IF;
      IF v_mode='AUTO' THEN
        PERFORM public.pre4b2_reprice_company_item(_company_id,_company_item_id,v_resolved_variant_id);
      END IF;
    END IF;
  END IF;

  IF _new_sale_price IS NOT NULL THEN
    IF _new_sale_price<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRICE'; END IF;
    IF v_resolved_variant_id IS NULL THEN
      UPDATE public.company_items SET sale_price=_new_sale_price,pricing_mode='MANUAL',
        markup_override_percent=NULL,pricing_source='MANUAL',pricing_calculated_at=now(),updated_at=now()
      WHERE id=_company_item_id AND company_id=_company_id;
    ELSE
      UPDATE public.company_item_variants SET sale_price=_new_sale_price,pricing_mode='MANUAL',
        markup_override_percent=NULL,pricing_source='MANUAL',pricing_calculated_at=now(),updated_at=now()
      WHERE id=v_resolved_variant_id AND company_id=_company_id AND company_item_id=_company_item_id;
    END IF;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.pre4b2_item_category_id(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pre4b2_effective_bar_length_mm(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pre4b2_effective_weight_per_meter(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pre4b2_effective_cost(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pre4b2_effective_markup(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pre4b2_reprice_company_item(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.save_company_pricing_policy(uuid,uuid,numeric,boolean,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_company_item_pricing_mode(uuid,uuid,uuid,text,numeric,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_company_item_technical_overrides(uuid,uuid,numeric,numeric,boolean,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_company_pricing_categories(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_company_pricing_items(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.record_tenant_stock_movement_with_pricing(uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_company_pricing_policy(uuid,uuid,numeric,boolean,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_company_item_pricing_mode(uuid,uuid,uuid,text,numeric,numeric) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_company_item_technical_overrides(uuid,uuid,numeric,numeric,boolean,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_company_pricing_categories(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_company_pricing_items(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_tenant_stock_movement_with_pricing(uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb) TO authenticated,service_role;

COMMENT ON TABLE public.company_pricing_policies IS 'Tenant-scoped markup policy. Global templates never own operational markup or price.';
COMMENT ON COLUMN public.inventory_item_units.cost_policy IS 'Tenant-owned cost authority: MANUAL, LAST_PURCHASE or WEIGHTED_AVERAGE.';
NOTIFY pgrst,'reload schema';
