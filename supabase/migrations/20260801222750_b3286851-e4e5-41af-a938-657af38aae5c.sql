-- First ensure the column exists (it should from previous steps but the relationship needs it)
-- The error "could not find the relation between expenses and clients" means the FK is missing at the DB level

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'expenses_supplier_id_fkey' 
        AND table_name = 'expenses'
    ) THEN
        ALTER TABLE public.expenses 
        ADD CONSTRAINT expenses_supplier_id_fkey 
        FOREIGN KEY (supplier_id) 
        REFERENCES public.clients(id) 
        ON DELETE SET NULL;
    END IF;
END $$;
