-- Problema: A constraint UNIQUE(company_product_id, item_template_id) impede
-- que o mesmo item apareça múltiplas vezes na composição de um produto.
-- Porém, alguns templates têm o mesmo item repetido (ex: 2 montantes iguais com fórmulas diferentes).

-- 1. Remover a constraint problemática
ALTER TABLE public.company_product_items 
DROP CONSTRAINT IF EXISTS company_product_items_product_item_unique;

-- 2. Recriar a função de ativação SEM usar ON CONFLICT
-- Agora ela irá deletar e reinserir todos os itens
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
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
  -- Verificar se já existe um produto ativado para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o produto da empresa baseado no template
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
      max_height
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
      pt.max_height
    FROM product_templates pt
    WHERE pt.id = _product_template_id
    RETURNING id INTO v_product_id;
  END IF;

  -- IMPORTANTE: Deletar itens existentes antes de reinserir
  -- Isso permite que itens duplicados no template sejam copiados corretamente
  DELETE FROM company_product_items WHERE company_product_id = v_product_id;

  -- Copiar os itens do template para o produto da empresa
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
      AND company_id IS NULL
    ORDER BY created_at, id
  LOOP
    v_sort_counter := v_sort_counter + 1;
    
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

    -- Inserir cada item na composição do produto (agora pode haver duplicados)
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
      v_sort_counter
    );
  END LOOP;

  RETURN v_product_id;
END;
$function$;