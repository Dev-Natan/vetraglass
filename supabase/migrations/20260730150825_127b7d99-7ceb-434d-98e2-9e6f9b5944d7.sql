ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS actual_start DATE,
  ADD COLUMN IF NOT EXISTS actual_end DATE;

UPDATE public.ordens_servico SET status = 'in_progress' WHERE status = 'em_producao';
UPDATE public.ordens_servico SET status = 'pending' WHERE status IN ('aguardando', 'aguardando_inicio');