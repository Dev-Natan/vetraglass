-- 1. Criar bucket para fotos de OS
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-photos', 'os-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar bucket para imagens de produtos da empresa (caso não exista)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-product-images', 'company-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Criar tabela para fotos de OS
CREATE TABLE IF NOT EXISTS public.os_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  description TEXT,
  photo_type TEXT DEFAULT 'general', -- 'before', 'after', 'progress', 'general'
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.os_photos ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for os_photos
CREATE POLICY "Users can view OS photos for their company"
  ON public.os_photos FOR SELECT
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

CREATE POLICY "Users can upload OS photos for their company"
  ON public.os_photos FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

CREATE POLICY "Users can delete OS photos for their company"
  ON public.os_photos FOR DELETE
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- 6. Create index
CREATE INDEX IF NOT EXISTS idx_os_photos_ordem_servico ON public.os_photos(ordem_servico_id);

-- 7. Storage policies for os-photos bucket
CREATE POLICY "Anyone can view OS photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'os-photos');

CREATE POLICY "Authenticated users can upload OS photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'os-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete OS photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'os-photos' AND auth.role() = 'authenticated');

-- 8. Storage policies for company-product-images bucket
CREATE POLICY "Anyone can view company product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-product-images');

CREATE POLICY "Authenticated users can upload company product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update company product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'company-product-images' AND auth.role() = 'authenticated');