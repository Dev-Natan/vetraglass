-- =====================================================
-- VALIDAÇÃO DE VENDAS NO SERVIDOR
-- Impede manipulação de preços/descontos via DevTools
-- =====================================================

-- Função que recalcula e valida totais de vendas
CREATE OR REPLACE FUNCTION public.validate_sale_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_discount_percent NUMERIC := 50;
  v_calculated_discount NUMERIC;
  v_calculated_total NUMERIC;
BEGIN
  -- Validar que subtotal é positivo
  IF NEW.subtotal IS NULL OR NEW.subtotal < 0 THEN
    RAISE EXCEPTION 'Subtotal inválido: deve ser maior ou igual a zero';
  END IF;
  
  -- Validar percentual de desconto dentro do limite
  IF NEW.discount_percent IS NOT NULL AND NEW.discount_percent > v_max_discount_percent THEN
    RAISE EXCEPTION 'Desconto máximo permitido: %', v_max_discount_percent;
  END IF;
  
  -- Garantir que discount_percent não é negativo
  IF NEW.discount_percent IS NULL OR NEW.discount_percent < 0 THEN
    NEW.discount_percent := 0;
  END IF;
  
  -- RECALCULAR valores no servidor (ignora valores do frontend)
  v_calculated_discount := ROUND(NEW.subtotal * (NEW.discount_percent / 100), 2);
  v_calculated_total := ROUND(NEW.subtotal - v_calculated_discount, 2);
  
  -- Sobrescrever com valores calculados pelo servidor
  NEW.discount_amount := v_calculated_discount;
  NEW.total_amount := v_calculated_total;
  
  -- Validar que o total não é negativo
  IF NEW.total_amount < 0 THEN
    RAISE EXCEPTION 'Valor total não pode ser negativo';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para INSERT
DROP TRIGGER IF EXISTS validate_sale_before_insert ON public.sales;
CREATE TRIGGER validate_sale_before_insert
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sale_totals();

-- Trigger para UPDATE (também protege alterações)
DROP TRIGGER IF EXISTS validate_sale_before_update ON public.sales;
CREATE TRIGGER validate_sale_before_update
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  WHEN (
    OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
    OLD.discount_percent IS DISTINCT FROM NEW.discount_percent OR
    OLD.discount_amount IS DISTINCT FROM NEW.discount_amount OR
    OLD.total_amount IS DISTINCT FROM NEW.total_amount
  )
  EXECUTE FUNCTION public.validate_sale_totals();

-- Comentário para documentação
COMMENT ON FUNCTION public.validate_sale_totals() IS 
'Valida e recalcula totais de vendas no servidor para prevenir manipulação via DevTools. 
Limite máximo de desconto: 50%. Valores são sempre recalculados independente do que o frontend enviar.';