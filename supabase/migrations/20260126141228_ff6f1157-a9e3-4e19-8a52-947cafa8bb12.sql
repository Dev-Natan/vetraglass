
-- Melhorar a função de ativação para garantir que TODOS os itens sejam sempre sincronizados
-- Usa ON CONFLICT para atualizar itens existentes e adicionar novos

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
  v_items_created INTEGER := 0;
  v_composition_created INTEGER := 0;
BEGIN
  -- Permissão: admin da empresa
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Template
  SELECT * INTO v_template
  FROM public.product_templates
  WHERE id = _product_template_id;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Upsert do produto da empresa
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
        commercial_name = COALESCE(EXCLUDED.commercial_name, company_products.commercial_name),
        updated_at = now()
  RETURNING * INTO v_product;

  -- 1. Garantir company_items para TODOS os componentes do template
  -- Usa ON CONFLICT para não falhar se já existir
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
    _company_id,
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
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_id, item_template_id) 
  DO UPDATE SET
    -- Atualiza apenas se estava inativo
    is_active = true,
    updated_at = now();

  GET DIAGNOSTICS v_items_created = ROW_COUNT;

  -- 2. Garantir estoque para os componentes
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
    _company_id,
    it.id,
    0,
    0,
    true,
    false,
    ci.id
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  JOIN public.company_items ci
    ON ci.company_id = _company_id
   AND ci.item_template_id = it.id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_id, item_template_id)
  DO UPDATE SET
    company_item_id = COALESCE(company_stock.company_item_id, EXCLUDED.company_item_id),
    is_active = true,
    updated_at = now();

  -- 3. Garantir composição usando ON CONFLICT para sincronização completa
  -- Remove itens que não estão mais no template
  DELETE FROM public.company_product_items cpi
  WHERE cpi.company_product_id = v_product.id
    AND NOT EXISTS (
      SELECT 1 FROM public.product_template_items pti
      WHERE pti.product_template_id = _product_template_id
        AND pti.company_id IS NULL
        AND pti.item_template_id = cpi.item_template_id
    );

  -- Insere ou atualiza itens da composição
  INSERT INTO public.company_product_items (
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
    v_product.id,
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
  FROM public.product_template_items pti
  JOIN public.company_items ci
    ON ci.company_id = _company_id
   AND ci.item_template_id = pti.item_template_id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_product_id, item_template_id) 
  DO UPDATE SET
    company_item_id = EXCLUDED.company_item_id,
    quantity_formula = EXCLUDED.quantity_formula,
    width_formula = EXCLUDED.width_formula,
    height_formula = EXCLUDED.height_formula,
    pieces_quantity = EXCLUDED.pieces_quantity,
    cut_angle = EXCLUDED.cut_angle,
    is_optional = EXCLUDED.is_optional,
    notes = EXCLUDED.notes,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  GET DIAGNOSTICS v_composition_created = ROW_COUNT;

  -- Atualizar imagem do produto da empresa se não tiver
  UPDATE public.company_products
  SET image_url = COALESCE(company_products.image_url, v_template.image_url),
      updated_at = now()
  WHERE id = v_product.id
    AND (image_url IS NULL OR image_url = '');

  RETURN v_product;
END;
$$;

-- Garantir que a constraint única existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'company_items_company_id_item_template_id_key'
  ) THEN
    ALTER TABLE public.company_items
    ADD CONSTRAINT company_items_company_id_item_template_id_key 
    UNIQUE (company_id, item_template_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
