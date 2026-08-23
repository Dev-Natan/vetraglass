-- Transactional company item configuration: metadata + canonical pricing + stock delta.
CREATE OR REPLACE FUNCTION public.save_company_item_configuration(
  _company_id uuid,
  _company_item_id uuid,
  _item_template_id uuid,
  _name text,
  _item_type text,
  _stock_unit text,
  _pricing_unit text,
  _cost numeric,
  _basis text,
  _value numeric,
  _target_stock numeric,
  _min_stock numeric DEFAULT 0,
  _location text DEFAULT NULL,
  _allow_fractional boolean DEFAULT false,
  _is_active boolean DEFAULT true,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.company_items;
  v_template public.item_templates;
  v_stock public.company_stock;
  v_markup numeric;
  v_sale numeric;
  v_delta numeric;
  v_movement_id uuid;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF NULLIF(btrim(_name), '') IS NULL OR NULLIF(btrim(_item_type), '') IS NULL
     OR NULLIF(btrim(_stock_unit), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ITEM_CONFIGURATION';
  END IF;
  IF _cost IS NULL OR _cost <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_COST', DETAIL = _name;
  END IF;
  IF upper(_basis) = 'MARKUP' AND _value IS NOT NULL AND _value >= 0 THEN
    v_markup := _value;
    v_sale := round(_cost * (1 + _value / 100), 4);
  ELSIF upper(_basis) = 'SALE_PRICE' AND _value IS NOT NULL AND _value > 0 THEN
    v_sale := _value;
    v_markup := round(((_value / _cost) - 1) * 100, 4);
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_PRICE', DETAIL = _name;
  END IF;
  IF COALESCE(_target_stock, 0) < 0 OR COALESCE(_min_stock, 0) < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'STOCK_ADJUSTMENT_FAILED';
  END IF;

  IF _company_item_id IS NOT NULL THEN
    SELECT * INTO v_item FROM public.company_items
    WHERE id = _company_item_id AND company_id = _company_id FOR UPDATE;
  ELSIF _item_template_id IS NOT NULL THEN
    SELECT * INTO v_item FROM public.company_items
    WHERE company_id = _company_id AND item_template_id = _item_template_id FOR UPDATE;
  END IF;

  IF v_item.id IS NULL THEN
    IF _item_template_id IS NOT NULL THEN
      SELECT * INTO v_template FROM public.item_templates
      WHERE id = _item_template_id AND is_active;
      IF v_template.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
      END IF;
    END IF;
    INSERT INTO public.company_items(
      company_id, item_template_id, name, description, type, unit, pricing_unit,
      cost, markup_percent, sale_price, specifications, image_url, linha,
      is_custom, is_active, bar_length_mm, weight_kg, weight_per_meter,
      altura_mm, largura_mm, comprimento_linear_mm, thickness_mm, glass_color,
      ncm, cest, cfop_venda, cfop_venda_interestadual, origem,
      codigo_servico, aliquota_iss
    ) VALUES (
      _company_id, _item_template_id, btrim(_name), COALESCE(_metadata->>'description', v_template.description),
      btrim(_item_type), btrim(_stock_unit), NULLIF(btrim(_pricing_unit), ''),
      _cost, v_markup, v_sale, v_template.specifications,
      COALESCE(NULLIF(_metadata->>'image_url', ''), v_template.image_url),
      NULLIF(_metadata->>'linha', ''), _item_template_id IS NULL, _is_active,
      NULLIF(_metadata->>'bar_length_mm', '')::numeric,
      NULLIF(_metadata->>'weight_kg', '')::numeric,
      NULLIF(_metadata->>'weight_per_meter', '')::numeric,
      NULLIF(_metadata->>'altura_mm', '')::numeric,
      NULLIF(_metadata->>'largura_mm', '')::numeric,
      NULLIF(_metadata->>'comprimento_linear_mm', '')::numeric,
      NULLIF(_metadata->>'thickness_mm', '')::numeric,
      NULLIF(_metadata->>'glass_color', ''), NULLIF(_metadata->>'ncm', ''),
      NULLIF(_metadata->>'cest', ''), NULLIF(_metadata->>'cfop_venda', ''),
      NULLIF(_metadata->>'cfop_venda_interestadual', ''), NULLIF(_metadata->>'origem', ''),
      NULLIF(_metadata->>'codigo_servico', ''), NULLIF(_metadata->>'aliquota_iss', '')::numeric
    ) RETURNING * INTO v_item;
  ELSE
    UPDATE public.company_items SET
      name = btrim(_name), type = btrim(_item_type), unit = btrim(_stock_unit),
      pricing_unit = NULLIF(btrim(_pricing_unit), ''), cost = _cost,
      markup_percent = v_markup, sale_price = v_sale, is_active = _is_active,
      image_url = COALESCE(NULLIF(_metadata->>'image_url', ''), image_url),
      linha = NULLIF(_metadata->>'linha', ''),
      bar_length_mm = NULLIF(_metadata->>'bar_length_mm', '')::numeric,
      weight_kg = NULLIF(_metadata->>'weight_kg', '')::numeric,
      weight_per_meter = NULLIF(_metadata->>'weight_per_meter', '')::numeric,
      altura_mm = NULLIF(_metadata->>'altura_mm', '')::numeric,
      largura_mm = NULLIF(_metadata->>'largura_mm', '')::numeric,
      comprimento_linear_mm = NULLIF(_metadata->>'comprimento_linear_mm', '')::numeric,
      thickness_mm = NULLIF(_metadata->>'thickness_mm', '')::numeric,
      glass_color = NULLIF(_metadata->>'glass_color', ''),
      ncm = NULLIF(_metadata->>'ncm', ''), cest = NULLIF(_metadata->>'cest', ''),
      cfop_venda = NULLIF(_metadata->>'cfop_venda', ''),
      cfop_venda_interestadual = NULLIF(_metadata->>'cfop_venda_interestadual', ''),
      origem = NULLIF(_metadata->>'origem', ''),
      codigo_servico = NULLIF(_metadata->>'codigo_servico', ''),
      aliquota_iss = NULLIF(_metadata->>'aliquota_iss', '')::numeric
    WHERE id = v_item.id RETURNING * INTO v_item;
  END IF;

  SELECT * INTO v_stock FROM public.company_stock
  WHERE company_id = _company_id AND company_item_id = v_item.id FOR UPDATE;
  IF v_stock.id IS NULL THEN
    INSERT INTO public.company_stock(
      company_id, company_item_id, item_template_id, quantity, min_quantity,
      location, allow_fractional, is_active
    ) VALUES (
      _company_id, v_item.id, v_item.item_template_id, 0, COALESCE(_min_stock, 0),
      NULLIF(btrim(_location), ''), _allow_fractional, _is_active
    ) RETURNING * INTO v_stock;
  END IF;
  v_delta := COALESCE(_target_stock, 0) - v_stock.quantity;
  UPDATE public.company_stock SET
    quantity = COALESCE(_target_stock, 0), min_quantity = COALESCE(_min_stock, 0),
    location = NULLIF(btrim(_location), ''), allow_fractional = _allow_fractional,
    is_active = _is_active
  WHERE id = v_stock.id;

  IF v_delta <> 0 THEN
    INSERT INTO public.stock_movements(
      company_id, company_item_id, item_template_id, type, category, quantity,
      unit_cost, description, created_by, reference_type
    ) VALUES (
      _company_id, v_item.id, v_item.item_template_id,
      CASE WHEN v_delta > 0 THEN 'entrada' ELSE 'saida' END,
      CASE WHEN v_delta > 0 THEN 'ajuste_positivo' ELSE 'ajuste_negativo' END,
      abs(v_delta), v_item.cost, 'Ajuste pela configuração do item', auth.uid(),
      'item_configuration'
    ) RETURNING id INTO v_movement_id;
  END IF;
  RETURN jsonb_build_object('company_item_id', v_item.id, 'stock_id', v_stock.id,
    'movement_id', v_movement_id, 'stock_delta', v_delta,
    'cost', v_item.cost, 'markup_percent', v_item.markup_percent,
    'sale_price', v_item.sale_price);
END;
$$;

REVOKE ALL ON FUNCTION public.save_company_item_configuration(
  uuid, uuid, uuid, text, text, text, text, numeric, text, numeric,
  numeric, numeric, text, boolean, boolean, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_company_item_configuration(
  uuid, uuid, uuid, text, text, text, text, numeric, text, numeric,
  numeric, numeric, text, boolean, boolean, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.save_company_item_configuration(
  uuid, uuid, uuid, text, text, text, text, numeric, text, numeric,
  numeric, numeric, text, boolean, boolean, jsonb
) IS 'Atomic Phase 3E item metadata, canonical price and physical stock configuration.';

NOTIFY pgrst, 'reload schema';
