-- VetraGlass Phase 1A: additive repair of critical frontend/database contracts.
-- This migration intentionally preserves all existing rows.

-- ---------------------------------------------------------------------------
-- clients.client_type
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'cliente';

ALTER TABLE public.clients
  ALTER COLUMN client_type SET DEFAULT 'cliente',
  ALTER COLUMN client_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND conname = 'clients_client_type_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_client_type_check
      CHECK (client_type IN ('cliente', 'fornecedor', 'ambos'));
  END IF;
END
$$;

COMMENT ON COLUMN public.clients.client_type IS
  'Unified registry role: cliente, fornecedor, or ambos.';

-- The composite candidate key lets child records prove tenant compatibility.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND conname = 'clients_id_company_id_key'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_id_company_id_key UNIQUE (id, company_id);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- quotes.client_id -> clients.id, with company compatibility enforced by FK.
-- RESTRICT preserves quote history instead of silently detaching its client.
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS client_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname = 'quotes_client_company_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_client_company_fkey
      FOREIGN KEY (client_id, company_id)
      REFERENCES public.clients (id, company_id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_quotes_company_client
  ON public.quotes (company_id, client_id)
  WHERE client_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- material_consumption.os_item_id -> os_items.id.
-- A trigger also guarantees the item belongs to the same service order.
-- ---------------------------------------------------------------------------
ALTER TABLE public.material_consumption
  ADD COLUMN IF NOT EXISTS os_item_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.material_consumption'::regclass
      AND conname = 'material_consumption_os_item_id_fkey'
  ) THEN
    ALTER TABLE public.material_consumption
      ADD CONSTRAINT material_consumption_os_item_id_fkey
      FOREIGN KEY (os_item_id)
      REFERENCES public.os_items (id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_material_consumption_os_item
  ON public.material_consumption (os_item_id)
  WHERE os_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_material_consumption_os_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.os_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.os_items AS oi
    JOIN public.ordens_servico AS os
      ON os.id = oi.os_id
    WHERE oi.id = NEW.os_item_id
      AND oi.os_id = NEW.ordem_servico_id
      AND os.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'os_item_id must belong to ordem_servico_id and company_id';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_material_consumption_os_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_material_consumption_os_item() FROM anon;
REVOKE ALL ON FUNCTION public.validate_material_consumption_os_item() FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.material_consumption'::regclass
      AND tgname = 'trg_validate_material_consumption_os_item'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_validate_material_consumption_os_item
      BEFORE INSERT OR UPDATE OF os_item_id, ordem_servico_id
      ON public.material_consumption
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_material_consumption_os_item();
  END IF;
END
$$;
