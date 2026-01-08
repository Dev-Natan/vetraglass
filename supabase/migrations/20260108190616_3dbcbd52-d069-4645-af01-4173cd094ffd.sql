-- Create bucket for product template images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-templates', 'product-templates', true);

-- Policy for public read access
CREATE POLICY "Public read access for product templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-templates');

-- Policy for authenticated users to upload
CREATE POLICY "Authenticated upload access for product templates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-templates' AND auth.role() = 'authenticated');

-- Policy for authenticated users to update
CREATE POLICY "Authenticated update access for product templates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-templates' AND auth.role() = 'authenticated');

-- Policy for authenticated users to delete
CREATE POLICY "Authenticated delete access for product templates"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-templates' AND auth.role() = 'authenticated');