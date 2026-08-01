ALTER TABLE public.expenses 
DROP CONSTRAINT IF EXISTS expenses_supplier_id_fkey;

ALTER TABLE public.expenses
ADD CONSTRAINT expenses_supplier_id_fkey 
FOREIGN KEY (supplier_id) 
REFERENCES public.clients(id) 
ON DELETE SET NULL;

-- Ensure RLS and grants allow this join
GRANT SELECT ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
