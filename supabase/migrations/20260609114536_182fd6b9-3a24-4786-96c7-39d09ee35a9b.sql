-- 1) Atualiza a função de ativação individual para ser mais completa e incluir estoque
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
      AND (company_id IS NULL OR company_id = _company_id) -- Pega os globais
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
      notes
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
      v_item.notes
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

-- 2) Cria função para distribuir para todas as empresas
CREATE OR REPLACE FUNCTION public.distribute_product_template_to_all_companies(_product_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comp RECORD;
BEGIN
  FOR v_comp IN SELECT id FROM companies LOOP
    PERFORM public.activate_product_template_for_company(v_comp.id, _product_template_id);
  END LOOP;
END;
$function$;

-- 3) Cria o Trigger para automação
CREATE OR REPLACE FUNCTION public.on_product_template_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Se for novo e estiver ativo, ou se foi ativado agora
  IF (TG_OP = 'INSERT' AND NEW.is_active = true) OR 
     (TG_OP = 'UPDATE' AND NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL)) THEN
    PERFORM public.distribute_product_template_to_all_companies(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_distribute_product_template ON public.product_templates;
CREATE TRIGGER tr_distribute_product_template
AFTER INSERT OR UPDATE ON public.product_templates
FOR EACH ROW EXECUTE FUNCTION public.on_product_template_change();

-- 4) Permissões
GRANT EXECUTE ON FUNCTION public.activate_product_template_for_company(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.distribute_product_template_to_all_companies(uuid) TO authenticated, service_role;
