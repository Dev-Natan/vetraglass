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
  -- LINE pricing uses the BOM only for real cost. Profile color is a final-price
  -- dimension of the band and must not require component sale variants.
  v_core := public.resolve_company_product_pricing(
    _company_id,_company_product_id,_width_mm,_height_mm,_quantity,
    CASE WHEN v_method='LINE_PRICE_PER_M2' THEN
      _variants - ARRAY[
        'profile_company_color_id','profile_color_id','profile_color_code',
        'profile_color_name','profile_color','profile_finish'
      ]
    ELSE _variants END
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


REVOKE ALL ON FUNCTION public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) TO authenticated,service_role;
