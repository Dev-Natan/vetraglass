-- Create bucket for company item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-item-images', 'company-item-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy to allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload company item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-item-images');

-- RLS policy to allow authenticated users to update their images
CREATE POLICY "Authenticated users can update company item images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-item-images');

-- RLS policy to allow authenticated users to delete their images
CREATE POLICY "Authenticated users can delete company item images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-item-images');

-- RLS policy to allow public viewing of item images
CREATE POLICY "Anyone can view company item images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'company-item-images');