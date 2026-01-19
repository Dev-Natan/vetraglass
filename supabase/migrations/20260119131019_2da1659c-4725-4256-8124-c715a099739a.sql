-- 1. Criar bucket para imagens de produtos da empresa
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-product-images', 'company-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para o bucket
CREATE POLICY "Public read access for company product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-product-images');

CREATE POLICY "Company users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Company users can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Company users can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-product-images' 
  AND auth.role() = 'authenticated'
);

-- 2. Adicionar colunas necessárias em company_product_items (cut_angle e pieces_quantity)
ALTER TABLE public.company_product_items 
  ADD COLUMN IF NOT EXISTS cut_angle INTEGER DEFAULT 90;

ALTER TABLE public.company_product_items 
  ADD COLUMN IF NOT EXISTS pieces_quantity INTEGER DEFAULT 1;

-- 3. Criar função atômica de reset de produto
CREATE OR REPLACE FUNCTION public.reset_company_product_to_template(
  p_company_product_id UUID,
  p_user_id UUID
)
RETURNS JSONB
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
  v_template_image TEXT;
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
  
  -- 4. Iniciar transação atômica
  
  -- 4.1. Apagar composição atual da empresa
  DELETE FROM company_product_items
  WHERE company_product_id = p_company_product_id;
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;
  
  -- 4.2. Recriar composição a partir do template
  INSERT INTO company_product_items (
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
    p_company_product_id,
    pti.item_template_id,
    pti.quantity_formula,
    pti.width_formula,
    pti.height_formula,
    pti.is_optional,
    pti.notes,
    ROW_NUMBER() OVER (ORDER BY pti.id),
    pti.cut_angle,
    pti.pieces_quantity
  FROM product_template_items pti
  WHERE pti.product_template_id = v_template_id
  AND pti.company_id IS NULL; -- Apenas itens globais do template
  GET DIAGNOSTICS v_items_created = ROW_COUNT;
  
  -- 4.3. Restaurar imagem do template (se existir)
  SELECT pt.image_url INTO v_template_image
  FROM product_templates pt
  WHERE pt.id = v_template_id;
  
  UPDATE company_products
  SET image_url = v_template_image,
      updated_at = now()
  WHERE id = p_company_product_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'items_deleted', v_items_deleted,
    'items_created', v_items_created,
    'template_id', v_template_id
  );
END;
$$;

-- 4. Adicionar comentário na função
COMMENT ON FUNCTION public.reset_company_product_to_template IS 'Reseta um produto da empresa para o estado original do template. Apenas admins podem executar.';

-- 5. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_company_product_items_company_product_id 
  ON public.company_product_items(company_product_id);

-- 6. Migrar itens de product_template_items para company_product_items (se ainda não migrados)
-- Isso cria a composição inicial para company_products que já existem mas não têm itens
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
SELECT DISTINCT
  cp.id as company_product_id,
  pti.item_template_id,
  pti.quantity_formula,
  pti.width_formula,
  pti.height_formula,
  pti.is_optional,
  pti.notes,
  ROW_NUMBER() OVER (PARTITION BY cp.id ORDER BY pti.id),
  pti.cut_angle,
  pti.pieces_quantity
FROM public.company_products cp
JOIN public.product_template_items pti ON pti.product_template_id = cp.product_template_id
LEFT JOIN public.company_product_items cpi ON cpi.company_product_id = cp.id
WHERE cp.product_template_id IS NOT NULL
AND pti.company_id IS NULL -- Apenas itens globais do template
AND cpi.id IS NULL -- Apenas se não existem itens ainda
GROUP BY cp.id, pti.id, pti.item_template_id, pti.quantity_formula, 
         pti.width_formula, pti.height_formula, pti.is_optional, 
         pti.notes, pti.cut_angle, pti.pieces_quantity;