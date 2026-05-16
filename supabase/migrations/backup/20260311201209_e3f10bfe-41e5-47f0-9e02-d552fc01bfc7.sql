
-- Function to auto-activate all active product templates for a given company
CREATE OR REPLACE FUNCTION public.activate_all_products_for_company(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_template IN
    SELECT id FROM product_templates WHERE is_active = true
  LOOP
    -- Only activate if not already exists
    IF NOT EXISTS (
      SELECT 1 FROM company_products 
      WHERE company_id = _company_id 
      AND product_template_id = v_template.id
    ) THEN
      PERFORM activate_product_template_for_company(_company_id, v_template.id);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Also activate all linhas for the company
CREATE OR REPLACE FUNCTION public.activate_all_linhas_for_company(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_linha TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_linha IN
    SELECT DISTINCT linha FROM product_templates WHERE is_active = true AND linha IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM company_linhas WHERE company_id = _company_id AND name = v_linha
    ) THEN
      INSERT INTO company_linhas (company_id, name, is_active)
      VALUES (_company_id, v_linha, true);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Trigger function: when a new company is created, auto-activate all products
CREATE OR REPLACE FUNCTION public.trigger_activate_all_products_for_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM activate_all_linhas_for_company(NEW.id);
  PERFORM activate_all_products_for_company(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger on companies table
DROP TRIGGER IF EXISTS trg_activate_products_on_company_create ON companies;
CREATE TRIGGER trg_activate_products_on_company_create
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_activate_all_products_for_new_company();
