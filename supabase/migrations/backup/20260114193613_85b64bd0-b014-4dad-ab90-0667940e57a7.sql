-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their company logo
CREATE POLICY "Users can upload company logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to update their company logo
CREATE POLICY "Users can update company logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to delete their company logo
CREATE POLICY "Users can delete company logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
);

-- Allow public access to view company logos (for PDFs)
CREATE POLICY "Company logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-logos');