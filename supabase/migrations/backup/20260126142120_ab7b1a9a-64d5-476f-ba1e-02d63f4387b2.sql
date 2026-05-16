-- Fix batch activation failing due to PostgREST RPC overload ambiguity (PGRST203)
-- Keep a single canonical RPC signature: (uuid, uuid)

BEGIN;

-- Remove the overloaded variant that causes ambiguity when calling via REST RPC
DROP FUNCTION IF EXISTS public.activate_product_template_for_company(uuid, uuid, text);

-- Ensure the canonical function exists (2 args)
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_product_id uuid;
  v_item RECORD;
  v_company_item_id uuid;
BEGIN
  -- Buscar dados do template
  SELECT * INTO v_template
  FROM product_templates
  WHERE id = _product_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Verificar se já existe um company_product para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o company_product
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      description,
      category,
      linha,
      image_url,
      is_active,
      is_custom,
      base_price
    ) VALUES (
      _company_id,
      _product_template_id,
      v_template.name,
      v_template.description,
      v_template.category,
      v_template.linha,
      v_template.image_url,
      false,
      false,
      COALESCE(v_template.base_price, 0)
    )
    RETURNING id INTO v_product_id;
  END IF;

  -- Processar cada item do template
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
  LOOP
    -- Garantir que existe um company_item para este item_template
    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id
      AND item_template_id = v_item.item_template_id;

    IF v_company_item_id IS NULL THEN
      -- Criar company_item baseado no template
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        linha,
        description,
        image_url,
        is_active,
        is_custom
      )
      SELECT
        _company_id,
        it.id,
        it.name,
        it.type::text,
        it.unit,
        it.linha,
        it.description,
        it.image_url,
        true,
        false
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;

      -- Criar entrada no estoque se não existir
      INSERT INTO company_stock (
        company_id,
        item_template_id,
        company_item_id,
        quantity,
        min_quantity,
        is_active
      ) VALUES (
        _company_id,
        v_item.item_template_id,
        v_company_item_id,
        0,
        0,
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Inserir ou atualizar o item na composição do produto
    INSERT INTO company_product_items (
      company_product_id,
      item_template_id,
      company_item_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      is_optional,
      notes,
      sort_order
    ) VALUES (
      v_product_id,
      v_item.item_template_id,
      v_company_item_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.cut_angle,
      v_item.pieces_quantity,
      COALESCE(v_item.is_optional, false),
      v_item.notes,
      v_item.sort_order
    )
    ON CONFLICT (company_product_id, item_template_id) DO UPDATE SET
      company_item_id = EXCLUDED.company_item_id,
      quantity_formula = EXCLUDED.quantity_formula,
      width_formula = EXCLUDED.width_formula,
      height_formula = EXCLUDED.height_formula,
      cut_angle = EXCLUDED.cut_angle,
      pieces_quantity = EXCLUDED.pieces_quantity,
      is_optional = EXCLUDED.is_optional,
      notes = EXCLUDED.notes,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  END LOOP;

  -- Remover itens que não estão mais no template
  DELETE FROM company_product_items cpi
  WHERE cpi.company_product_id = v_product_id
    AND cpi.item_template_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_template_items pti
      WHERE pti.product_template_id = _product_template_id
        AND pti.item_template_id = cpi.item_template_id
    );

  RETURN v_product_id;
END;
$$;

COMMIT;