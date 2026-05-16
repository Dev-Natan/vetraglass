-- =====================================================
-- SISTEMA HÍBRIDO DE ESTOQUE + COMPRA SOB DEMANDA
-- =====================================================

-- 1. Adicionar campos para mapeamento de vidro em company_items
ALTER TABLE company_items ADD COLUMN IF NOT EXISTS glass_thickness TEXT;
ALTER TABLE company_items ADD COLUMN IF NOT EXISTS glass_color TEXT;
ALTER TABLE company_items ADD COLUMN IF NOT EXISTS glass_type_detail TEXT; -- Temperado, Laminado, etc.

-- 2. Adicionar campos de origem em os_glass_projects
ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  material_origin TEXT DEFAULT 'pending' CHECK (material_origin IN ('stock', 'purchase', 'mixed', 'pending'));

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  stock_item_id UUID REFERENCES company_items(id);

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  stock_quantity_used NUMERIC DEFAULT 0;

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  stock_unit_cost NUMERIC DEFAULT 0;

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  purchase_quantity_needed NUMERIC DEFAULT 0;

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  purchase_actual_cost NUMERIC DEFAULT 0;

-- 3. Criar tabela de reservas de estoque
CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_item_id UUID NOT NULL REFERENCES company_items(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  os_glass_project_id UUID REFERENCES os_glass_projects(id) ON DELETE SET NULL,
  
  -- Quantidade reservada
  quantity_reserved NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'm²',
  unit_cost NUMERIC DEFAULT 0,
  
  -- Status da reserva
  status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'cancelled')),
  
  -- Rastreamento
  reserved_at TIMESTAMPTZ DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS para stock_reservations
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company stock reservations"
  ON stock_reservations FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company stock reservations"
  ON stock_reservations FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company stock reservations"
  ON stock_reservations FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete stock reservations"
  ON stock_reservations FOR DELETE
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_reservations_company 
  ON stock_reservations(company_id);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_os 
  ON stock_reservations(ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_item_status 
  ON stock_reservations(company_item_id, status);

CREATE INDEX IF NOT EXISTS idx_company_items_glass 
  ON company_items(company_id, type) WHERE type = 'glass';

-- 6. Função para calcular estoque disponível (menos reservas)
CREATE OR REPLACE FUNCTION get_available_stock(
  _company_item_id UUID
) RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(cs.quantity, 0) - COALESCE(
    (SELECT SUM(sr.quantity_reserved) 
     FROM stock_reservations sr 
     WHERE sr.company_item_id = _company_item_id 
       AND sr.status = 'reserved'), 
    0
  ) as available_qty
  FROM company_stock cs
  WHERE cs.company_item_id = _company_item_id
  LIMIT 1;
$$;

-- 7. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_stock_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_stock_reservations_updated_at
  BEFORE UPDATE ON stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_reservations_updated_at();