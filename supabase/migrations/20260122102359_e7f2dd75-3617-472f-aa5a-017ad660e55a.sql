-- Atualiza RPC para re-sincronizar componentes vinculando company_item_id corretamente
CREATE OR REPLACE FUNCTION public.reset_company_product_to_template(
  p_company_product_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_template_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_user_role TEXT;
  v_items_deleted INTEGER;
  v_items_created INTEGER;
BEGIN
  -- 1. Buscar produto da empresa e verificar se existe
  SELECT cp.company_id, cp.product_template_id
  INTO v_company_id, v_template_id
  FROM company_products cp
  WHERE cp.id = p_company_product_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;
  
  -- 2. Verificar se tem template associado
  IF v_template_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto personalizado não pode ser resetado');
  END IF;
  
  -- 3. Verificar permissão do usuário (deve ser admin)
  SELECT ur.role INTO v_user_role
  FROM user_roles ur
  WHERE ur.user_id = p_user_id;
  
  IF v_user_role = 'admin' OR v_user_role = 'saas_admin' THEN
    v_is_admin := TRUE;
  END IF;
  
  -- Verificar via employees se tem permissão
  IF NOT v_is_admin THEN
    SELECT EXISTS(
      SELECT 1 FROM employees e
      JOIN permission_profiles pp ON e.permission_profile_id = pp.id
      WHERE e.user_id = p_user_id
      AND e.company_id = v_company_id
      AND pp.name = 'Administrador'
    ) INTO v_is_admin;
  END IF;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem resetar produtos');
  END IF;
  
  -- 4. Garantir company_items para todos os componentes do template
  INSERT INTO public.company_items (
    company_id,
    item_template_id,
    name,
    description,
    type,
    unit,
    cost,
    sale_price,
    specifications,
    image_url,
    linha,
    is_custom,
    is_active,
    created_at,
    updated_at
  )
  SELECT DISTINCT
    v_company_id,
    it.id,
    it.name,
    it.description,
    it.type::text,
    it.unit,
    0,
    COALESCE(it.default_price, 0),
    it.specifications,
    it.image_url,
    it.linha,
    false,
    true,
    now(),
    now()
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  WHERE pti.product_template_id = v_template_id
    AND pti.company_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_items ci
      WHERE ci.company_id = v_company_id
        AND ci.item_template_id = it.id
    );

  -- 5. Garantir estoque para os componentes
  INSERT INTO public.company_stock (
    company_id,
    item_template_id,
    quantity,
    min_quantity,
    is_active,
    allow_fractional,
    company_item_id
  )
  SELECT DISTINCT
    v_company_id,
    it.id,
    0,
    0,
    true,
    false,
    ci.id
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  JOIN public.company_items ci
    ON ci.company_id = v_company_id
   AND ci.item_template_id = it.id
  WHERE pti.product_template_id = v_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_id, item_template_id)
  DO UPDATE SET
    company_item_id = COALESCE(company_stock.company_item_id, EXCLUDED.company_item_id),
    updated_at = now();
  
  -- 6. Apagar composição atual da empresa
  DELETE FROM company_product_items
  WHERE company_product_id = p_company_product_id;
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;
  
  -- 7. Recriar composição a partir do template com company_item_id
  INSERT INTO company_product_items (
    company_product_id,
    item_template_id,
    company_item_id,
    quantity_formula,
    width_formula,
    height_formula,
    is_optional,
    notes,
    sort_order,
    cut_angle,
    pieces_quantity,
    created_at,
    updated_at
  )
  SELECT 
    p_company_product_id,
    pti.item_template_id,
    ci.id,
    pti.quantity_formula,
    pti.width_formula,
    pti.height_formula,
    pti.is_optional,
    pti.notes,
    ROW_NUMBER() OVER (ORDER BY pti.created_at, pti.id)::INTEGER,
    pti.cut_angle,
    pti.pieces_quantity,
    now(),
    now()
  FROM product_template_items pti
  JOIN public.company_items ci
    ON ci.company_id = v_company_id
   AND ci.item_template_id = pti.item_template_id
  WHERE pti.product_template_id = v_template_id
    AND pti.company_id IS NULL;
  GET DIAGNOSTICS v_items_created = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'items_deleted', v_items_deleted,
    'items_created', v_items_created,
    'template_id', v_template_id
  );
END;
$$;