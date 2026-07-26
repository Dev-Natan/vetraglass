
CREATE OR REPLACE FUNCTION public.create_default_payment_options(_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  INSERT INTO public.formas_pagamento (company_id, name, nome, tipo, is_active, sort_order)
  SELECT _company_id, v.name, v.name, v.tipo, true, v.sort_order
  FROM (VALUES
    ('Dinheiro','dinheiro',1),
    ('PIX','pix',2),
    ('Cartão de Débito','debito',3),
    ('Cartão de Crédito','credito',4),
    ('Boleto','boleto',5),
    ('Transferência','transferencia',6)
  ) AS v(name,tipo,sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.formas_pagamento fp
    WHERE fp.company_id = _company_id AND fp.tipo = v.tipo
  );

  INSERT INTO public.condicoes_pagamento (company_id, name, nome, parcelas, is_active, sort_order)
  SELECT _company_id, v.name, v.name, v.parcelas, true, v.sort_order
  FROM (VALUES
    ('À vista',1,1),
    ('2x sem juros',2,2),
    ('3x sem juros',3,3),
    ('6x sem juros',6,4),
    ('10x sem juros',10,5)
  ) AS v(name,parcelas,sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.condicoes_pagamento cp
    WHERE cp.company_id = _company_id AND cp.parcelas = v.parcelas
  );
END $function$;
