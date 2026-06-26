
-- 1) Realtime: lock down broadcast/presence subscriptions while preserving postgres_changes (table RLS still applies)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use postgres_changes" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can subscribe to own company topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can send to own company topics" ON realtime.messages;

-- Allow postgres_changes (CDC). Per-row visibility is already governed by RLS on the underlying public tables.
CREATE POLICY "Authenticated can use postgres_changes"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');

-- Allow broadcast/presence ONLY on topics scoped to a company the user belongs to.
-- Convention enforced going forward: topic = 'company:{company_id}' or 'company:{company_id}:...'
CREATE POLICY "Authenticated can subscribe to own company topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension IN ('broadcast','presence')
  AND topic ~ '^company:[0-9a-f-]{36}(:|$)'
  AND public.user_belongs_to_company(
    auth.uid(),
    (substring(topic from '^company:([0-9a-f-]{36})'))::uuid
  )
);

CREATE POLICY "Authenticated can send to own company topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension IN ('broadcast','presence')
  AND topic ~ '^company:[0-9a-f-]{36}(:|$)'
  AND public.user_belongs_to_company(
    auth.uid(),
    (substring(topic from '^company:([0-9a-f-]{36})'))::uuid
  )
);

-- 2) Allow users to DELETE their own support-attachments (uploads scoped via support_tickets/messages)
DROP POLICY IF EXISTS "Users can delete attachments from their company tickets" ON storage.objects;
CREATE POLICY "Users can delete attachments from their company tickets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id::text = (storage.foldername(objects.name))[1]
      AND (public.user_belongs_to_company(auth.uid(), st.company_id) OR public.is_saas_admin(auth.uid()))
  )
);

-- 3) Explicit SELECT policies on public buckets, scoped by company folder.
-- These buckets remain public for CDN, but direct API reads from authenticated
-- users are now restricted to their own company's folder.
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['company-logos','company-product-images','product-images','company-item-images']
  LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS "Authenticated read own company files in %s" ON storage.objects$f$, b);
    EXECUTE format($f$
      CREATE POLICY "Authenticated read own company files in %1$s"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = %2$L
        AND public.user_belongs_to_company(
          auth.uid(),
          ((string_to_array(name, '/'))[1])::uuid
        )
      )
    $f$, b, b);
  END LOOP;
END $$;
