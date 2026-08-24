-- Phase 4A snapshot compatibility with the immutable Phase 3C contract.
BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_company_product_pricing(
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
SET search_path = ''
AS $$
DECLARE
  v_product public.company_products;
  v_component record;
  v_variant public.company_item_variants;
  v_pricing_item public.company_items;
  v_materials jsonb := '[]'::jsonb;
  v_area_pieces jsonb := '[]'::jsonb;
  v_glass_pieces jsonb := '[]'::jsonb;
  v_area_groups jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_width numeric;
  v_height numeric;
  v_pieces numeric;
  v_multiplier numeric;
  v_pricing_qty numeric;
  v_stock_qty numeric;
  v_loss numeric;
  v_cost numeric;
  v_sale numeric;
  v_total_cost numeric := 0;
  v_composition_sale numeric := 0;
  v_total_sale numeric;
  v_area numeric;
  v_reserved numeric;
  v_physical numeric;
  v_requested_attributes jsonb;
  v_legacy_glass_attributes jsonb;
  v_legacy_profile_attributes jsonb;
  v_material_family text;
  v_piece jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF COALESCE(_width_mm, 0) <= 0 OR COALESCE(_height_mm, 0) <= 0 OR COALESCE(_quantity, 0) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;
  IF jsonb_typeof(COALESCE(_variants, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
  END IF;

  v_legacy_glass_attributes := public.phase4a_normalize_variant_attributes(jsonb_build_object(
    'type', _variants->>'glass_type', 'color', _variants->>'glass_color',
    'thickness_mm', _variants->'glass_thickness_mm',
    'finish', COALESCE(_variants->>'glass_finish', 'PADRAO')
  ));
  v_legacy_profile_attributes := public.phase4a_normalize_variant_attributes(jsonb_build_object(
    'color', _variants->>'profile_color', 'finish', _variants->>'profile_finish'
  ));

  SELECT * INTO v_product
  FROM public.company_products
  WHERE id = _company_product_id AND company_id = _company_id AND is_active;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PRODUCT_NOT_FOUND';
  END IF;
  IF v_product.pricing_type NOT IN ('COMPOSITION', 'FIXED_PER_SQM') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_MODE';
  END IF;

  FOR v_component IN
    SELECT cpi.*, ci.name item_name, ci.type item_type, ci.unit stock_unit,
      ci.company_id item_company_id, ci.pricing_unit, ci.pricing_basis,
      ci.variant_attribute_schema, ci.cost base_cost, ci.sale_price base_sale,
      ci.bar_length_mm, ci.item_template_id canonical_template_id,
      ci.commercial_material_family
    FROM public.company_product_items cpi
    LEFT JOIN public.company_items ci ON ci.id = cpi.company_item_id
    WHERE cpi.company_product_id = _company_product_id
    ORDER BY cpi.sort_order, cpi.id
  LOOP
    IF v_component.company_item_id IS NULL OR v_component.item_name IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
    END IF;
    IF v_component.item_company_id <> _company_id
       OR (v_component.company_id IS NOT NULL AND v_component.company_id <> _company_id) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
    END IF;

    v_width := CASE WHEN NULLIF(btrim(COALESCE(v_component.width_formula, '')), '') IS NULL
      THEN NULL ELSE public.phase2a_eval_formula(v_component.width_formula, _width_mm, _height_mm) END;
    v_height := CASE WHEN NULLIF(btrim(COALESCE(v_component.height_formula, '')), '') IS NULL
      THEN NULL ELSE public.phase2a_eval_formula(v_component.height_formula, _width_mm, _height_mm) END;
    v_pieces := GREATEST(COALESCE(v_component.pieces_quantity, 1), 1);
    IF NULLIF(btrim(COALESCE(v_component.pieces_formula, '')), '') IS NOT NULL THEN
      v_pieces := GREATEST(ceil(public.phase2a_eval_formula(v_component.pieces_formula, _width_mm, _height_mm)), 0);
    END IF;
    v_multiplier := 1;
    IF v_width IS NULL AND v_height IS NULL
       AND NULLIF(btrim(COALESCE(v_component.quantity_formula, '')), '') IS NOT NULL THEN
      v_multiplier := public.phase2a_eval_formula(v_component.quantity_formula, _width_mm, _height_mm);
    ELSIF btrim(COALESCE(v_component.quantity_formula, '1')) ~ '^[0-9]+([.,][0-9]+)?$' THEN
      v_multiplier := replace(btrim(v_component.quantity_formula), ',', '.')::numeric;
    END IF;
    v_loss := 1 + COALESCE(v_component.loss_percent, 0) / 100;

    IF v_component.pricing_basis = 'AREA' THEN
      IF v_width IS NULL OR v_height IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
      END IF;
      v_pricing_qty := round((v_width * v_height / 1000000) * v_pieces * v_multiplier * _quantity * v_loss, 6);
      v_stock_qty := v_pricing_qty;
    ELSIF v_component.pricing_basis = 'LENGTH' THEN
      IF COALESCE(v_width, v_height) IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
      END IF;
      v_pricing_qty := round((COALESCE(v_width, v_height) / 1000) * v_pieces * v_multiplier * _quantity * v_loss, 6);
      v_stock_qty := CASE WHEN lower(COALESCE(v_component.stock_unit, '')) IN ('barra', 'bar')
        THEN ceil((COALESCE(v_width, v_height) * v_pieces * v_multiplier * _quantity * v_loss)
          / NULLIF(COALESCE(v_component.bar_length_mm, 6000), 0))
        ELSE v_pricing_qty END;
    ELSE
      v_pricing_qty := round(v_pieces * v_multiplier * _quantity * v_loss, 6);
      v_stock_qty := v_pricing_qty;
    END IF;
    IF v_pricing_qty <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
    END IF;

    v_requested_attributes := '{}'::jsonb;
    v_pricing_item := NULL;
    v_material_family := NULLIF(upper(btrim(COALESCE(v_component.commercial_material_family, ''))), '');

    IF v_component.pricing_basis = 'AREA' THEN
      IF v_material_family IS NULL AND lower(v_component.item_type) = 'glass' THEN
        v_material_family := 'GLASS';
      END IF;
      SELECT * INTO v_pricing_item
      FROM public.company_items ci
      WHERE ci.company_id = _company_id
        AND ci.is_commercial_area_material
        AND ci.is_active
        AND upper(ci.commercial_material_family) = v_material_family
      ORDER BY ci.id LIMIT 1;
      IF v_pricing_item.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
          DETAIL = COALESCE(v_material_family, 'AREA_MATERIAL') || ' | commercial material not configured';
      END IF;
      IF jsonb_typeof(_variants->'by_material') = 'object'
         AND (_variants->'by_material') ? v_material_family THEN
        v_requested_attributes := public.phase4a_normalize_variant_attributes(
          _variants #> ARRAY['by_material', v_material_family]
        );
      ELSIF jsonb_typeof(_variants->'by_item') = 'object'
         AND (_variants->'by_item') ? v_pricing_item.id::text THEN
        v_requested_attributes := public.phase4a_normalize_variant_attributes(
          _variants #> ARRAY['by_item', v_pricing_item.id::text]
        );
      ELSIF v_material_family = 'GLASS' AND v_legacy_glass_attributes <> '{}'::jsonb THEN
        v_requested_attributes := v_legacy_glass_attributes;
      END IF;
      IF NOT (v_requested_attributes ? 'finish') THEN
        v_requested_attributes := v_requested_attributes || jsonb_build_object('finish', 'PADRAO');
      END IF;
      SELECT * INTO v_variant
      FROM public.company_item_variants civ
      WHERE civ.company_id = _company_id
        AND civ.company_item_id = v_pricing_item.id
        AND civ.pricing_basis = 'AREA'
        AND civ.attributes = v_requested_attributes
        AND civ.is_active
      ORDER BY civ.id LIMIT 1;
      IF v_variant.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
          DETAIL = v_pricing_item.name || ' | especificacao=' || v_requested_attributes::text;
      END IF;
    ELSE
      IF jsonb_typeof(_variants->'by_item') = 'object'
         AND (_variants->'by_item') ? v_component.company_item_id::text THEN
        v_requested_attributes := public.phase4a_normalize_variant_attributes(
          _variants #> ARRAY['by_item', v_component.company_item_id::text]
        );
      ELSIF lower(v_component.item_type) = 'profile' AND v_legacy_profile_attributes <> '{}'::jsonb THEN
        v_requested_attributes := v_legacy_profile_attributes;
      END IF;
      v_variant := NULL;
      IF v_requested_attributes <> '{}'::jsonb THEN
        SELECT * INTO v_variant
        FROM public.company_item_variants civ
        WHERE civ.company_id = _company_id
          AND civ.company_item_id = v_component.company_item_id
          AND civ.pricing_basis = v_component.pricing_basis
          AND civ.attributes = v_requested_attributes
          AND civ.is_active
        ORDER BY civ.id LIMIT 1;
        IF v_variant.id IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
            DETAIL = v_component.item_name || ' | atributos=' || v_requested_attributes::text;
        END IF;
      END IF;
    END IF;

    v_cost := CASE WHEN v_variant.id IS NULL THEN v_component.base_cost ELSE v_variant.cost END;
    v_sale := CASE WHEN v_variant.id IS NULL THEN v_component.base_sale ELSE v_variant.sale_price END;
    IF v_cost IS NULL OR v_cost <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COST';
    END IF;
    IF v_sale IS NULL OR v_sale <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE';
    END IF;

    SELECT COALESCE(cs.quantity, 0), COALESCE((
      SELECT sum(sr.quantity_reserved) FROM public.stock_reservations sr
      WHERE sr.company_id = _company_id AND sr.company_item_id = v_component.company_item_id
        AND sr.status = 'reserved'
    ), 0) INTO v_physical, v_reserved
    FROM (SELECT 1) seed
    LEFT JOIN public.company_stock cs ON cs.company_id = _company_id
      AND cs.company_item_id = v_component.company_item_id AND cs.is_active;
    IF (v_physical - v_reserved) < v_stock_qty THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'MISSING_STOCK', 'company_item_id', v_component.company_item_id,
        'item_name', v_component.item_name, 'required', v_stock_qty,
        'available', v_physical - v_reserved
      ));
    END IF;

    IF v_component.pricing_basis = 'AREA' THEN
      v_piece := jsonb_build_object(
        'component_id', v_component.id, 'role', v_component.item_name,
        'company_item_id', v_component.company_item_id,
        'pricing_company_item_id', v_pricing_item.id,
        'material_family', v_material_family,
        'width_mm', v_width, 'height_mm', v_height,
        'piece_quantity', v_pieces * v_multiplier * _quantity,
        'quantity', v_pieces * v_multiplier * _quantity,
        'piece_area_m2', round(v_width * v_height / 1000000, 6),
        'total_area_m2', v_pricing_qty,
        'specification', v_variant.attributes,
        'variant_id', v_variant.id,
        'cost_per_m2', v_cost, 'sale_price_per_m2', v_sale,
        'total_cost', round(v_pricing_qty * v_cost, 2),
        'total_sale', round(v_pricing_qty * v_sale, 2)
      );
      v_area_pieces := v_area_pieces || jsonb_build_array(v_piece);
      IF v_material_family = 'GLASS' THEN
        v_glass_pieces := v_glass_pieces || jsonb_build_array(v_piece);
      END IF;
    END IF;

    v_materials := v_materials || jsonb_build_array(jsonb_build_object(
      'key', v_component.id, 'source_item_id', v_component.id,
      'item_template_id', v_component.canonical_template_id,
      'company_item_id', v_component.company_item_id,
      'pricing_company_item_id', v_pricing_item.id,
      'item_name', v_component.item_name, 'piece_role', v_component.item_name,
      'material_type', v_component.item_type, 'material_family', v_material_family,
      'pricing_basis', v_component.pricing_basis,
      'unit', v_component.pricing_unit, 'quantity', v_pricing_qty,
      'area_m2', CASE WHEN v_component.pricing_basis = 'AREA' THEN v_pricing_qty ELSE NULL END,
      'stock_quantity', v_stock_qty, 'unit_cost', v_cost, 'unit_sale_price', v_sale,
      'cost', round(v_pricing_qty * v_cost, 2),
      'sale_price', round(v_pricing_qty * v_sale, 2),
      'variant_id', v_variant.id,
      'variant', CASE WHEN v_variant.id IS NULL THEN v_requested_attributes ELSE v_variant.attributes END,
      'width_mm', v_width, 'height_mm', v_height,
      'physical_stock', v_physical, 'reserved_stock', v_reserved,
      'available_stock', v_physical - v_reserved
    ));
    v_total_cost := v_total_cost + round(v_pricing_qty * v_cost, 2);
    v_composition_sale := v_composition_sale + round(v_pricing_qty * v_sale, 2);
  END LOOP;

  IF jsonb_array_length(v_materials) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'material_family', grouped.material_family,
    'pricing_company_item_id', grouped.pricing_company_item_id,
    'variant_id', grouped.variant_id,
    'specification', grouped.specification,
    'area_m2', grouped.area_m2,
    'cost_per_m2', grouped.cost_per_m2,
    'sale_price_per_m2', grouped.sale_price_per_m2,
    'total_cost', grouped.total_cost,
    'total_sale', grouped.total_sale
  ) ORDER BY grouped.material_family, grouped.variant_id), '[]'::jsonb)
  INTO v_area_groups
  FROM (
    SELECT
      e->>'material_family' material_family,
      e->>'pricing_company_item_id' pricing_company_item_id,
      e->>'variant_id' variant_id,
      e->'variant' specification,
      sum((e->>'quantity')::numeric) area_m2,
      (e->>'unit_cost')::numeric cost_per_m2,
      (e->>'unit_sale_price')::numeric sale_price_per_m2,
      sum((e->>'cost')::numeric) total_cost,
      sum((e->>'sale_price')::numeric) total_sale
    FROM jsonb_array_elements(v_materials) e
    WHERE e->>'pricing_basis' = 'AREA'
    GROUP BY e->>'material_family', e->>'pricing_company_item_id', e->>'variant_id',
      e->'variant', (e->>'unit_cost')::numeric, (e->>'unit_sale_price')::numeric
  ) grouped;

  v_area := round((_width_mm * _height_mm / 1000000) * _quantity, 6);
  IF v_product.pricing_type = 'FIXED_PER_SQM' THEN
    IF COALESCE(v_product.price_per_sqm, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE';
    END IF;
    v_total_sale := round(v_area * v_product.price_per_sqm, 2);
  ELSE
    v_total_sale := round(v_composition_sale, 2);
  END IF;

  RETURN jsonb_build_object(
    'composition_mode', 'fixed', 'engine_version', 5, 'snapshot_version', 4,
    'pricing_mode', v_product.pricing_type,
    'fulfillment_mode', COALESCE((SELECT pt.fulfillment_mode FROM public.product_templates pt WHERE pt.id = v_product.product_template_id), 'PRODUCTION'),
    'company_id', _company_id,
    'company_product_id', v_product.id, 'product_template_id', v_product.product_template_id,
    'inputs', jsonb_build_object('L', _width_mm, 'A', _height_mm,
      'width_mm', _width_mm, 'height_mm', _height_mm,
      'quantity', _quantity, 'variants', _variants),
    'variants', _variants, 'materials', v_materials,
    'area_pieces', v_area_pieces, 'glass_pieces', v_glass_pieces,
    'area_pricing_groups', v_area_groups,
    'cuts', '[]'::jsonb, 'rules', '[]'::jsonb,
    'totals', jsonb_build_object(
      'area_m2', v_area, 'cost', round(v_total_cost, 2),
      'composition_sale_price', round(v_composition_sale, 2),
      'sale_price', v_total_sale, 'profit', round(v_total_sale - v_total_cost, 2),
      'margin_percent', CASE WHEN v_total_sale > 0
        THEN round(((v_total_sale - v_total_cost) / v_total_sale) * 100, 2) ELSE NULL END,
      'fixed_price_per_sqm', CASE WHEN v_product.pricing_type = 'FIXED_PER_SQM'
        THEN v_product.price_per_sqm ELSE NULL END
    ),
    'warnings', v_warnings, 'ready_for_quote', true, 'frozen_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) IS
  'Engine v5: tenant-owned AREA pricing with legacy quantity and fulfillment snapshot compatibility.';

NOTIFY pgrst, 'reload schema';
COMMIT;
