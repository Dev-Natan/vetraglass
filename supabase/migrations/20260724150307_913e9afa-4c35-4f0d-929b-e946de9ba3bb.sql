
-- item_templates: colunas fiscais e técnicas
ALTER TABLE public.item_templates
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop_venda text,
  ADD COLUMN IF NOT EXISTS cfop_venda_interestadual text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS codigo_servico text,
  ADD COLUMN IF NOT EXISTS aliquota_iss numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_ibs numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_cbs numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_is  numeric(6,3),
  ADD COLUMN IF NOT EXISTS weight_per_bar numeric;

-- company_items: mesmas colunas fiscais
ALTER TABLE public.company_items
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop_venda text,
  ADD COLUMN IF NOT EXISTS cfop_venda_interestadual text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS codigo_servico text,
  ADD COLUMN IF NOT EXISTS aliquota_iss numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_ibs numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_cbs numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_is  numeric(6,3),
  ADD COLUMN IF NOT EXISTS weight_per_bar numeric;

-- tax_categories: renomear/aliases (adicionar novas colunas)
ALTER TABLE public.tax_categories
  ADD COLUMN IF NOT EXISTS ncm_code text,
  ADD COLUMN IF NOT EXISTS aliquota_ibs numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_cbs numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_is  numeric(6,3),
  ADD COLUMN IF NOT EXISTS aliquota_iss numeric(6,3);
-- Migrar ncm -> ncm_code se ainda vazio
UPDATE public.tax_categories SET ncm_code = ncm WHERE ncm_code IS NULL AND ncm IS NOT NULL;

-- service_appointments: campos usados no dashboard/agenda
ALTER TABLE public.service_appointments
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time_start time,
  ADD COLUMN IF NOT EXISTS scheduled_time_end time;
-- Preencher scheduled_date a partir de scheduled_at
UPDATE public.service_appointments
   SET scheduled_date = scheduled_at::date,
       scheduled_time_start = scheduled_at::time
 WHERE scheduled_date IS NULL AND scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_appointments_date ON public.service_appointments (company_id, scheduled_date);

-- sale_items: notes
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS notes text;

-- quote_deposits: cliente + status
ALTER TABLE public.quote_deposits
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS deposit_status text;

-- quotes: deposit_status para lock/gate
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_status text;

-- sales: motivo de cancelamento
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancellation_reason text;
