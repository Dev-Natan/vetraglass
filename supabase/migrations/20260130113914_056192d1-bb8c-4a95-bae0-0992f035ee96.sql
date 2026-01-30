-- Melhorar função de cancelamento com validação e cancelamento de reservas
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
  has_consumed BOOLEAN;
BEGIN
  -- Verificar se há materiais já consumidos
  SELECT EXISTS (
    SELECT 1 FROM material_consumption 
    WHERE ordem_servico_id = _ordem_servico_id 
    AND status = 'consumed'
  ) INTO has_consumed;
  
  IF has_consumed THEN
    RAISE EXCEPTION 'Cancelamento bloqueado: materiais já foram consumidos do estoque';
  END IF;

  -- Cancelar material_consumption
  UPDATE public.material_consumption
  SET status = 'cancelled', updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('pending', 'available');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Cancelar reservas vinculadas
  UPDATE public.stock_reservations
  SET status = 'cancelled', cancelled_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status = 'reserved';
  
  RETURN updated_count;
END;
$function$;