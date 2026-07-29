CREATE POLICY "Allow authenticated users to select own company documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Allow authenticated users to upload own company documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Allow authenticated users to update own company documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Allow authenticated users to delete own company documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);