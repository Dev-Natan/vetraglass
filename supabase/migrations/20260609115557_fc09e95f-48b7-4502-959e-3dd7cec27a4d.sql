-- Função para ativar todos os templates atuais para uma nova empresa
CREATE OR REPLACE FUNCTION public.activate_all_templates_for_new_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_template RECORD;
BEGIN
  FOR v_template IN SELECT id FROM public.product_templates WHERE is_active = true LOOP
    PERFORM public.activate_product_template_for_company(NEW.id, v_template.id);
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Trigger disparado após a criação de uma empresa
DROP TRIGGER IF EXISTS tr_activate_templates_on_company_create ON public.companies;
CREATE TRIGGER tr_activate_templates_on_company_create
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.activate_all_templates_for_new_company();