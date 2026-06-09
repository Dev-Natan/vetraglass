CREATE OR REPLACE FUNCTION public.check_quote_approval_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  forma_tipo TEXT;
BEGIN
  -- Só validamos se o status está sendo ALTERADO para 'approved'
  -- ou se está SENDO INSERIDO como 'approved'
  IF (NEW.status = 'approved') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    
    -- 1. Buscar o tipo da forma de pagamento vinculada
    SELECT tipo INTO forma_tipo 
    FROM public.formas_pagamento 
    WHERE id = NEW.forma_pagamento_id;

    -- 2. Validar se o tipo é permitido
    IF forma_tipo NOT IN ('avista', 'parcelado') OR forma_tipo IS NULL THEN
      RAISE EXCEPTION 'Aprovação permitida apenas para formas de pagamento do tipo avista ou parcelado.';
    END IF;

    -- 3. Forçar condicao_pagamento_id como NULL (regra de negócio solicitada)
    NEW.condicao_pagamento_id := NULL;

  END IF;

  RETURN NEW;
END;
$function$;
