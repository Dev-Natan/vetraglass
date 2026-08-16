-- Keep the database category contract canonical while accepting the historical
-- frontend labels at the write boundary.
CREATE OR REPLACE FUNCTION public.normalize_stock_movement_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.category := CASE NEW.category
    WHEN 'compra_fornecedor' THEN 'compra_material'
    WHEN 'devolucao_cliente' THEN 'devolucao'
    WHEN 'producao_sobra' THEN 'ajuste_positivo'
    WHEN 'consumo_producao' THEN 'producao'
    WHEN 'venda_direta' THEN 'venda'
    WHEN 'uso_interno' THEN 'ajuste_negativo'
    WHEN 'devolucao_fornecedor' THEN 'devolucao'
    WHEN 'ajuste_inventario' THEN
      CASE WHEN NEW.type = 'entrada' THEN 'ajuste_positivo' ELSE 'ajuste_negativo' END
    WHEN 'transferencia' THEN
      CASE WHEN NEW.type = 'entrada' THEN 'ajuste_positivo' ELSE 'ajuste_negativo' END
    ELSE NEW.category
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_stock_movement_category
  ON public.stock_movements;

CREATE TRIGGER trg_normalize_stock_movement_category
BEFORE INSERT OR UPDATE OF type, category
ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.normalize_stock_movement_category();

DROP INDEX IF EXISTS public.uq_stock_movement_material_consumption;

CREATE UNIQUE INDEX uq_stock_movement_material_consumption
  ON public.stock_movements (reference_id)
  WHERE reference_type = 'material_consumption'
    AND type = 'saida'
    AND category = 'producao';

REVOKE ALL ON FUNCTION public.normalize_stock_movement_category()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_stock_movement_category()
  TO service_role;

COMMENT ON FUNCTION public.normalize_stock_movement_category() IS
  'Normalizes historical frontend stock movement labels to the constrained canonical categories.';
