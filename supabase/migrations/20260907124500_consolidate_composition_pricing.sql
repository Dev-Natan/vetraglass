-- Consolidate new commercial suggestions on tenant-owned component composition.
-- Historical LINE_BAND rows and immutable quote snapshots are preserved.
BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(
    'public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb)'::regprocedure
  ) INTO v_definition;
  v_updated := v_definition;

  v_old := $old$  v_piece jsonb;
BEGIN$old$;
  v_new := $new$  v_piece jsonb;
  v_total_components integer := 0;
  v_known_price_items integer := 0;
  v_known_cost_items integer := 0;
  v_missing_price_items integer := 0;
  v_missing_cost_items integer := 0;
  v_suggestion_status text := 'UNAVAILABLE';
BEGIN$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_DECLARATION_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$  LOOP
    IF v_component.company_item_id IS NULL OR v_component.item_name IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
    END IF;$old$;
  v_new := $new$  LOOP
    v_total_components := v_total_components + 1;
    IF v_component.company_item_id IS NULL OR v_component.item_name IS NULL THEN
      v_missing_price_items := v_missing_price_items + 1;
      v_missing_cost_items := v_missing_cost_items + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code','MISSING_COMPANY_ITEM','component_id',v_component.id,
        'item_template_id',v_component.item_template_id
      ));
      CONTINUE;
    END IF;$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_COMPONENT_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$      IF v_pricing_item.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
          DETAIL = COALESCE(v_material_family, 'AREA_MATERIAL') || ' | commercial material not configured';
      END IF;$old$;
  v_new := $new$      IF v_pricing_item.id IS NULL THEN
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code','MISSING_PRICE_VARIANT','component_id',v_component.id,
          'company_item_id',v_component.company_item_id,
          'material_family',COALESCE(v_material_family,'AREA_MATERIAL')
        ));
      END IF;$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_AREA_ITEM_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$      IF v_variant.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
          DETAIL = v_pricing_item.name || ' | especificacao=' || v_requested_attributes::text;
      END IF;$old$;
  v_new := $new$      IF v_variant.id IS NULL THEN
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code','MISSING_PRICE_VARIANT','component_id',v_component.id,
          'company_item_id',v_component.company_item_id,
          'pricing_company_item_id',v_pricing_item.id,
          'specification',v_requested_attributes
        ));
      END IF;$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_AREA_VARIANT_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$        IF v_variant.id IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
            DETAIL = v_component.item_name || ' | atributos=' || v_requested_attributes::text;
        END IF;$old$;
  v_new := $new$        IF v_variant.id IS NULL THEN
          v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
            'code','MISSING_PRICE_VARIANT','component_id',v_component.id,
            'company_item_id',v_component.company_item_id,
            'specification',v_requested_attributes
          ));
        END IF;$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_COMPONENT_VARIANT_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$    v_cost := CASE WHEN v_variant.id IS NULL THEN v_component.base_cost ELSE v_variant.cost END;
    v_sale := CASE WHEN v_variant.id IS NULL THEN v_component.base_sale ELSE v_variant.sale_price END;
    IF v_cost IS NULL OR v_cost <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COST';
    END IF;
    IF v_sale IS NULL OR v_sale <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE';
    END IF;$old$;
  v_new := $new$    IF (v_component.pricing_basis='AREA' AND (v_pricing_item.id IS NULL OR v_variant.id IS NULL))
       OR (v_component.pricing_basis<>'AREA' AND v_requested_attributes<>'{}'::jsonb AND v_variant.id IS NULL) THEN
      v_cost := NULL;
      v_sale := NULL;
    ELSE
      v_cost := CASE WHEN v_variant.id IS NULL THEN v_component.base_cost ELSE v_variant.cost END;
      v_sale := CASE WHEN v_variant.id IS NULL THEN v_component.base_sale ELSE v_variant.sale_price END;
    END IF;
    IF v_cost IS NULL OR v_cost <= 0 THEN
      v_missing_cost_items := v_missing_cost_items + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code','MISSING_COST','component_id',v_component.id,
        'company_item_id',v_component.company_item_id,'item_name',v_component.item_name
      ));
    ELSE
      v_known_cost_items := v_known_cost_items + 1;
    END IF;
    IF v_sale IS NULL OR v_sale <= 0 THEN
      v_missing_price_items := v_missing_price_items + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code','MISSING_PRICE','component_id',v_component.id,
        'company_item_id',v_component.company_item_id,'item_name',v_component.item_name,
        'required_quantity',v_pricing_qty
      ));
    ELSE
      v_known_price_items := v_known_price_items + 1;
    END IF;$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_PRICE_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$    v_total_cost := v_total_cost + round(v_pricing_qty * v_cost, 2);
    v_composition_sale := v_composition_sale + round(v_pricing_qty * v_sale, 2);$old$;
  v_new := $new$    v_total_cost := v_total_cost + COALESCE(round(v_pricing_qty * v_cost, 2),0);
    v_composition_sale := v_composition_sale + COALESCE(round(v_pricing_qty * v_sale, 2),0);$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_TOTAL_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$  IF jsonb_array_length(v_materials) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;$old$;
  v_new := $new$  IF v_total_components = 0 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','MISSING_COMPOSITION','company_product_id',_company_product_id
    ));
  END IF;$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_EMPTY_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$  v_area := round((_width_mm * _height_mm / 1000000) * _quantity, 6);
  IF v_product.pricing_type = 'FIXED_PER_SQM' THEN
    IF COALESCE(v_product.price_per_sqm, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE';
    END IF;
    v_total_sale := round(v_area * v_product.price_per_sqm, 2);
  ELSE
    v_total_sale := round(v_composition_sale, 2);
  END IF;$old$;
  v_new := $new$  v_area := round((_width_mm * _height_mm / 1000000) * _quantity, 6);
  IF v_total_components=0 OR v_known_price_items=0 THEN
    v_suggestion_status := 'UNAVAILABLE';
    v_total_sale := NULL;
  ELSIF v_missing_price_items>0 THEN
    v_suggestion_status := 'PARTIAL';
    v_total_sale := round(v_composition_sale,2);
  ELSE
    v_suggestion_status := 'COMPLETE';
    v_total_sale := round(v_composition_sale,2);
  END IF;$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_STATUS_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$    'composition_mode', 'fixed', 'engine_version', 5, 'snapshot_version', 4,
    'pricing_mode', v_product.pricing_type,$old$;
  v_new := $new$    'composition_mode','fixed','engine_version',7,'snapshot_version',6,
    'pricing_mode','COMPOSITION','commercial_pricing_method','COMPOSITION',
    'pricing_source','COMPOSITION','suggestion_status',v_suggestion_status,
    'suggested_price',v_total_sale,$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_RESULT_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$      'area_m2', v_area, 'cost', round(v_total_cost, 2),
      'composition_sale_price', round(v_composition_sale, 2),
      'sale_price', v_total_sale, 'profit', round(v_total_sale - v_total_cost, 2),
      'margin_percent', CASE WHEN v_total_sale > 0
        THEN round(((v_total_sale - v_total_cost) / v_total_sale) * 100, 2) ELSE NULL END,
      'fixed_price_per_sqm', CASE WHEN v_product.pricing_type = 'FIXED_PER_SQM'
        THEN v_product.price_per_sqm ELSE NULL END
    ),
    'warnings', v_warnings, 'ready_for_quote', true, 'frozen_at', now()$old$;
  v_new := $new$      'area_m2',v_area,
      'cost',CASE WHEN v_known_cost_items>0 THEN round(v_total_cost,2) ELSE NULL END,
      'known_cost_subtotal',CASE WHEN v_known_cost_items>0 THEN round(v_total_cost,2) ELSE NULL END,
      'composition_sale_price',CASE WHEN v_known_price_items>0 THEN round(v_composition_sale,2) ELSE NULL END,
      'known_components_subtotal',CASE WHEN v_known_price_items>0 THEN round(v_composition_sale,2) ELSE NULL END,
      'suggested_price',v_total_sale,'sale_price',v_total_sale,
      'profit',CASE WHEN v_total_sale IS NOT NULL AND v_missing_cost_items=0
        THEN round(v_total_sale-v_total_cost,2) ELSE NULL END,
      'margin_percent',CASE WHEN v_total_sale>0 AND v_missing_cost_items=0
        THEN round(((v_total_sale-v_total_cost)/v_total_sale)*100,2) ELSE NULL END,
      'missing_cost_items',v_missing_cost_items,'missing_price_items',v_missing_price_items,
      'known_price_items',v_known_price_items,'component_count',v_total_components,
      'fixed_price_per_sqm',NULL
    ),
    'warnings',v_warnings,'ready_for_quote',true,'frozen_at',now()$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'COMPOSITION_TOTALS_RESULT_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  EXECUTE v_updated;
END;
$migration$;

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
AS $function$
DECLARE
  v_product public.company_products;
  v_core jsonb;
  v_status text;
  v_labor_percent numeric;
  v_component_subtotal numeric;
  v_labor_amount numeric;
  v_total numeric;
  v_cost numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT * INTO v_product FROM public.company_products
  WHERE id=_company_product_id AND company_id=_company_id AND is_active;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='PRODUCT_NOT_FOUND';
  END IF;

  BEGIN
    v_core := public.resolve_company_product_pricing(
      _company_id,_company_product_id,_width_mm,_height_mm,_quantity,_variants
    );
  EXCEPTION WHEN SQLSTATE '22023' OR SQLSTATE '23514' THEN
    v_core := jsonb_build_object(
      'composition_mode','fixed','engine_version',7,'snapshot_version',6,
      'pricing_mode','COMPOSITION','commercial_pricing_method','COMPOSITION',
      'pricing_source','COMPOSITION','suggestion_status','UNAVAILABLE',
      'suggested_price',NULL,'company_id',_company_id,
      'company_product_id',_company_product_id,
      'product_template_id',v_product.product_template_id,
      'inputs',jsonb_build_object('width_mm',_width_mm,'height_mm',_height_mm,
        'quantity',_quantity,'variants',_variants),
      'variants',_variants,'materials','[]'::jsonb,'area_pieces','[]'::jsonb,
      'glass_pieces','[]'::jsonb,'area_pricing_groups','[]'::jsonb,
      'cuts','[]'::jsonb,'rules','[]'::jsonb,
      'totals',jsonb_build_object('area_m2',round((_width_mm*_height_mm/1000000)*_quantity,6),
        'cost',NULL,'known_cost_subtotal',NULL,'composition_sale_price',NULL,
        'known_components_subtotal',NULL,'suggested_price',NULL,'sale_price',NULL,
        'profit',NULL,'margin_percent',NULL,'missing_cost_items',0,
        'missing_price_items',0,'known_price_items',0,'component_count',0),
      'warnings',jsonb_build_array(jsonb_build_object(
        'code','INCOMPLETE_COMPOSITION','technical_code',SQLERRM
      )),'ready_for_quote',true,'frozen_at',now()
    );
  END;

  v_status := COALESCE(v_core->>'suggestion_status','UNAVAILABLE');
  v_component_subtotal := NULLIF(v_core#>>'{totals,known_components_subtotal}','')::numeric;
  v_cost := NULLIF(v_core#>>'{totals,cost}','')::numeric;
  SELECT composition_labor_percent INTO v_labor_percent
  FROM public.companies WHERE id=_company_id;
  v_labor_percent := COALESCE(v_labor_percent,0);

  IF v_status='UNAVAILABLE' OR v_component_subtotal IS NULL THEN
    v_labor_amount := 0;
    v_total := NULL;
  ELSE
    v_labor_amount := round(v_component_subtotal*v_labor_percent/100,2);
    v_total := round(v_component_subtotal+v_labor_amount,2);
  END IF;

  v_core := jsonb_set(v_core,'{totals}',(v_core->'totals') || jsonb_build_object(
    'component_commercial_subtotal',v_component_subtotal,
    'labor_percent',v_labor_percent,'labor_amount',v_labor_amount,
    'suggested_price',v_total,'sale_price',v_total,
    'profit',CASE WHEN v_total IS NOT NULL AND v_cost IS NOT NULL
      AND COALESCE((v_core#>>'{totals,missing_cost_items}')::integer,0)=0
      THEN round(v_total-v_cost,2) ELSE NULL END,
    'margin_percent',CASE WHEN v_total>0 AND v_cost IS NOT NULL
      AND COALESCE((v_core#>>'{totals,missing_cost_items}')::integer,0)=0
      THEN round((v_total-v_cost)/v_total*100,2) ELSE NULL END
  ));

  RETURN v_core || jsonb_build_object(
    'engine_version',7,'snapshot_version',6,'pricing_mode','COMPOSITION',
    'commercial_pricing_method','COMPOSITION','pricing_source','COMPOSITION',
    'suggestion_status',v_status,'suggested_price',v_total,
    'commercial_pricing_decision',jsonb_build_object(
      'method','COMPOSITION','status',v_status,
      'known_components_subtotal',v_component_subtotal,
      'labor_percent',v_labor_percent,'labor_amount',v_labor_amount,
      'suggested_price',v_total
    )
  );
END;
$function$;

-- Existing LINE_BAND configuration remains available as historical data, but
-- no active product retains it as the authority for new quote suggestions.
UPDATE public.company_products
SET commercial_pricing_method='COMPOSITION',updated_at=now()
WHERE commercial_pricing_method='LINE_PRICE_PER_M2';

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.trg_freeze_quote_item_composition()'::regprocedure)
  INTO v_definition;
  v_updated := v_definition;

  v_old := $old$          'pricing_mode', v_expected->'pricing_mode',
          'variants', v_expected->'variants',$old$;
  v_new := $new$          'pricing_mode',v_expected->'pricing_mode',
          'commercial_pricing_method',v_expected->'commercial_pricing_method',
          'pricing_source',v_expected->'pricing_source',
          'suggestion_status',v_expected->'suggestion_status',
          'suggested_price',v_expected->'suggested_price',
          'variants',v_expected->'variants',$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'QUOTE_STATUS_FREEZE_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$      IF abs(COALESCE((v_supplied#>>'{totals,cost}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,cost}')::numeric, -2)) > 0.01
         OR abs(COALESCE((v_supplied#>>'{totals,sale_price}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,sale_price}')::numeric, -2)) > 0.01
         OR abs(COALESCE((v_supplied#>>'{totals,profit}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,profit}')::numeric, -2)) > 0.01
         OR abs(COALESCE((v_supplied#>>'{totals,margin_percent}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,margin_percent}')::numeric, -2)) > 0.01 THEN$old$;
  v_new := $new$      IF (
           ((v_supplied#>>'{totals,cost}') IS NULL)
             <> ((v_expected#>>'{totals,cost}') IS NULL)
           OR ((v_supplied#>>'{totals,cost}') IS NOT NULL
             AND (v_expected#>>'{totals,cost}') IS NOT NULL
             AND abs((v_supplied#>>'{totals,cost}')::numeric
               -(v_expected#>>'{totals,cost}')::numeric)>0.01))
         OR (
           ((v_supplied#>>'{totals,sale_price}') IS NULL)
             <> ((v_expected#>>'{totals,sale_price}') IS NULL)
           OR ((v_supplied#>>'{totals,sale_price}') IS NOT NULL
             AND (v_expected#>>'{totals,sale_price}') IS NOT NULL
             AND abs((v_supplied#>>'{totals,sale_price}')::numeric
               -(v_expected#>>'{totals,sale_price}')::numeric)>0.01))
         OR (
           ((v_supplied#>>'{totals,profit}') IS NULL)
             <> ((v_expected#>>'{totals,profit}') IS NULL)
           OR ((v_supplied#>>'{totals,profit}') IS NOT NULL
             AND (v_expected#>>'{totals,profit}') IS NOT NULL
             AND abs((v_supplied#>>'{totals,profit}')::numeric
               -(v_expected#>>'{totals,profit}')::numeric)>0.01))
         OR (
           ((v_supplied#>>'{totals,margin_percent}') IS NULL)
             <> ((v_expected#>>'{totals,margin_percent}') IS NULL)
           OR ((v_supplied#>>'{totals,margin_percent}') IS NOT NULL
             AND (v_expected#>>'{totals,margin_percent}') IS NOT NULL
             AND abs((v_supplied#>>'{totals,margin_percent}')::numeric
               -(v_expected#>>'{totals,margin_percent}')::numeric)>0.01)) THEN$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'QUOTE_NULL_TOTALS_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  v_old := $old$         OR abs(COALESCE((matched.supplied->>'unit_cost')::numeric, -1)
              - COALESCE((expected->>'unit_cost')::numeric, -2)) > 0.0001
         OR abs(COALESCE((matched.supplied->>'unit_sale_price')::numeric, -1)
              - COALESCE((expected->>'unit_sale_price')::numeric, -2)) > 0.0001
         OR abs(COALESCE((matched.supplied->>'cost')::numeric, -1)
              - COALESCE((expected->>'cost')::numeric, -2)) > 0.01
         OR abs(COALESCE((matched.supplied->>'sale_price')::numeric, -1)
              - COALESCE((expected->>'sale_price')::numeric, -2)) > 0.01$old$;
  v_new := $new$         OR (
              ((matched.supplied->>'unit_cost') IS NULL)
                <> ((expected->>'unit_cost') IS NULL)
              OR ((matched.supplied->>'unit_cost') IS NOT NULL
                AND (expected->>'unit_cost') IS NOT NULL
                AND abs((matched.supplied->>'unit_cost')::numeric
                  -(expected->>'unit_cost')::numeric)>0.0001))
         OR (
              ((matched.supplied->>'unit_sale_price') IS NULL)
                <> ((expected->>'unit_sale_price') IS NULL)
              OR ((matched.supplied->>'unit_sale_price') IS NOT NULL
                AND (expected->>'unit_sale_price') IS NOT NULL
                AND abs((matched.supplied->>'unit_sale_price')::numeric
                  -(expected->>'unit_sale_price')::numeric)>0.0001))
         OR (
              ((matched.supplied->>'cost') IS NULL)
                <> ((expected->>'cost') IS NULL)
              OR ((matched.supplied->>'cost') IS NOT NULL
                AND (expected->>'cost') IS NOT NULL
                AND abs((matched.supplied->>'cost')::numeric
                  -(expected->>'cost')::numeric)>0.01))
         OR (
              ((matched.supplied->>'sale_price') IS NULL)
                <> ((expected->>'sale_price') IS NULL)
              OR ((matched.supplied->>'sale_price') IS NOT NULL
                AND (expected->>'sale_price') IS NOT NULL
                AND abs((matched.supplied->>'sale_price')::numeric
                  -(expected->>'sale_price')::numeric)>0.01))$new$;
  IF position(v_old IN v_updated)=0 THEN RAISE EXCEPTION 'QUOTE_NULL_MATERIALS_ANCHOR_NOT_FOUND'; END IF;
  v_updated := replace(v_updated,v_old,v_new);

  EXECUTE v_updated;
END;
$migration$;

REVOKE ALL ON FUNCTION public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.trg_freeze_quote_item_composition() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.trg_freeze_quote_item_composition() TO service_role;

COMMENT ON FUNCTION public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) IS
  'Composition engine v7: real component quantities, nullable commercial values, structured warnings, and COMPLETE/PARTIAL/UNAVAILABLE suggestions.';
COMMENT ON FUNCTION public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) IS
  'Canonical new-quote pricing authority: composition-only tenant component prices plus the existing tenant labor percentage; LINE_BAND is historical only.';
COMMENT ON FUNCTION public.trg_freeze_quote_item_composition() IS
  'Freezes server-validated composition suggestions, including nullable partial/unavailable values and quote-only applied prices.';

NOTIFY pgrst,'reload schema';
COMMIT;
