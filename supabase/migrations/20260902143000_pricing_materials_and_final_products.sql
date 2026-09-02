-- Vetra pricing: one tenant authority for materials and final products.
-- Existing product-specific price lines remain PRODUCT_VARIANT; line bands reuse
-- the same price authority and store only normalized coverage in the child table.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS composition_labor_percent numeric NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.companies
    ADD CONSTRAINT companies_composition_labor_percent_check
    CHECK (composition_labor_percent >= 0 AND composition_labor_percent <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.company_products
  ADD COLUMN IF NOT EXISTS product_line_id uuid REFERENCES public.product_linhas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS commercial_pricing_method text;

UPDATE public.company_products cp
SET product_line_id = pl.id
FROM public.product_linhas pl
WHERE cp.product_line_id IS NULL
  AND cp.linha = pl.slug;

DO $$ BEGIN
  ALTER TABLE public.company_products
    ADD CONSTRAINT company_products_commercial_pricing_method_check
    CHECK (commercial_pricing_method IS NULL OR commercial_pricing_method IN ('COMPOSITION','LINE_PRICE_PER_M2'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS company_products_product_line_idx
  ON public.company_products(company_id, product_line_id)
  WHERE product_line_id IS NOT NULL;

ALTER TABLE public.company_product_price_lines
  ALTER COLUMN company_product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.product_linhas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS pricing_scope text NOT NULL DEFAULT 'PRODUCT_VARIANT';

UPDATE public.company_product_price_lines
SET pricing_scope = 'PRODUCT_VARIANT'
WHERE pricing_scope IS NULL;

DO $$ BEGIN
  ALTER TABLE public.company_product_price_lines
    ADD CONSTRAINT company_product_price_lines_scope_check
    CHECK (
      (pricing_scope = 'PRODUCT_VARIANT' AND company_product_id IS NOT NULL AND line_id IS NULL)
      OR
      (pricing_scope = 'LINE_BAND' AND company_product_id IS NULL AND line_id IS NOT NULL AND lower(unit) = 'm2')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS company_product_price_lines_line_idx
  ON public.company_product_price_lines(company_id, line_id, is_active)
  WHERE pricing_scope = 'LINE_BAND';

CREATE UNIQUE INDEX IF NOT EXISTS company_product_price_lines_scope_identity_key
  ON public.company_product_price_lines(id, company_id, line_id);

CREATE TABLE IF NOT EXISTS public.company_product_price_line_combinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  line_id uuid NOT NULL REFERENCES public.product_linhas(id) ON DELETE RESTRICT,
  price_line_id uuid NOT NULL,
  glass_variant_definition_id uuid NOT NULL REFERENCES public.item_template_variant_definitions(id) ON DELETE RESTRICT,
  company_color_id uuid NOT NULL,
  profile_finish text NOT NULL DEFAULT 'PADRAO',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_product_price_line_combinations_parent_fkey
    FOREIGN KEY (price_line_id, company_id, line_id)
    REFERENCES public.company_product_price_lines(id, company_id, line_id)
    ON DELETE CASCADE,
  CONSTRAINT company_product_price_line_combinations_color_fkey
    FOREIGN KEY (company_color_id, company_id)
    REFERENCES public.company_colors(id, company_id)
    ON DELETE RESTRICT,
  CONSTRAINT company_product_price_line_combinations_finish_check
    CHECK (profile_finish = upper(btrim(profile_finish)) AND btrim(profile_finish) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS company_product_price_line_combinations_coverage_key
  ON public.company_product_price_line_combinations(
    company_id, line_id, glass_variant_definition_id, company_color_id, profile_finish
  );
CREATE INDEX IF NOT EXISTS company_product_price_line_combinations_parent_idx
  ON public.company_product_price_line_combinations(price_line_id);
CREATE INDEX IF NOT EXISTS company_product_price_line_combinations_glass_idx
  ON public.company_product_price_line_combinations(glass_variant_definition_id);
CREATE INDEX IF NOT EXISTS company_product_price_line_combinations_color_idx
  ON public.company_product_price_line_combinations(company_color_id);

ALTER TABLE public.company_product_price_line_combinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_product_price_line_combinations_select ON public.company_product_price_line_combinations;
CREATE POLICY company_product_price_line_combinations_select
ON public.company_product_price_line_combinations FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

REVOKE ALL ON TABLE public.company_product_price_line_combinations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.company_product_price_line_combinations TO authenticated;

-- Preserve the legacy direct CRUD path only for product-specific rows. Line bands
-- are transactionally managed by RPC so overlap validation cannot be bypassed.
DROP POLICY IF EXISTS phase1a_company_product_price_lines_insert ON public.company_product_price_lines;
DROP POLICY IF EXISTS phase1a_company_product_price_lines_update ON public.company_product_price_lines;
DROP POLICY IF EXISTS phase1a_company_product_price_lines_delete ON public.company_product_price_lines;
CREATE POLICY phase1a_company_product_price_lines_insert
ON public.company_product_price_lines FOR INSERT TO authenticated
WITH CHECK (
  pricing_scope = 'PRODUCT_VARIANT'
  AND public.phase3e_can_manage_pricing((SELECT auth.uid()), company_id)
);
CREATE POLICY phase1a_company_product_price_lines_update
ON public.company_product_price_lines FOR UPDATE TO authenticated
USING (
  pricing_scope = 'PRODUCT_VARIANT'
  AND public.phase3e_can_manage_pricing((SELECT auth.uid()), company_id)
)
WITH CHECK (
  pricing_scope = 'PRODUCT_VARIANT'
  AND public.phase3e_can_manage_pricing((SELECT auth.uid()), company_id)
);
CREATE POLICY phase1a_company_product_price_lines_delete
ON public.company_product_price_lines FOR DELETE TO authenticated
USING (
  pricing_scope = 'PRODUCT_VARIANT'
  AND public.phase3e_can_manage_pricing((SELECT auth.uid()), company_id)
);

CREATE OR REPLACE FUNCTION public.get_company_pricing_workspace(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT jsonb_build_object(
    'labor_percent', c.composition_labor_percent,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pl.id, 'slug', pl.slug, 'name', pl.name,
        'band_count', COALESCE(s.band_count,0),
        'min_price', s.min_price, 'max_price', s.max_price,
        'line_product_count', COALESCE(s.line_product_count,0)
      ) ORDER BY pl.sort_order, pl.name)
      FROM public.product_linhas pl
      LEFT JOIN LATERAL (
        SELECT
          count(DISTINCT ppl.id) FILTER (WHERE ppl.is_active) band_count,
          min(ppl.price) FILTER (WHERE ppl.is_active) min_price,
          max(ppl.price) FILTER (WHERE ppl.is_active) max_price,
          (SELECT count(*) FROM public.company_products cp
           WHERE cp.company_id=_company_id AND cp.is_active
             AND COALESCE(cp.product_line_id = pl.id, cp.linha = pl.slug)) line_product_count
        FROM public.company_product_price_lines ppl
        WHERE ppl.company_id=_company_id AND ppl.line_id=pl.id
          AND ppl.pricing_scope='LINE_BAND'
      ) s ON true
      WHERE pl.is_active
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cp.id, 'name', cp.commercial_name, 'catalog_origin', cp.catalog_origin,
        'product_template_id', cp.product_template_id,
        'line_id', COALESCE(cp.product_line_id, pl.id),
        'line_name', pl.name, 'line_slug', COALESCE(pl.slug, cp.linha),
        'method', COALESCE(cp.commercial_pricing_method,
          CASE WHEN cp.pricing_type='FIXED_PER_SQM' THEN 'LEGACY_FIXED_PER_SQM' ELSE 'COMPOSITION' END)
      ) ORDER BY cp.commercial_name)
      FROM public.company_products cp
      LEFT JOIN public.product_linhas pl
        ON pl.id=cp.product_line_id OR (cp.product_line_id IS NULL AND pl.slug=cp.linha)
      WHERE cp.company_id=_company_id AND cp.is_active
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.companies c WHERE c.id=_company_id;
  IF v_result IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='COMPANY_NOT_FOUND';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_company_line_pricing_options(
  _company_id uuid,
  _line_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_linhas WHERE id=_line_id AND is_active) THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='INVALID_LINE';
  END IF;
  SELECT jsonb_build_object(
    'glass_variants', COALESCE((
      SELECT jsonb_agg(x.value ORDER BY x.type_name, x.color_name, x.thickness_mm, x.finish_name)
      FROM (
        SELECT DISTINCT ON (civ.variant_definition_id)
          civ.glass_type type_name, civ.glass_color color_name,
          civ.glass_thickness_mm thickness_mm,
          COALESCE(civ.attributes->>'finish','PADRAO') finish_name,
          jsonb_build_object(
            'id', civ.variant_definition_id, 'type', civ.glass_type,
            'color', civ.glass_color, 'thickness_mm', civ.glass_thickness_mm,
            'finish', COALESCE(civ.attributes->>'finish','PADRAO')
          ) value
        FROM public.company_item_variants civ
        JOIN public.company_items ci ON ci.id=civ.company_item_id AND ci.company_id=civ.company_id
        WHERE civ.company_id=_company_id AND civ.is_active
          AND civ.variant_type='GLASS' AND civ.variant_definition_id IS NOT NULL
          AND ci.is_active AND ci.is_commercial_area_material
        ORDER BY civ.variant_definition_id, civ.glass_type, civ.glass_color, civ.glass_thickness_mm
      ) x
    ), '[]'::jsonb),
    'profile_colors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cc.id, 'code', cc.code, 'name', cc.name,
        'hex_color', cc.hex_color, 'catalog_origin', cc.catalog_origin
      ) ORDER BY cc.name)
      FROM public.company_colors cc
      WHERE cc.company_id=_company_id AND cc.is_active
    ), '[]'::jsonb),
    'profile_finishes', COALESCE((
      SELECT jsonb_agg(f.finish ORDER BY f.finish)
      FROM (
        SELECT DISTINCT upper(btrim(civ.profile_finish)) finish
        FROM public.company_item_variants civ
        WHERE civ.company_id=_company_id AND civ.is_active
          AND civ.variant_type='PROFILE' AND NULLIF(btrim(civ.profile_finish),'') IS NOT NULL
        UNION SELECT 'PADRAO'
      ) f
    ), '["PADRAO"]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_line_price_bands(
  _company_id uuid,
  _line_id uuid
)
RETURNS TABLE(
  id uuid, description text, price_per_m2 numeric, is_active boolean,
  glass_variant_definition_ids uuid[], company_color_ids uuid[], profile_finishes text[],
  glass_labels text[], profile_color_labels text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT ppl.id, ppl.description, ppl.price, ppl.is_active,
    array_agg(DISTINCT combo.glass_variant_definition_id ORDER BY combo.glass_variant_definition_id),
    array_agg(DISTINCT combo.company_color_id ORDER BY combo.company_color_id),
    array_agg(DISTINCT combo.profile_finish ORDER BY combo.profile_finish),
    array_agg(DISTINCT concat_ws(' · ', civ.glass_type, civ.glass_color, civ.glass_thickness_mm::text||' mm')
      ORDER BY concat_ws(' · ', civ.glass_type, civ.glass_color, civ.glass_thickness_mm::text||' mm')),
    array_agg(DISTINCT cc.name ORDER BY cc.name)
  FROM public.company_product_price_lines ppl
  JOIN public.company_product_price_line_combinations combo ON combo.price_line_id=ppl.id
  JOIN public.company_colors cc ON cc.id=combo.company_color_id
  LEFT JOIN LATERAL (
    SELECT v.glass_type, v.glass_color, v.glass_thickness_mm
    FROM public.company_item_variants v
    WHERE v.company_id=_company_id AND v.variant_definition_id=combo.glass_variant_definition_id
    ORDER BY v.is_active DESC, v.id LIMIT 1
  ) civ ON true
  WHERE ppl.company_id=_company_id AND ppl.line_id=_line_id
    AND ppl.pricing_scope='LINE_BAND'
  GROUP BY ppl.id, ppl.description, ppl.price, ppl.is_active, ppl.sort_order, ppl.created_at
  ORDER BY ppl.is_active DESC, ppl.sort_order, ppl.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_composition_labor_percent(
  _company_id uuid,
  _labor_percent numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF _labor_percent IS NULL OR _labor_percent < 0 OR _labor_percent > 1000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_LABOR_PERCENT';
  END IF;
  UPDATE public.companies SET composition_labor_percent=_labor_percent, updated_at=now()
  WHERE id=_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='COMPANY_NOT_FOUND'; END IF;
  RETURN _labor_percent;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_product_pricing_method(
  _company_id uuid,
  _company_product_id uuid,
  _method text,
  _line_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_method text := upper(btrim(COALESCE(_method,''))); v_product public.company_products;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF v_method NOT IN ('COMPOSITION','LINE_PRICE_PER_M2') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_PRICING_MODE';
  END IF;
  IF v_method='LINE_PRICE_PER_M2' AND NOT EXISTS (
    SELECT 1 FROM public.product_linhas WHERE id=_line_id AND is_active
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='INVALID_LINE';
  END IF;
  UPDATE public.company_products
  SET commercial_pricing_method=v_method,
      product_line_id=CASE WHEN v_method='LINE_PRICE_PER_M2' THEN _line_id ELSE product_line_id END,
      linha=CASE WHEN v_method='LINE_PRICE_PER_M2'
        THEN (SELECT slug FROM public.product_linhas WHERE id=_line_id) ELSE linha END,
      pricing_type='COMPOSITION',
      price_per_sqm=NULL,
      updated_at=now()
  WHERE id=_company_product_id AND company_id=_company_id
  RETURNING * INTO v_product;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='PRODUCT_NOT_FOUND';
  END IF;
  RETURN jsonb_build_object('id',v_product.id,'method',v_product.commercial_pricing_method,
    'line_id',v_product.product_line_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_line_price_band(
  _company_id uuid,
  _line_id uuid,
  _description text,
  _price_per_m2 numeric,
  _glass_variant_definition_ids uuid[],
  _company_color_ids uuid[],
  _profile_finishes text[],
  _price_line_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_id uuid := COALESCE(_price_line_id, gen_random_uuid());
  v_finishes text[];
  v_overlap text;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_linhas WHERE id=_line_id AND is_active) THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='INVALID_LINE';
  END IF;
  IF COALESCE(_price_per_m2,0) <= 0 OR NULLIF(btrim(COALESCE(_description,'')),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_PRICE_BAND';
  END IF;
  IF cardinality(_glass_variant_definition_ids) IS NULL OR cardinality(_glass_variant_definition_ids)=0
     OR cardinality(_company_color_ids) IS NULL OR cardinality(_company_color_ids)=0
     OR cardinality(_profile_finishes) IS NULL OR cardinality(_profile_finishes)=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRICE_BAND_OPTIONS_REQUIRED';
  END IF;
  SELECT array_agg(DISTINCT upper(btrim(f))) INTO v_finishes
  FROM unnest(_profile_finishes) f WHERE NULLIF(btrim(f),'') IS NOT NULL;
  IF cardinality(v_finishes) IS NULL OR cardinality(v_finishes)=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRICE_BAND_OPTIONS_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_glass_variant_definition_ids) d(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.company_item_variants civ
      JOIN public.company_items ci ON ci.id=civ.company_item_id AND ci.company_id=civ.company_id
      WHERE civ.company_id=_company_id AND civ.variant_definition_id=d.id
        AND civ.variant_type='GLASS' AND civ.is_active AND ci.is_active
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='INVALID_OR_DISABLED_GLASS_OPTION';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_company_color_ids) c(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.company_colors cc
      WHERE cc.id=c.id AND cc.company_id=_company_id AND cc.is_active)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='INVALID_OR_DISABLED_PROFILE_COLOR';
  END IF;
  IF _price_line_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_product_price_lines ppl
    WHERE ppl.id=_price_line_id AND ppl.company_id=_company_id AND ppl.line_id=_line_id
      AND ppl.pricing_scope='LINE_BAND' FOR UPDATE
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='PRICE_BAND_NOT_FOUND';
  END IF;
  SELECT concat_ws(' · ',civ.glass_color,civ.glass_thickness_mm::text||' mm',cc.name,c.profile_finish)
  INTO v_overlap
  FROM public.company_product_price_line_combinations c
  JOIN public.company_product_price_lines ppl ON ppl.id=c.price_line_id AND ppl.is_active
  JOIN public.company_colors cc ON cc.id=c.company_color_id
  LEFT JOIN public.company_item_variants civ ON civ.company_id=_company_id
    AND civ.variant_definition_id=c.glass_variant_definition_id AND civ.is_active
  WHERE c.company_id=_company_id AND c.line_id=_line_id
    AND c.price_line_id<>v_id
    AND c.glass_variant_definition_id=ANY(_glass_variant_definition_ids)
    AND c.company_color_id=ANY(_company_color_ids)
    AND c.profile_finish=ANY(v_finishes)
  LIMIT 1;
  IF v_overlap IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='PRICE_BAND_OVERLAP',
      DETAIL=v_overlap||' já pertence a uma faixa de preço desta linha.';
  END IF;
  INSERT INTO public.company_product_price_lines(
    id,company_id,company_product_id,line_id,pricing_scope,description,price,cost,unit,sort_order,is_active
  ) VALUES (
    v_id,_company_id,NULL,_line_id,'LINE_BAND',btrim(_description),_price_per_m2,NULL,'m2',0,true
  )
  ON CONFLICT (id) DO UPDATE SET
    description=EXCLUDED.description,price=EXCLUDED.price,is_active=true,updated_at=now();
  DELETE FROM public.company_product_price_line_combinations WHERE price_line_id=v_id;
  INSERT INTO public.company_product_price_line_combinations(
    company_id,line_id,price_line_id,glass_variant_definition_id,company_color_id,profile_finish
  )
  SELECT _company_id,_line_id,v_id,d.id,c.id,f.finish
  FROM unnest(_glass_variant_definition_ids) d(id)
  CROSS JOIN unnest(_company_color_ids) c(id)
  CROSS JOIN unnest(v_finishes) f(finish);
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='PRICE_BAND_OVERLAP',
    DETAIL='Uma das combinações selecionadas já pertence a uma faixa de preço desta linha.';
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_company_line_price_band(
  _company_id uuid,
  _price_line_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  DELETE FROM public.company_product_price_line_combinations c
  USING public.company_product_price_lines ppl
  WHERE c.price_line_id=ppl.id AND ppl.id=_price_line_id AND ppl.company_id=_company_id
    AND ppl.pricing_scope='LINE_BAND';
  UPDATE public.company_product_price_lines SET is_active=false,updated_at=now()
  WHERE id=_price_line_id AND company_id=_company_id AND pricing_scope='LINE_BAND';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='PRICE_BAND_NOT_FOUND'; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_company_final_product_pricing(
  _company_id uuid,
  _company_product_id uuid,
  _width_mm numeric,
  _height_mm numeric,
  _quantity integer DEFAULT 1,
  _variants jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_product public.company_products;
  v_core jsonb;
  v_method text;
  v_labor_percent numeric;
  v_component_subtotal numeric;
  v_labor_amount numeric;
  v_total numeric;
  v_cost numeric;
  v_line_id uuid;
  v_line_slug text;
  v_line_name text;
  v_glass_definition_id uuid;
  v_profile_color_id uuid;
  v_profile_finish text := upper(btrim(COALESCE(_variants->>'profile_finish','PADRAO')));
  v_profile_ref text := NULLIF(_variants->>'profile_company_color_id','');
  v_band public.company_product_price_lines;
  v_area numeric;
  v_glass_attributes jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT * INTO v_product FROM public.company_products
  WHERE id=_company_product_id AND company_id=_company_id AND is_active;
  IF v_product.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='PRODUCT_NOT_FOUND'; END IF;
  v_method := COALESCE(v_product.commercial_pricing_method,
    CASE WHEN v_product.pricing_type='FIXED_PER_SQM' THEN 'LEGACY_FIXED_PER_SQM' ELSE 'COMPOSITION' END);
  v_core := public.resolve_company_product_pricing(
    _company_id,_company_product_id,_width_mm,_height_mm,_quantity,_variants
  );
  v_cost := COALESCE((v_core#>>'{totals,cost}')::numeric,0);
  IF v_method='LEGACY_FIXED_PER_SQM' THEN
    RETURN v_core || jsonb_build_object('commercial_pricing_method','LEGACY_FIXED_PER_SQM');
  END IF;
  IF v_method='COMPOSITION' THEN
    SELECT composition_labor_percent INTO v_labor_percent FROM public.companies WHERE id=_company_id;
    v_component_subtotal := COALESCE((v_core#>>'{totals,composition_sale_price}')::numeric,0);
    v_labor_amount := round(v_component_subtotal * v_labor_percent / 100,2);
    v_total := round(v_component_subtotal + v_labor_amount,2);
    v_core := jsonb_set(v_core,'{totals}',(v_core->'totals') || jsonb_build_object(
      'component_commercial_subtotal',v_component_subtotal,
      'labor_percent',v_labor_percent,'labor_amount',v_labor_amount,
      'suggested_price',v_total,'sale_price',v_total,
      'profit',round(v_total-v_cost,2),
      'margin_percent',CASE WHEN v_total>0 THEN round((v_total-v_cost)/v_total*100,2) ELSE NULL END
    ));
    RETURN v_core || jsonb_build_object(
      'engine_version',6,'snapshot_version',5,'pricing_mode','COMPOSITION',
      'commercial_pricing_method','COMPOSITION','pricing_source','TENANT_COMPONENT_SALE_PRICES',
      'commercial_pricing_decision',jsonb_build_object(
        'method','COMPOSITION','component_commercial_subtotal',v_component_subtotal,
        'labor_percent',v_labor_percent,'labor_amount',v_labor_amount,
        'suggested_price',v_total
      )
    );
  END IF;
  IF v_method<>'LINE_PRICE_PER_M2' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_PRICING_MODE';
  END IF;
  SELECT pl.id,pl.slug,pl.name INTO v_line_id,v_line_slug,v_line_name
  FROM public.product_linhas pl
  WHERE pl.is_active AND (pl.id=v_product.product_line_id OR
    (v_product.product_line_id IS NULL AND pl.slug=v_product.linha))
  ORDER BY (pl.id=v_product.product_line_id) DESC LIMIT 1;
  IF v_line_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='PRODUCT_LINE_NOT_CONFIGURED'; END IF;
  v_glass_attributes := public.phase4a_normalize_variant_attributes(jsonb_build_object(
    'type',_variants->>'glass_type','color',_variants->>'glass_color',
    'thickness_mm',_variants->'glass_thickness_mm',
    'finish',COALESCE(_variants->>'glass_finish','PADRAO')
  ));
  SELECT civ.variant_definition_id INTO v_glass_definition_id
  FROM public.company_item_variants civ
  JOIN public.company_items ci ON ci.id=civ.company_item_id AND ci.company_id=civ.company_id
  WHERE civ.company_id=_company_id AND civ.variant_type='GLASS' AND civ.is_active
    AND civ.variant_definition_id IS NOT NULL AND civ.attributes=v_glass_attributes
    AND ci.is_active
  ORDER BY ci.is_commercial_area_material DESC,civ.id LIMIT 1;
  IF v_glass_definition_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PRICE_NOT_CONFIGURED',
      DETAIL='A combinação de vidro selecionada não está habilitada para esta empresa.';
  END IF;
  SELECT cc.id INTO v_profile_color_id
  FROM public.company_colors cc
  WHERE cc.company_id=_company_id AND cc.is_active AND (
    (v_profile_ref IS NOT NULL AND (cc.id::text=v_profile_ref OR cc.admin_color_id::text=v_profile_ref))
    OR (v_profile_ref IS NULL AND (
      lower(cc.code)=lower(COALESCE(_variants->>'profile_color_code',''))
      OR lower(cc.name)=lower(COALESCE(_variants->>'profile_color',''))
    ))
  ) ORDER BY (cc.id::text=v_profile_ref) DESC LIMIT 1;
  IF v_profile_color_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PRICE_NOT_CONFIGURED',
      DETAIL='A cor de perfil selecionada não está habilitada para esta empresa.';
  END IF;
  SELECT ppl.* INTO v_band
  FROM public.company_product_price_line_combinations combo
  JOIN public.company_product_price_lines ppl ON ppl.id=combo.price_line_id
  WHERE combo.company_id=_company_id AND combo.line_id=v_line_id
    AND combo.glass_variant_definition_id=v_glass_definition_id
    AND combo.company_color_id=v_profile_color_id
    AND combo.profile_finish=v_profile_finish
    AND ppl.is_active AND ppl.pricing_scope='LINE_BAND'
  LIMIT 1;
  IF v_band.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PRICE_NOT_CONFIGURED',
      DETAIL='Preço ainda não configurado para esta combinação.';
  END IF;
  v_area := round((_width_mm*_height_mm/1000000)*_quantity,6);
  v_total := round(v_area*v_band.price,2);
  v_core := jsonb_set(v_core,'{totals}',(v_core->'totals') || jsonb_build_object(
    'area_m2',v_area,'line_price_per_m2',v_band.price,
    'labor_percent',0,'labor_amount',0,
    'suggested_price',v_total,'sale_price',v_total,
    'profit',round(v_total-v_cost,2),
    'margin_percent',CASE WHEN v_total>0 THEN round((v_total-v_cost)/v_total*100,2) ELSE NULL END
  ));
  RETURN v_core || jsonb_build_object(
    'engine_version',6,'snapshot_version',5,'pricing_mode','LINE_PRICE_PER_M2',
    'commercial_pricing_method','LINE_PRICE_PER_M2','pricing_source','COMPANY_LINE_PRICE_BAND',
    'commercial_pricing_decision',jsonb_build_object(
      'method','LINE_PRICE_PER_M2','line_id',v_line_id,'line_slug',v_line_slug,
      'line_name',v_line_name,'price_band_id',v_band.id,'price_band_description',v_band.description,
      'glass_variant_definition_id',v_glass_definition_id,
      'company_color_id',v_profile_color_id,'profile_finish',v_profile_finish,
      'price_per_m2',v_band.price,'width_mm',_width_mm,'height_mm',_height_mm,
      'quantity',_quantity,'area_m2',v_area,'suggested_price',v_total,
      'labor_applied',false
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_pricing_workspace(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_company_line_pricing_options(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_company_line_price_bands(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_company_composition_labor_percent(uuid,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_company_product_pricing_method(uuid,uuid,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_company_line_price_band(uuid,uuid,text,numeric,uuid[],uuid[],text[],uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.deactivate_company_line_price_band(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.get_company_pricing_workspace(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_company_line_pricing_options(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_company_line_price_bands(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_company_composition_labor_percent(uuid,numeric) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_company_product_pricing_method(uuid,uuid,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_company_line_price_band(uuid,uuid,text,numeric,uuid[],uuid[],text[],uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_company_line_price_band(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) TO authenticated,service_role;

COMMENT ON TABLE public.company_product_price_line_combinations IS
  'Coverage only. The price authority remains company_product_price_lines; uniqueness prevents tenant/line overlap.';
COMMENT ON COLUMN public.companies.composition_labor_percent IS
  'Tenant labor percentage applied once after the commercial component subtotal for COMPOSITION pricing.';
