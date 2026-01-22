-- Atualizar a RPC para copiar os itens do template para company_product_items durante a ativação
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id UUID,
  _product_template_id UUID,
  _commercial_name TEXT DEFAULT NULL
)
RETURNS public.company_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.company_products;
  v_template public.product_templates;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Verificar se usuário pertence à empresa como admin
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  
  -- Buscar template
  SELECT * INTO v_template FROM public.product_templates WHERE id = _product_template_id;
  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;
  
  -- Verificar se o produto já existe
  SELECT * INTO v_product 
  FROM public.company_products 
  WHERE company_id = _company_id AND product_template_id = _product_template_id;
  
  IF v_product IS NULL THEN
    v_is_new := TRUE;
  END IF;
  
  -- Criar ou atualizar company_product
  INSERT INTO public.company_products (
    company_id,
    product_template_id,
    commercial_name,
    linha,
    category,
    is_active
  ) VALUES (
    _company_id,
    _product_template_id,
    COALESCE(_commercial_name, v_template.name),
    v_template.linha,
    v_template.category,
    true
  )
  ON CONFLICT (company_id, product_template_id) DO UPDATE
    SET is_active = true,
        updated_at = now()
  RETURNING * INTO v_product;
  
  -- Se é um novo produto, copiar os itens do template para company_product_items
  IF v_is_new THEN
    INSERT INTO public.company_product_items (
      company_product_id,
      item_template_id,
      quantity_formula,
      width_formula,
      height_formula,
      is_optional,
      notes,
      sort_order,
      cut_angle,
      pieces_quantity
    )
    SELECT 
      v_product.id,
      pti.item_template_id,
      pti.quantity_formula,
      pti.width_formula,
      pti.height_formula,
      pti.is_optional,
      pti.notes,
      ROW_NUMBER() OVER (ORDER BY pti.id)::INTEGER,
      pti.cut_angle,
      pti.pieces_quantity
    FROM public.product_template_items pti
    WHERE pti.product_template_id = _product_template_id
      AND pti.company_id IS NULL -- Apenas itens globais do template
    ON CONFLICT DO NOTHING;
    
    -- Adicionar os itens ao estoque da empresa se não existirem
    INSERT INTO public.company_stock (
      company_id,
      item_template_id,
      quantity,
      is_active
    )
    SELECT DISTINCT
      _company_id,
      pti.item_template_id,
      0,
      true
    FROM public.product_template_items pti
    WHERE pti.product_template_id = _product_template_id
      AND pti.company_id IS NULL
      AND pti.item_template_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.company_stock cs 
        WHERE cs.company_id = _company_id 
          AND cs.item_template_id = pti.item_template_id
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN v_product;
END;
$$;