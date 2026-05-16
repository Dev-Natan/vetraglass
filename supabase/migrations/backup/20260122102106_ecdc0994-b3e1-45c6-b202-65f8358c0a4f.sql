-- Corrige ativação em lote garantindo que a ativação sempre crie/recupere componentes (perfis, vidros, acessórios)
-- 1) Atualiza a RPC de ativação
-- 2) Faz backfill para produtos já ativados que ficaram sem componentes

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

  -- Garantir company_items para todos os componentes do template
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_items ci
      WHERE ci.company_id = _company_id
        AND ci.item_template_id = it.id
    );

  -- Garantir estoque para os componentes (com vínculo opcional ao company_item)
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
    updated_at = now();

  -- Garantir composição (company_product_items) mesmo em reativações
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_product_items cpi
      WHERE cpi.company_product_id = v_product.id
        AND cpi.item_template_id = pti.item_template_id
    );

  RETURN v_product;
END;
$$;

-- =========================
-- Backfill (corrigir produtos já ativados que ficaram sem componentes)
-- =========================

-- 1) Criar company_items faltantes
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
  cp.company_id,
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
FROM public.company_products cp
JOIN public.product_template_items pti
  ON pti.product_template_id = cp.product_template_id
 AND pti.company_id IS NULL
JOIN public.item_templates it ON it.id = pti.item_template_id
WHERE cp.product_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_items ci
    WHERE ci.company_id = cp.company_id
      AND ci.item_template_id = it.id
  );

-- 2) Garantir company_stock e vincular company_item_id quando possível
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
  cp.company_id,
  it.id,
  0,
  0,
  true,
  false,
  ci.id
FROM public.company_products cp
JOIN public.product_template_items pti
  ON pti.product_template_id = cp.product_template_id
 AND pti.company_id IS NULL
JOIN public.item_templates it ON it.id = pti.item_template_id
JOIN public.company_items ci
  ON ci.company_id = cp.company_id
 AND ci.item_template_id = it.id
WHERE cp.product_template_id IS NOT NULL
ON CONFLICT (company_id, item_template_id)
DO UPDATE SET
  company_item_id = COALESCE(company_stock.company_item_id, EXCLUDED.company_item_id),
  updated_at = now();

-- 3) Popular company_product_items faltantes
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
  cp.id,
  pti.item_template_id,
  ci.id,
  pti.quantity_formula,
  pti.width_formula,
  pti.height_formula,
  pti.is_optional,
  pti.notes,
  ROW_NUMBER() OVER (PARTITION BY cp.id ORDER BY pti.created_at, pti.id)::INTEGER,
  pti.cut_angle,
  pti.pieces_quantity,
  now(),
  now()
FROM public.company_products cp
JOIN public.product_template_items pti
  ON pti.product_template_id = cp.product_template_id
 AND pti.company_id IS NULL
JOIN public.company_items ci
  ON ci.company_id = cp.company_id
 AND ci.item_template_id = pti.item_template_id
WHERE cp.product_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_product_items cpi
    WHERE cpi.company_product_id = cp.id
      AND cpi.item_template_id = pti.item_template_id
  );
