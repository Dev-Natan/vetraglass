-- Phase 2: create only the Storage infrastructure used by the current frontend.
-- This migration creates no application data and copies no historical objects.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('company-logos', 'company-logos', true, 5242880, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('company-item-images', 'company-item-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('company-product-images', 'company-product-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('employee-photos', 'employee-photos', false, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('item-templates', 'item-templates', true, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('os-photos', 'os-photos', false, 10485760, ARRAY['image/png','image/jpeg','image/webp']),
  ('product-images', 'product-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('product-templates', 'product-templates', true, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('support-attachments', 'support-attachments', false, 20971520, NULL),
  ('client-documents', 'client-documents', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Tenant-scoped public media. Public affects downloads only; writes remain RLS-protected.
CREATE POLICY "Tenant members read company public media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('company-logos','company-item-images','company-product-images')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members insert company public media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('company-logos','company-item-images','company-product-images')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members update company public media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('company-logos','company-item-images','company-product-images')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id IN ('company-logos','company-item-images','company-product-images')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members delete company public media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('company-logos','company-item-images','company-product-images')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

-- Private tenant media (employee and service-order photos).
CREATE POLICY "Tenant members read private company media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('employee-photos','os-photos')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members insert private company media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('employee-photos','os-photos')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members update private company media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('employee-photos','os-photos')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id IN ('employee-photos','os-photos')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant members delete private company media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('employee-photos','os-photos')
  AND EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid() AND uc.is_active
      AND uc.company_id::text = (storage.foldername(name))[1]
  )
);

-- Global catalogs are public to read and SaaS-admin-only to mutate.
CREATE POLICY "SaaS admins read catalog media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('item-templates','product-images','product-templates')
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins insert catalog media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('item-templates','product-images','product-templates')
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins update catalog media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('item-templates','product-images','product-templates')
  AND public.is_saas_admin(auth.uid())
)
WITH CHECK (
  bucket_id IN ('item-templates','product-images','product-templates')
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins delete catalog media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('item-templates','product-images','product-templates')
  AND public.is_saas_admin(auth.uid())
);

-- Support attachments are keyed by ticket/message; authorize through the ticket company.
CREATE POLICY "Ticket participants read support files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id::text = (storage.foldername(name))[1]
      AND (public.user_belongs_to_company(auth.uid(), st.company_id) OR public.is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Ticket participants insert support files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id::text = (storage.foldername(name))[1]
      AND (public.user_belongs_to_company(auth.uid(), st.company_id) OR public.is_saas_admin(auth.uid()))
  )
);

-- Shared PDFs are private and remain owned by the authenticated user folder.
CREATE POLICY "Users read their shared PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users insert their shared PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their shared PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
