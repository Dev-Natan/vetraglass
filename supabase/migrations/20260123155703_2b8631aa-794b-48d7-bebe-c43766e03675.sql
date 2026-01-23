-- Criar tabela para metas de vendas mensais
CREATE TABLE IF NOT EXISTS public.company_sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- formato: YYYY-MM
  goal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, month)
);

-- Enable RLS
ALTER TABLE public.company_sales_goals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their company's goals
CREATE POLICY "Users can view company sales goals"
  ON public.company_sales_goals FOR SELECT
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- Policy: Users can insert goals for their company
CREATE POLICY "Users can insert company sales goals"
  ON public.company_sales_goals FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- Policy: Users can update their company's goals
CREATE POLICY "Users can update company sales goals"
  ON public.company_sales_goals FOR UPDATE
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_sales_goals_company_month ON public.company_sales_goals(company_id, month);