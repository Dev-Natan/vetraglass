-- Update the foreign key for cash_movements
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'cash_movements_fornecedor_id_fkey' 
        AND table_name = 'cash_movements'
    ) THEN
        ALTER TABLE public.cash_movements 
        DROP CONSTRAINT cash_movements_fornecedor_id_fkey;
    END IF;

    ALTER TABLE public.cash_movements 
    ADD CONSTRAINT cash_movements_fornecedor_id_fkey 
    FOREIGN KEY (fornecedor_id) 
    REFERENCES public.clients(id) 
    ON DELETE SET NULL;
END $$;
