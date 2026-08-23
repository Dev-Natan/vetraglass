-- Phase 3C hotfix: item template glass attributes live in company_items/specifications.
CREATE OR REPLACE FUNCTION public.phase3c_build_fixed_snapshot(
  _product_template_id uuid,
  _company_id uuid,
  _width numeric,
  _height numeric,
  _quantity integer,
  _opening_width numeric DEFAULT NULL,
  _opening_height numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_template record;
  v_component record;
  v_company_item record;
  v_price record;
  v_materials jsonb := '[]'::jsonb;
  v_cuts jsonb := '[]'::jsonb;
  v_glass_pieces jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_width numeric;
  v_height numeric;
  v_pieces numeric;
  v_multiplier numeric;
  v_cut_length numeric;
  v_stock_quantity numeric;
  v_bar_length numeric;
  v_material_key text;
  v_supply_mode text;
  v_total_cost numeric := 0;
  v_total_price numeric := 0;
BEGIN
  IF _company_id IS NULL OR _product_template_id IS NULL
     OR COALESCE(_width, 0) <= 0 OR COALESCE(_height, 0) <= 0 OR COALESCE(_quantity, 0) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;

  SELECT pt.* INTO v_template
  FROM public.product_templates pt
  WHERE pt.id = _product_template_id AND pt.is_active = true;
  IF v_template.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;

  FOR v_component IN
    SELECT pti.*, it.name AS template_name, it.type::text AS template_type,
           it.unit AS template_unit, it.bar_length_mm AS template_bar_length,
           NULL::text AS template_glass_thickness, NULL::text AS template_glass_color
    FROM public.product_template_items pti
    JOIN public.item_templates it ON it.id = pti.item_template_id AND it.is_active = true
    WHERE pti.product_template_id = _product_template_id
      AND pti.company_id IS NULL
    ORDER BY pti.created_at, pti.id
  LOOP
    SELECT ci.* INTO v_company_item
    FROM public.company_items ci
    WHERE ci.company_id = _company_id
      AND ci.item_template_id = v_component.item_template_id
      AND ci.is_active = true
    ORDER BY ci.id LIMIT 1;
    IF v_company_item.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM',
        DETAIL = v_component.item_template_id::text;
    END IF;

    SELECT cip.* INTO v_price
    FROM public.company_item_prices cip
    WHERE cip.company_id = _company_id
      AND cip.item_template_id = v_component.item_template_id;
    IF v_price.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE',
        DETAIL = v_component.item_template_id::text;
    END IF;

    IF NULLIF(btrim(COALESCE(v_component.condition_expression, '')), '') IS NOT NULL
       AND public.phase2a_eval_formula(v_component.condition_expression, _width, _height) = 0 THEN
      CONTINUE;
    END IF;

    v_width := CASE
      WHEN NULLIF(btrim(COALESCE(v_component.piece_width_formula, v_component.width_formula, '')), '') IS NULL THEN NULL
      ELSE public.phase2a_eval_formula(COALESCE(v_component.piece_width_formula, v_component.width_formula), _width, _height)
    END;
    v_height := CASE
      WHEN NULLIF(btrim(COALESCE(v_component.piece_height_formula, v_component.height_formula, '')), '') IS NULL THEN NULL
      ELSE public.phase2a_eval_formula(COALESCE(v_component.piece_height_formula, v_component.height_formula), _width, _height)
    END;
    IF (v_width IS NOT NULL AND v_width <= 0) OR (v_height IS NOT NULL AND v_height <= 0) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE',
        DETAIL = v_component.id::text;
    END IF;

    v_pieces := GREATEST(COALESCE(v_component.pieces_quantity, 1), 1);
    IF NULLIF(btrim(COALESCE(v_component.pieces_formula, '')), '') IS NOT NULL THEN
      v_pieces := GREATEST(ceil(public.phase2a_eval_formula(v_component.pieces_formula, _width, _height)), 0);
    END IF;
    v_multiplier := 1;
    IF NULLIF(btrim(COALESCE(v_component.quantity_formula, '')), '') IS NOT NULL
       AND btrim(v_component.quantity_formula) <> '1' THEN
      v_multiplier := GREATEST(public.phase2a_eval_formula(v_component.quantity_formula, _width, _height), 0);
    END IF;
    v_pieces := round(v_pieces * v_multiplier * _quantity, 3);
    IF v_pieces <= 0 THEN CONTINUE; END IF;

    v_cut_length := COALESCE(v_width, v_height);
    v_bar_length := COALESCE(v_company_item.bar_length_mm, v_component.template_bar_length, 6000);
    v_stock_quantity := CASE
      WHEN v_component.template_type = 'profile' AND v_cut_length IS NOT NULL
        THEN ceil((v_cut_length * v_pieces) / NULLIF(v_bar_length, 0))
      WHEN lower(COALESCE(v_component.template_unit, 'un')) IN ('m2', 'm²')
           AND v_width IS NOT NULL AND v_height IS NOT NULL
        THEN round((v_width * v_height * v_pieces) / 1000000, 3)
      WHEN lower(COALESCE(v_component.template_unit, 'un')) IN ('m', 'ml', 'metro', 'metros')
           AND v_cut_length IS NOT NULL
        THEN round((v_cut_length * v_pieces) / 1000, 3)
      ELSE v_pieces
    END;
    v_material_key := v_component.id::text;
    v_supply_mode := COALESCE(
      v_component.supply_mode,
      CASE WHEN v_component.template_type = 'glass' THEN 'INTERNAL_STOCK' ELSE 'INTERNAL_STOCK' END
    );

    v_materials := v_materials || jsonb_build_array(jsonb_build_object(
      'key', v_material_key,
      'item_template_id', v_component.item_template_id,
      'company_item_id', v_company_item.id,
      'item_name', v_company_item.name,
      'material_type', v_component.template_type,
      'unit', COALESCE(v_component.template_unit, 'un'),
      'quantity', v_stock_quantity,
      'engineering_quantity', v_pieces,
      'cut_length_mm', v_cut_length,
      'bar_length_mm', v_bar_length,
      'cost', round(v_stock_quantity * COALESCE(v_price.cost, 0), 2),
      'sale_price', round(v_stock_quantity * v_price.price, 2),
      'component_role', v_component.component_role,
      'technical_status', v_component.technical_status,
      'source_item_id', v_component.id,
      'supply_mode', v_supply_mode
    ));

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_component.id,
      'item_template_id', v_component.item_template_id,
      'component_role', v_component.component_role,
      'technical_status', v_component.technical_status,
      'source_type', v_component.source_type,
      'source_name', v_component.source_name,
      'source_page', v_component.source_page,
      'source_reference', v_component.source_reference
    ));

    IF v_component.template_type = 'profile' AND v_cut_length IS NOT NULL THEN
      v_cuts := v_cuts || jsonb_build_array(jsonb_build_object(
        'key', v_material_key,
        'item_template_id', v_component.item_template_id,
        'company_item_id', v_company_item.id,
        'item_name', v_company_item.name,
        'length_mm', v_cut_length,
        'quantity', v_pieces,
        'angle_start', v_component.cut_angle_start,
        'angle_end', v_component.cut_angle_end,
        'source_item_id', v_component.id
      ));
    END IF;

    IF v_component.template_type = 'glass' THEN
      IF v_width IS NULL OR v_height IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_GLASS_PIECE',
          DETAIL = v_component.id::text;
      END IF;
      v_glass_pieces := v_glass_pieces || jsonb_build_array(jsonb_build_object(
        'key', v_material_key,
        'item_template_id', v_component.item_template_id,
        'company_item_id', v_company_item.id,
        'piece_role', v_component.component_role,
        'width_mm', v_width,
        'height_mm', v_height,
        'quantity', v_pieces,
        'thickness', COALESCE(v_company_item.glass_thickness, v_component.template_glass_thickness),
        'color', COALESCE(v_company_item.glass_color, v_component.template_glass_color),
        'supply_mode', v_supply_mode,
        'source_item_id', v_component.id
      ));
    END IF;

    v_total_cost := v_total_cost + round(v_stock_quantity * COALESCE(v_price.cost, 0), 2);
    v_total_price := v_total_price + round(v_stock_quantity * v_price.price, 2);
  END LOOP;

  RETURN jsonb_build_object(
    'composition_mode', 'fixed',
    'fulfillment_mode', v_template.fulfillment_mode,
    'engine_version', 2,
    'snapshot_version', 2,
    'product_template_id', _product_template_id,
    'inputs', jsonb_build_object(
      'VW', COALESCE(_opening_width, _width + v_template.installation_gap_width_mm),
      'VH', COALESCE(_opening_height, _height + v_template.installation_gap_height_mm),
      'L', _width,
      'A', _height,
      'width_mm', _width,
      'height_mm', _height,
      'quantity', _quantity,
      'installation_gap_width_mm', v_template.installation_gap_width_mm,
      'installation_gap_height_mm', v_template.installation_gap_height_mm,
      'variants', '{}'::jsonb
    ),
    'variants', '{}'::jsonb,
    'materials', v_materials,
    'glass_pieces', v_glass_pieces,
    'cuts', v_cuts,
    'rules', '[]'::jsonb,
    'rule_versions', '[]'::jsonb,
    'items', v_items,
    'totals', jsonb_build_object(
      'cost', round(v_total_cost, 2),
      'sale_price', round(v_total_price, 2),
      'margin', round(v_total_price - v_total_cost, 2),
      'missing_cost_items', 0,
      'missing_price_items', 0
    ),
    'warnings', '[]'::jsonb,
    'frozen_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phase3c_build_fixed_snapshot(uuid, uuid, numeric, numeric, integer, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase3c_build_fixed_snapshot(uuid, uuid, numeric, numeric, integer, numeric, numeric) TO service_role;
