-- Criar tabela de controle de lembretes do sistema
CREATE TABLE public.system_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- 'quote_expiring', 'overdue_receivable'
  reference_id UUID NOT NULL,  -- ID do orçamento ou conta a receber
  reference_table TEXT NOT NULL, -- 'quotes' ou 'accounts_receivable'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reference_id, reminder_type) -- evita duplicatas
);

-- Habilitar RLS
ALTER TABLE public.system_reminders ENABLE ROW LEVEL SECURITY;

-- Policies para system_reminders
CREATE POLICY "Users can view reminders for their company"
ON public.system_reminders
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert reminders"
ON public.system_reminders
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete reminders for their company"
ON public.system_reminders
FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
  )
);

-- Adicionar colunas de configuração de lembretes
ALTER TABLE company_notification_settings 
ADD COLUMN IF NOT EXISTS notify_quote_expiring BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_overdue_receivables BOOLEAN DEFAULT true;

-- Criar índices para performance
CREATE INDEX idx_system_reminders_company ON public.system_reminders(company_id);
CREATE INDEX idx_system_reminders_type ON public.system_reminders(reminder_type);
CREATE INDEX idx_system_reminders_reference ON public.system_reminders(reference_id, reminder_type);