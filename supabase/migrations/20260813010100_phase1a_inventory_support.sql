-- VetraGlass Phase 1A: missing support relations, financial view, and OS stock reservation.
-- No physical stock is decremented by this migration or by reserve_os_materials().

-- Composite candidate keys used by tenant-safe foreign keys.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_products'::regclass
      AND conname = 'company_products_id_company_id_key'
  ) THEN
    ALTER TABLE public.company_products
      ADD CONSTRAINT company_products_id_company_id_key UNIQUE (id, company_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_items'::regclass
      AND conname = 'company_items_id_company_id_key'
  ) THEN
    ALTER TABLE public.company_items
      ADD CONSTRAINT company_items_id_company_id_key UNIQUE (id, company_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ordens_servico'::regclass
      AND conname = 'ordens_servico_id_company_id_key'
  ) THEN
    ALTER TABLE public.ordens_servico
      ADD CONSTRAINT ordens_servico_id_company_id_key UNIQUE (id, company_id);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Linhas enabled by a company.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_enabled_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  linha_slug text NOT NULL REFERENCES public.product_linhas(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_enabled_linhas_company_slug_key UNIQUE (company_id, linha_slug)
);

CREATE INDEX IF NOT EXISTS idx_company_enabled_linhas_company
  ON public.company_enabled_linhas (company_id);

ALTER TABLE public.company_enabled_linhas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.company_enabled_linhas FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.company_enabled_linhas TO authenticated;
GRANT ALL ON TABLE public.company_enabled_linhas TO service_role;

CREATE POLICY phase1a_company_enabled_linhas_select
  ON public.company_enabled_linhas
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

CREATE POLICY phase1a_company_enabled_linhas_insert
  ON public.company_enabled_linhas
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_elevated_role_in_company((SELECT auth.uid()), company_id));

CREATE POLICY phase1a_company_enabled_linhas_delete
  ON public.company_enabled_linhas
  FOR DELETE TO authenticated
  USING (public.user_has_elevated_role_in_company((SELECT auth.uid()), company_id));

-- ---------------------------------------------------------------------------
-- Price variants for a company product.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_product_price_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_product_id uuid NOT NULL,
  description text NOT NULL,
  glass_type text,
  thickness_mm numeric,
  color text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost numeric CHECK (cost IS NULL OR cost >= 0),
  unit text NOT NULL DEFAULT 'm2',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_product_price_lines_product_company_fkey
    FOREIGN KEY (company_product_id, company_id)
    REFERENCES public.company_products (id, company_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_product_price_lines_product
  ON public.company_product_price_lines (company_product_id);
CREATE INDEX IF NOT EXISTS idx_company_product_price_lines_company
  ON public.company_product_price_lines (company_id);

ALTER TABLE public.company_product_price_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.company_product_price_lines FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_product_price_lines TO authenticated;
GRANT ALL ON TABLE public.company_product_price_lines TO service_role;

CREATE POLICY phase1a_company_product_price_lines_select
  ON public.company_product_price_lines
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_company_product_price_lines_insert
  ON public.company_product_price_lines
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_company_product_price_lines_update
  ON public.company_product_price_lines
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_company_product_price_lines_delete
  ON public.company_product_price_lines
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.company_product_price_lines'::regclass
      AND tgname = 'trg_phase1a_company_product_price_lines_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_phase1a_company_product_price_lines_updated_at
      BEFORE UPDATE ON public.company_product_price_lines
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Investment allocation configuration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  color text NOT NULL DEFAULT '#3b82f6',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_allocations_company
  ON public.investment_allocations (company_id);

ALTER TABLE public.investment_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.investment_allocations FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.investment_allocations TO authenticated;
GRANT ALL ON TABLE public.investment_allocations TO service_role;

CREATE POLICY phase1a_investment_allocations_select
  ON public.investment_allocations FOR SELECT TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_investment_allocations_insert
  ON public.investment_allocations FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_investment_allocations_update
  ON public.investment_allocations FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_investment_allocations_delete
  ON public.investment_allocations FOR DELETE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.investment_allocations'::regclass
      AND tgname = 'trg_phase1a_investment_allocations_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_phase1a_investment_allocations_updated_at
      BEFORE UPDATE ON public.investment_allocations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'investment_allocations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_allocations;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Reusable stock offcuts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_offcuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id uuid REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id uuid,
  kind text NOT NULL CHECK (kind IN ('vidro', 'perfil')),
  name text NOT NULL,
  color text,
  thickness numeric CHECK (thickness IS NULL OR thickness >= 0),
  width_mm numeric CHECK (width_mm IS NULL OR width_mm >= 0),
  height_mm numeric CHECK (height_mm IS NULL OR height_mm >= 0),
  length_mm numeric CHECK (length_mm IS NULL OR length_mm >= 0),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'used', 'discarded')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'plano_corte', 'os', 'ajuste')),
  source_os_id uuid,
  source_reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_offcuts_company_item_company_fkey
    FOREIGN KEY (company_item_id, company_id)
    REFERENCES public.company_items (id, company_id)
    ON DELETE SET NULL (company_item_id),
  CONSTRAINT stock_offcuts_source_os_company_fkey
    FOREIGN KEY (source_os_id, company_id)
    REFERENCES public.ordens_servico (id, company_id)
    ON DELETE SET NULL (source_os_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_offcuts_company_status
  ON public.stock_offcuts (company_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_offcuts_item_template
  ON public.stock_offcuts (item_template_id);
CREATE INDEX IF NOT EXISTS idx_stock_offcuts_company_kind
  ON public.stock_offcuts (company_id, kind);

ALTER TABLE public.stock_offcuts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stock_offcuts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stock_offcuts TO authenticated;
GRANT ALL ON TABLE public.stock_offcuts TO service_role;

CREATE POLICY phase1a_stock_offcuts_select
  ON public.stock_offcuts FOR SELECT TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_stock_offcuts_insert
  ON public.stock_offcuts FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_stock_offcuts_update
  ON public.stock_offcuts FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY phase1a_stock_offcuts_delete
  ON public.stock_offcuts FOR DELETE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.stock_offcuts'::regclass
      AND tgname = 'trg_phase1a_stock_offcuts_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_phase1a_stock_offcuts_updated_at
      BEFORE UPDATE ON public.stock_offcuts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Financial status view expected by the cash/sales frontend.
-- security_invoker makes the underlying RLS policies apply to the caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.quote_financial_status
WITH (security_invoker = true)
AS
SELECT
  q.id AS quote_id,
  q.company_id,
  q.quote_number,
  q.customer_name,
  COALESCE(q.valor_final_aprovado, q.final_amount, 0) AS final_amount,
  q.status,
  q.created_at,
  totals.total_deposits,
  totals.total_sold,
  GREATEST(
    COALESCE(q.valor_final_aprovado, q.final_amount, 0)
      - totals.total_deposits
      - totals.total_sold,
    0
  ) AS pending_amount,
  CASE
    WHEN COALESCE(q.valor_final_aprovado, q.final_amount, 0)
      - totals.total_deposits
      - totals.total_sold <= 0
      THEN 'fully_paid'
    WHEN totals.total_deposits + totals.total_sold > 0
      THEN 'partially_paid'
    ELSE 'pending'
  END AS financial_status
FROM public.quotes AS q
CROSS JOIN LATERAL (
  SELECT
    COALESCE((
      SELECT SUM(qd.amount)
      FROM public.quote_deposits AS qd
      WHERE qd.quote_id = q.id
        AND qd.company_id = q.company_id
        AND qd.status IN ('received', 'billed')
    ), 0) AS total_deposits,
    COALESCE((
      SELECT SUM(s.total_amount)
      FROM public.sales AS s
      WHERE s.quote_id = q.id
        AND s.company_id = q.company_id
        AND s.payment_status <> 'cancelled'
        AND s.sale_type IS DISTINCT FROM 'partial'
    ), 0) AS total_sold
) AS totals
WHERE q.status IN ('approved', 'aprovado');

REVOKE ALL ON TABLE public.quote_financial_status FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.quote_financial_status TO authenticated, service_role;

COMMENT ON VIEW public.quote_financial_status IS
  'Tenant-safe, security-invoker financial status for approved quotes.';

-- ---------------------------------------------------------------------------
-- One active reservation per OS and company item makes replay deterministic.
-- Existing official data has no reservation rows; this index must be reviewed
-- before application if that changes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stock_reservations
    WHERE status = 'reserved'
    GROUP BY ordem_servico_id, company_item_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create active reservation uniqueness: duplicate reserved rows require manual reconciliation';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_reservations_active_os_item
  ON public.stock_reservations (ordem_servico_id, company_item_id)
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_stock_reservations_company_item_reserved
  ON public.stock_reservations (company_id, company_item_id)
  INCLUDE (quantity_reserved)
  WHERE status = 'reserved';

CREATE OR REPLACE FUNCTION public.reserve_os_materials(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_physical numeric;
  v_other_reserved numeric;
  v_target numeric;
  v_reserved_rows integer := 0;
  v_reserved_quantity numeric := 0;
  v_shortages jsonb := '[]'::jsonb;
  v_skipped integer := 0;
  requirement record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  SELECT os.company_id
  INTO v_company_id
  FROM public.ordens_servico AS os
  WHERE os.id = _ordem_servico_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'User is not an active member of the service order company';
  END IF;

  FOR requirement IN
    SELECT
      ci.id AS company_item_id,
      ci.name AS item_name,
      ci.unit AS stock_unit,
      SUM(
        CASE
          WHEN om.item_type = 'profile' AND COALESCE(om.bars_needed, 0) > 0
            THEN om.bars_needed
          WHEN lower(COALESCE(om.unit, ci.unit, 'un')) IN ('m', 'ml', 'metro', 'metros')
            THEN COALESCE(om.total_length_mm, 0)::numeric / 1000
          WHEN lower(COALESCE(om.unit, ci.unit, 'un')) IN ('m2', 'm²')
            THEN (
              COALESCE(oi.width_production, oi.largura_producao, 0)
              * COALESCE(oi.height_production, oi.altura_producao, 0)
              * GREATEST(COALESCE(om.pieces_count, 1), 1)
            )::numeric / 1000000
          ELSE GREATEST(COALESCE(om.pieces_count, 0), 0)::numeric
        END
      ) AS required_quantity
    FROM public.os_materials AS om
    JOIN public.company_items AS ci
      ON ci.company_id = v_company_id
     AND ci.item_template_id = om.item_template_id
     AND ci.is_active = true
    LEFT JOIN public.os_items AS oi
      ON oi.id = om.os_item_id
     AND oi.os_id = om.ordem_servico_id
    WHERE om.ordem_servico_id = _ordem_servico_id
      AND om.item_template_id IS NOT NULL
    GROUP BY ci.id, ci.name, ci.unit
    ORDER BY ci.id
  LOOP
    IF requirement.required_quantity <= 0 THEN
      UPDATE public.stock_reservations AS sr
      SET status = 'cancelled',
          quantity_reserved = 0,
          cancelled_at = COALESCE(sr.cancelled_at, now()),
          updated_at = now()
      WHERE sr.company_id = v_company_id
        AND sr.ordem_servico_id = _ordem_servico_id
        AND sr.company_item_id = requirement.company_item_id
        AND sr.status = 'reserved';
      CONTINUE;
    END IF;

    -- Serialize reservations for the same physical stock item. More than one
    -- active stock row is tolerated and summed deterministically.
    PERFORM cs.id
    FROM public.company_stock AS cs
    WHERE cs.company_id = v_company_id
      AND cs.company_item_id = requirement.company_item_id
      AND cs.is_active = true
    ORDER BY cs.id
    FOR UPDATE;

    IF NOT FOUND THEN
      UPDATE public.stock_reservations AS sr
      SET status = 'cancelled',
          quantity_reserved = 0,
          cancelled_at = COALESCE(sr.cancelled_at, now()),
          updated_at = now()
      WHERE sr.company_id = v_company_id
        AND sr.ordem_servico_id = _ordem_servico_id
        AND sr.company_item_id = requirement.company_item_id
        AND sr.status = 'reserved';

      v_skipped := v_skipped + 1;
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'company_item_id', requirement.company_item_id,
        'item_name', requirement.item_name,
        'required', requirement.required_quantity,
        'reserved', 0,
        'reason', 'stock_record_missing'
      ));
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(cs.quantity), 0)
    INTO v_physical
    FROM public.company_stock AS cs
    WHERE cs.company_id = v_company_id
      AND cs.company_item_id = requirement.company_item_id
      AND cs.is_active = true;

    SELECT COALESCE(SUM(sr.quantity_reserved), 0)
    INTO v_other_reserved
    FROM public.stock_reservations AS sr
    WHERE sr.company_id = v_company_id
      AND sr.company_item_id = requirement.company_item_id
      AND sr.status = 'reserved'
      AND sr.ordem_servico_id <> _ordem_servico_id;

    v_target := LEAST(
      requirement.required_quantity,
      GREATEST(v_physical - v_other_reserved, 0)
    );

    INSERT INTO public.stock_reservations (
      company_id,
      company_item_id,
      ordem_servico_id,
      quantity_reserved,
      unit,
      status,
      created_by,
      updated_at
    )
    VALUES (
      v_company_id,
      requirement.company_item_id,
      _ordem_servico_id,
      v_target,
      COALESCE(requirement.stock_unit, 'un'),
      'reserved',
      v_user_id,
      now()
    )
    ON CONFLICT (ordem_servico_id, company_item_id)
      WHERE status = 'reserved'
    DO UPDATE SET
      quantity_reserved = EXCLUDED.quantity_reserved,
      unit = EXCLUDED.unit,
      updated_at = now();

    v_reserved_rows := v_reserved_rows + 1;
    v_reserved_quantity := v_reserved_quantity + v_target;

    IF v_target < requirement.required_quantity THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'company_item_id', requirement.company_item_id,
        'item_name', requirement.item_name,
        'required', requirement.required_quantity,
        'reserved', v_target,
        'missing', requirement.required_quantity - v_target,
        'reason', 'insufficient_available_stock'
      ));
    END IF;
  END LOOP;

  -- Requirements removed from the OS must not leave stale active reservations.
  UPDATE public.stock_reservations AS sr
  SET status = 'cancelled',
      quantity_reserved = 0,
      cancelled_at = COALESCE(sr.cancelled_at, now()),
      updated_at = now()
  WHERE sr.company_id = v_company_id
    AND sr.ordem_servico_id = _ordem_servico_id
    AND sr.status = 'reserved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.os_materials AS om
      JOIN public.company_items AS ci
        ON ci.company_id = v_company_id
       AND ci.item_template_id = om.item_template_id
       AND ci.is_active = true
      WHERE om.ordem_servico_id = _ordem_servico_id
        AND ci.id = sr.company_item_id
    );

  RETURN jsonb_build_object(
    'success', true,
    'reserved', v_reserved_rows,
    'reserved_quantity', v_reserved_quantity,
    'skipped', v_skipped,
    'shortages', v_shortages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_os_materials(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_os_materials(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_os_materials(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.reserve_os_materials(uuid) IS
  'Idempotently reserves available OS material requirements without decrementing physical stock.';
