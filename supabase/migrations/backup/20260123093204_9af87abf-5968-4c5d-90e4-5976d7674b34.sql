-- Add photo_url column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access
CREATE POLICY "Public read access for employee photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

-- Policy for authenticated users to upload photos for their company employees
CREATE POLICY "Company members can upload employee photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-photos' AND
  auth.role() = 'authenticated'
);

-- Policy for company members to update employee photos
CREATE POLICY "Company members can update employee photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-photos' AND
  auth.role() = 'authenticated'
);

-- Policy for company members to delete employee photos
CREATE POLICY "Company members can delete employee photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-photos' AND
  auth.role() = 'authenticated'
);