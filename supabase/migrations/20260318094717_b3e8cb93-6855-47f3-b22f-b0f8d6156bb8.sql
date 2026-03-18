
CREATE TABLE public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'basico',
  plan_price NUMERIC NOT NULL DEFAULT 98.99,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saas_admin_select_subscriptions" ON public.company_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_saas_admin(auth.uid()));

CREATE POLICY "saas_admin_insert_subscriptions" ON public.company_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE POLICY "saas_admin_update_subscriptions" ON public.company_subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_saas_admin(auth.uid()));

CREATE POLICY "saas_admin_delete_subscriptions" ON public.company_subscriptions
  FOR DELETE TO authenticated
  USING (public.is_saas_admin(auth.uid()));

CREATE POLICY "company_view_own_subscription" ON public.company_subscriptions
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));
