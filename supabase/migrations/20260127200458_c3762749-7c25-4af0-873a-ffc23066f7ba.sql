-- =========================================================
-- MATERIAL CONSUMPTION TABLE
-- Tracks calculated material needs with lifecycle states
-- =========================================================

-- Create the material_consumption table
CREATE TABLE public.material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES public.quote_items(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id),
  item_template_id UUID REFERENCES public.item_templates(id),
  
  -- Item identification
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  
  -- Calculated quantities
  quantity_calculated NUMERIC NOT NULL DEFAULT 0,
  
  -- Calculation context (traceability)
  formula_used TEXT,
  input_width NUMERIC,
  input_height NUMERIC,
  input_quantity INTEGER DEFAULT 1,
  
  -- Lifecycle status
  -- pending: calculated, waiting for production to start
  -- available: production started, material released for use
  -- consumed: deducted from stock
  -- cancelled: OS was cancelled
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'consumed', 'cancelled')),
  
  -- Traceability timestamps
  released_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  
  -- Links to related records
  stock_movement_id UUID REFERENCES public.stock_movements(id),
  stock_reservation_id UUID REFERENCES public.stock_reservations(id),
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id),
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add helpful comment
COMMENT ON TABLE public.material_consumption IS 'Tracks calculated material consumption for OS with lifecycle: pending → available → consumed';

-- Performance indexes
CREATE INDEX idx_material_consumption_ordem_servico ON public.material_consumption(ordem_servico_id);
CREATE INDEX idx_material_consumption_company ON public.material_consumption(company_id);
CREATE INDEX idx_material_consumption_status ON public.material_consumption(status);
CREATE INDEX idx_material_consumption_company_item ON public.material_consumption(company_item_id);

-- Enable RLS
ALTER TABLE public.material_consumption ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company users can view own material consumption"
  ON public.material_consumption FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can insert material consumption"
  ON public.material_consumption FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can update own material consumption"
  ON public.material_consumption FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can delete own material consumption"
  ON public.material_consumption FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- Trigger for updated_at
CREATE TRIGGER update_material_consumption_updated_at
  BEFORE UPDATE ON public.material_consumption
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_reservations_updated_at();

-- =========================================================
-- HELPER FUNCTION: Release materials for production
-- =========================================================
CREATE OR REPLACE FUNCTION public.release_materials_for_production(_ordem_servico_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.material_consumption
  SET 
    status = 'available',
    released_at = now(),
    updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status = 'pending';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- =========================================================
-- HELPER FUNCTION: Cancel materials when OS is cancelled
-- =========================================================
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.material_consumption
  SET 
    status = 'cancelled',
    updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('pending', 'available');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;