
-- 1) Backfill: sincroniza has_multiple_sides dos templates para os produtos das empresas
UPDATE company_products cp
SET has_multiple_sides = pt.has_multiple_sides
FROM product_templates pt
WHERE cp.product_template_id = pt.id
  AND COALESCE(cp.has_multiple_sides, false) IS DISTINCT FROM COALESCE(pt.has_multiple_sides, false);

-- 2) Atualiza a função de ativação para copiar has_multiple_sides
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(_company_id uuid, _product_template_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id UUID;
  v_item RECORD;
  v_company_item_id UUID;
  v_sort_counter INTEGER := 0;
BEGIN
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      category,
      linha,
      description,
      image_url,
      is_active,
      is_custom,
      min_width,
      max_width,
      min_height,
      max_height,
      has_multiple_sides
    )
    SELECT
      _company_id,
      pt.id,
      pt.name,
      pt.category,
      pt.linha,
      pt.description,
      pt.image_url,
      true,
      false,
      pt.min_width,
      pt.max_width,
      pt.min_height,
      pt.max_height,
      COALESCE(pt.has_multiple_sides, false)
    FROM product_templates pt
    WHERE pt.id = _product_template_id
    RETURNING id INTO v_product_id;
  ELSE
    UPDATE company_products
    SET is_active = true,
        has_multiple_sides = COALESCE((SELECT has_multiple_sides FROM product_templates WHERE id = _product_template_id), has_multiple_sides),
        updated_at = now()
    WHERE id = v_product_id;
  END IF;

  DELETE FROM company_product_items WHERE company_product_id = v_product_id;

  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
      AND company_id IS NULL
    ORDER BY created_at, id
  LOOP
    v_sort_counter := v_sort_counter + 1;

    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id
      AND item_template_id = v_item.item_template_id;

    IF v_company_item_id IS NULL THEN
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        is_active
      )
      SELECT
        _company_id,
        it.id,
        it.name,
        it.type,
        it.unit,
        true
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;
    END IF;

    INSERT INTO company_product_items (
      company_product_id,
      company_item_id,
      item_template_id,
      quantity_formula,
      width_formula,
      height_formula,
      pieces_quantity,
      pieces_formula,
      side,
      sort_order,
      company_id
    ) VALUES (
      v_product_id,
      v_company_item_id,
      v_item.item_template_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.pieces_quantity,
      v_item.pieces_formula,
      v_item.side,
      v_sort_counter,
      _company_id
    );
  END LOOP;

  RETURN v_product_id;
END;
$function$;
