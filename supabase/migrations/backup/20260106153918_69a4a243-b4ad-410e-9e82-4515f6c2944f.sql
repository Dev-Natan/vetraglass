-- Criar bucket para imagens dos templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-templates', 'item-templates', true);

-- Policy para visualizar imagens (público)
CREATE POLICY "Anyone can view item template images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-templates');

-- Policy para upload (apenas SaaS admins)
CREATE POLICY "SaaS admins can upload item template images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-templates' 
  AND is_saas_admin(auth.uid())
);

-- Policy para update (apenas SaaS admins)
CREATE POLICY "SaaS admins can update item template images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'item-templates' 
  AND is_saas_admin(auth.uid())
);

-- Policy para delete (apenas SaaS admins)
CREATE POLICY "SaaS admins can delete item template images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'item-templates' 
  AND is_saas_admin(auth.uid())
);

-- Adicionar coluna de imagem na tabela item_templates
ALTER TABLE public.item_templates ADD COLUMN IF NOT EXISTS image_url TEXT;