-- Criar tabela de notificações internas da empresa
CREATE TABLE IF NOT EXISTS public.company_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_role TEXT NOT NULL, -- 'admin', 'gerente', ou user_id específico
  type TEXT NOT NULL, -- 'cash_open_request', 'generic', etc.
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  action_taken BOOLEAN DEFAULT false,
  action_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_company_notifications_company ON public.company_notifications(company_id);
CREATE INDEX idx_company_notifications_to_role ON public.company_notifications(to_role);
CREATE INDEX idx_company_notifications_type ON public.company_notifications(type);
CREATE INDEX idx_company_notifications_unread ON public.company_notifications(company_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.company_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
-- Usuários podem ver notificações da sua empresa
CREATE POLICY "Users can view company notifications"
ON public.company_notifications
FOR SELECT
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e WHERE e.user_id = auth.uid()
  )
);

-- Usuários podem criar notificações na sua empresa
CREATE POLICY "Users can create notifications in their company"
ON public.company_notifications
FOR INSERT
WITH CHECK (
  from_user_id = auth.uid()
  AND company_id IN (
    SELECT e.company_id FROM public.employees e WHERE e.user_id = auth.uid()
  )
);

-- Admins e gerentes podem atualizar notificações (marcar como lida, action_taken)
CREATE POLICY "Admins can update notifications"
ON public.company_notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.permission_profiles pp ON e.permission_profile_id = pp.id
    WHERE e.user_id = auth.uid()
      AND e.company_id = company_notifications.company_id
      AND pp.profile_type IN ('admin', 'gerente')
  )
);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_notifications;