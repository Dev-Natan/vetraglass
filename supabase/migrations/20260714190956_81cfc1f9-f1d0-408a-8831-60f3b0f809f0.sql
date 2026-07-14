
-- 1) company_products: track overrides
ALTER TABLE public.company_products
  ADD COLUMN IF NOT EXISTS overridden_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customized_at timestamptz;

-- 2) quote_items: freeze composition snapshot
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS composition_snapshot jsonb;

-- 3) Helper: add a field slug to overridden_fields (idempotent)
CREATE OR REPLACE FUNCTION public.mark_company_product_override(
  p_company_product_id uuid,
  p_field text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.company_products
     SET overridden_fields = (
           SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
             FROM jsonb_array_elements_text(overridden_fields || to_jsonb(p_field)) AS x
         ),
         customized_at = COALESCE(customized_at, now()),
         is_custom = true,
         updated_at = now()
   WHERE id = p_company_product_id;
END;
$$;

-- 4) Trigger on company_product_items → flag 'composition' override
CREATE OR REPLACE FUNCTION public.trg_flag_composition_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpid uuid;
BEGIN
  v_cpid := COALESCE(NEW.company_product_id, OLD.company_product_id);
  IF v_cpid IS NOT NULL THEN
    PERFORM public.mark_company_product_override(v_cpid, 'composition');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_composition_override ON public.company_product_items;
CREATE TRIGGER trg_flag_composition_override
AFTER INSERT OR UPDATE OR DELETE ON public.company_product_items
FOR EACH ROW EXECUTE FUNCTION public.trg_flag_composition_override();

-- 5) Trigger on company_products → flag field-level overrides
CREATE OR REPLACE FUNCTION public.trg_flag_company_product_overrides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fields text[] := ARRAY[]::text[];
  v_new_arr jsonb;
BEGIN
  IF NEW.product_template_id IS NULL THEN
    -- Custom (não linkado a template): não rastreia overrides
    RETURN NEW;
  END IF;

  IF NEW.commercial_name IS DISTINCT FROM OLD.commercial_name THEN v_fields := v_fields || 'commercial_name'; END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN v_fields := v_fields || 'description'; END IF;
  IF NEW.image_url IS DISTINCT FROM OLD.image_url THEN v_fields := v_fields || 'image_url'; END IF;
  IF NEW.linha IS DISTINCT FROM OLD.linha THEN v_fields := v_fields || 'linha'; END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN v_fields := v_fields || 'category'; END IF;
  IF NEW.base_price IS DISTINCT FROM OLD.base_price THEN v_fields := v_fields || 'base_price'; END IF;
  IF NEW.price_per_sqm IS DISTINCT FROM OLD.price_per_sqm THEN v_fields := v_fields || 'price_per_sqm'; END IF;
  IF NEW.cost_per_sqm IS DISTINCT FROM OLD.cost_per_sqm THEN v_fields := v_fields || 'cost_per_sqm'; END IF;
  IF NEW.margin_percent IS DISTINCT FROM OLD.margin_percent THEN v_fields := v_fields || 'margin_percent'; END IF;
  IF NEW.pricing_type IS DISTINCT FROM OLD.pricing_type THEN v_fields := v_fields || 'pricing_type'; END IF;

  IF array_length(v_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
    INTO v_new_arr
    FROM jsonb_array_elements_text(
      COALESCE(NEW.overridden_fields, '[]'::jsonb) || to_jsonb(v_fields)
    ) AS x;

  NEW.overridden_fields := v_new_arr;
  NEW.customized_at := COALESCE(NEW.customized_at, now());
  NEW.is_custom := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_company_product_overrides ON public.company_products;
CREATE TRIGGER trg_flag_company_product_overrides
BEFORE UPDATE ON public.company_products
FOR EACH ROW EXECUTE FUNCTION public.trg_flag_company_product_overrides();

-- 6) Reset a single composition item back to its template equivalent.
--    If not present in the template, just deletes the customization.
CREATE OR REPLACE FUNCTION public.reset_company_product_item(
  p_company_product_item_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpid uuid;
  v_tpl_id uuid;
  v_item_tpl_id uuid;
  v_company_id uuid;
  v_tpl_row public.product_template_items%ROWTYPE;
  v_new_company_item_id uuid;
BEGIN
  SELECT cpi.company_product_id, cp.product_template_id, cpi.item_template_id, cp.company_id
    INTO v_cpid, v_tpl_id, v_item_tpl_id, v_company_id
    FROM public.company_product_items cpi
    JOIN public.company_products cp ON cp.id = cpi.company_product_id
   WHERE cpi.id = p_company_product_item_id;

  IF v_cpid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item não encontrado');
  END IF;

  IF v_tpl_id IS NULL OR v_item_tpl_id IS NULL THEN
    DELETE FROM public.company_product_items WHERE id = p_company_product_item_id;
    RETURN jsonb_build_object('success', true, 'action', 'deleted');
  END IF;

  SELECT * INTO v_tpl_row
    FROM public.product_template_items
   WHERE product_template_id = v_tpl_id
     AND item_template_id = v_item_tpl_id
   LIMIT 1;

  IF NOT FOUND THEN
    DELETE FROM public.company_product_items WHERE id = p_company_product_item_id;
    RETURN jsonb_build_object('success', true, 'action', 'deleted_no_template');
  END IF;

  SELECT id INTO v_new_company_item_id
    FROM public.company_items
   WHERE company_id = v_company_id AND item_template_id = v_item_tpl_id
   LIMIT 1;

  UPDATE public.company_product_items
     SET quantity_formula = v_tpl_row.quantity_formula,
         width_formula    = v_tpl_row.width_formula,
         height_formula   = v_tpl_row.height_formula,
         pieces_formula   = v_tpl_row.pieces_formula,
         pieces_quantity  = v_tpl_row.pieces_quantity,
         cut_angle        = v_tpl_row.cut_angle,
         cut_angle_start  = v_tpl_row.cut_angle_start,
         cut_angle_end    = v_tpl_row.cut_angle_end,
         side             = v_tpl_row.side,
         section          = v_tpl_row.section,
         is_optional      = v_tpl_row.is_optional,
         calculation_type = v_tpl_row.calculation_type,
         applies_to       = v_tpl_row.applies_to,
         loss_percent     = v_tpl_row.loss_percent,
         notes            = v_tpl_row.notes,
         company_item_id  = COALESCE(v_new_company_item_id, company_item_id),
         updated_at       = now()
   WHERE id = p_company_product_item_id;

  RETURN jsonb_build_object('success', true, 'action', 'reset');
END;
$$;

-- 7) Reset a single field on company_products back to template value
CREATE OR REPLACE FUNCTION public.reset_company_product_field(
  p_company_product_id uuid,
  p_field text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl public.product_templates%ROWTYPE;
  v_cp  public.company_products%ROWTYPE;
  v_new_arr jsonb;
BEGIN
  SELECT * INTO v_cp FROM public.company_products WHERE id = p_company_product_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;
  IF v_cp.product_template_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto sem template origem');
  END IF;

  SELECT * INTO v_tpl FROM public.product_templates WHERE id = v_cp.product_template_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template origem não existe');
  END IF;

  CASE p_field
    WHEN 'commercial_name' THEN UPDATE public.company_products SET commercial_name = v_tpl.name WHERE id = p_company_product_id;
    WHEN 'description'     THEN UPDATE public.company_products SET description = v_tpl.description WHERE id = p_company_product_id;
    WHEN 'image_url'       THEN UPDATE public.company_products SET image_url = v_tpl.image_url WHERE id = p_company_product_id;
    WHEN 'linha'           THEN UPDATE public.company_products SET linha = v_tpl.linha WHERE id = p_company_product_id;
    WHEN 'category'        THEN UPDATE public.company_products SET category = v_tpl.category WHERE id = p_company_product_id;
    WHEN 'base_price'      THEN UPDATE public.company_products SET base_price = v_tpl.base_price WHERE id = p_company_product_id;
    WHEN 'composition'     THEN
      -- Full composition rebuild from template
      DELETE FROM public.company_product_items WHERE company_product_id = p_company_product_id;
      INSERT INTO public.company_product_items (
        company_product_id, item_template_id, company_id,
        quantity_formula, width_formula, height_formula, pieces_formula, pieces_quantity,
        cut_angle, cut_angle_start, cut_angle_end,
        side, section, is_optional, calculation_type, applies_to,
        loss_percent, notes, sort_order,
        company_item_id
      )
      SELECT
        p_company_product_id, pti.item_template_id, v_cp.company_id,
        pti.quantity_formula, pti.width_formula, pti.height_formula, pti.pieces_formula, pti.pieces_quantity,
        pti.cut_angle, pti.cut_angle_start, pti.cut_angle_end,
        pti.side, pti.section, pti.is_optional, pti.calculation_type, pti.applies_to,
        pti.loss_percent, pti.notes, pti.sort_order,
        (SELECT id FROM public.company_items ci WHERE ci.company_id = v_cp.company_id AND ci.item_template_id = pti.item_template_id LIMIT 1)
      FROM public.product_template_items pti
      WHERE pti.product_template_id = v_cp.product_template_id;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Campo não suportado: ' || p_field);
  END CASE;

  -- Remove field from overridden_fields
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_new_arr
    FROM jsonb_array_elements_text(v_cp.overridden_fields) AS x
   WHERE x <> p_field;

  UPDATE public.company_products
     SET overridden_fields = v_new_arr,
         is_custom = (jsonb_array_length(v_new_arr) > 0),
         customized_at = CASE WHEN jsonb_array_length(v_new_arr) > 0 THEN customized_at ELSE NULL END,
         updated_at = now()
   WHERE id = p_company_product_id;

  RETURN jsonb_build_object('success', true, 'field', p_field);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_company_product_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_company_product_field(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_company_product_override(uuid, text) TO authenticated;
