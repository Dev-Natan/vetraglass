-- Primeiro, vamos garantir que a tabela quotes tenha a constraint correta para os tipos permitidos
-- Nota: Como o tipo da forma de pagamento vem da tabela formas_pagamento, 
-- a validação robusta é melhor feita via trigger ou conferindo o tipo da forma vinculada.

CREATE OR REPLACE FUNCTION public.check_quote_approval_rules()
RETURNS TRIGGER AS $$
DECLARE
  forma_tipo TEXT;
BEGIN
  -- Só validamos quando o status muda para 'approved' ou se já está 'approved' e está sendo alterado
  IF (NEW.status = 'approved') THEN
    
    -- 1. Buscar o tipo da forma de pagamento vinculada
    SELECT tipo INTO forma_tipo 
    FROM public.formas_pagamento 
    WHERE id = NEW.forma_pagamento_id;

    -- 2. Validar se o tipo é permitido
    IF forma_tipo NOT IN ('avista', 'parcelado') OR forma_tipo IS NULL THEN
      RAISE EXCEPTION 'Aprovação permitida apenas para formas de pagamento do tipo avista ou parcelado.';
    END IF;

    -- 3. Forçar condicao_pagamento_id como NULL (regrade de negócio solicitada)
    NEW.condicao_pagamento_id := NULL;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger na tabela quotes
DROP TRIGGER IF EXISTS trg_validate_quote_approval ON public.quotes;
CREATE TRIGGER trg_validate_quote_approval
BEFORE INSERT OR UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.check_quote_approval_rules();