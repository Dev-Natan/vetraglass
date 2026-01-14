-- Add certificate columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS certificado_digital_url text,
ADD COLUMN IF NOT EXISTS certificado_digital_validade timestamp with time zone,
ADD COLUMN IF NOT EXISTS certificado_digital_nome text;

-- Add comments for documentation
COMMENT ON COLUMN public.companies.certificado_digital_url IS 'URL of the uploaded digital certificate (.pfx/.p12)';
COMMENT ON COLUMN public.companies.certificado_digital_validade IS 'Certificate expiration date';
COMMENT ON COLUMN public.companies.certificado_digital_nome IS 'Certificate holder name/description';

-- Create storage bucket for certificates (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-certificates', 'company-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for certificates bucket
CREATE POLICY "Company admins can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Company admins can view certificates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Company admins can update certificates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Company admins can delete certificates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);