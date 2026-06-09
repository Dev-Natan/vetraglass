ALTER TABLE public.company_product_items 
ADD COLUMN IF NOT EXISTS pieces_formula TEXT,
ADD COLUMN IF NOT EXISTS cut_angle_start NUMERIC DEFAULT 90,
ADD COLUMN IF NOT EXISTS cut_angle_end NUMERIC DEFAULT 90,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Atualiza a função de ativação corrigindo a referência às colunas
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
  -- 1. Garante que o produto existe na empresa (company_products)
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

  -- 2. Limpa itens antigos para re-sincronizar
  DELETE FROM company_product_items WHERE company_product_id = v_product_id;

  -- 3. Sincroniza itens de composição
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
      AND (company_id IS NULL OR company_id = _company_id)
    ORDER BY created_at, id
  LOOP
    v_sort_counter := v_sort_counter + 1;

    -- Garante que o item existe no cadastro da empresa (company_items)
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

    -- Insere o item na composição do produto da empresa com TODOS os campos técnicos
    INSERT INTO company_product_items (
      company_product_id,
      company_item_id,
      item_template_id,
      quantity_formula,
      width_formula,
      height_formula,
      pieces_quantity,
      pieces_formula,
      cut_angle,
      cut_angle_start,
      cut_angle_end,
      side,
      sort_order,
      company_id,
      notes,
      section,
      calculation_type,
      applies_to
    ) VALUES (
      v_product_id,
      v_company_item_id,
      v_item.item_template_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.pieces_quantity,
      v_item.pieces_formula,
      v_item.cut_angle,
      v_item.cut_angle_start,
      v_item.cut_angle_end,
      v_item.side,
      v_sort_counter,
      _company_id,
      v_item.notes,
      v_item.section,
      v_item.calculation_type,
      v_item.applies_to
    );

    -- 4. Garante que o item está no estoque da empresa
    INSERT INTO company_stock (
      company_id,
      item_template_id,
      quantity,
      min_quantity,
      is_active,
      allow_fractional
    )
    SELECT
      _company_id,
      v_item.item_template_id,
      0,
      0,
      true,
      (SELECT type = 'profile' FROM item_templates WHERE id = v_item.item_template_id)
    ON CONFLICT (company_id, item_template_id) DO NOTHING;
  END LOOP;

  RETURN v_product_id;
END;
$function$;
