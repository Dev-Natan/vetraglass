
-- Função para normalizar texto removendo acentos e convertendo para minúsculas
CREATE OR REPLACE FUNCTION public.normalize_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LOWER(
    TRANSLATE(
      COALESCE(input_text, ''),
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    )
  );
$$;

-- Função de validação para impedir nomes duplicados em item_templates
CREATE OR REPLACE FUNCTION public.validate_item_template_unique_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_new_name text;
  existing_id uuid;
  existing_name text;
BEGIN
  -- Normalizar o nome do novo item
  normalized_new_name := normalize_text(NEW.name);
  
  -- Buscar item existente com nome normalizado igual
  SELECT id, name INTO existing_id, existing_name
  FROM public.item_templates
  WHERE normalize_text(name) = normalized_new_name
    AND id IS DISTINCT FROM NEW.id
  LIMIT 1;
  
  -- Se encontrou duplicado, bloquear
  IF existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um item com nome similar: "%". O nome "%" não pode ser usado.', existing_name, NEW.name
      USING ERRCODE = 'unique_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para validar antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS validate_item_template_name_trigger ON public.item_templates;

CREATE TRIGGER validate_item_template_name_trigger
BEFORE INSERT OR UPDATE OF name ON public.item_templates
FOR EACH ROW
EXECUTE FUNCTION public.validate_item_template_unique_name();
