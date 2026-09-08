-- Normalize display aliases without collapsing squared units into linear units.
-- The previous regexp removed the exponent from m² and mm² before validation.
CREATE OR REPLACE FUNCTION public.phase3f_normalize_unit(_unit text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE upper(
    regexp_replace(
      replace(COALESCE(btrim(_unit), ''), '²', '2'),
      '[[:space:]]+',
      '',
      'g'
    )
  )
    WHEN 'BARRA' THEN 'BAR' WHEN 'BARRAS' THEN 'BAR' WHEN 'BAR' THEN 'BAR'
    WHEN 'M' THEN 'M' WHEN 'ML' THEN 'M' WHEN 'METRO' THEN 'M' WHEN 'METROS' THEN 'M'
    WHEN 'MM' THEN 'MM'
    WHEN 'M2' THEN 'M2' WHEN 'METROQUADRADO' THEN 'M2'
    WHEN 'MM2' THEN 'MM2'
    WHEN 'UN' THEN 'UNIT' WHEN 'UND' THEN 'UNIT' WHEN 'UNIDADE' THEN 'UNIT'
    WHEN 'UNIDADES' THEN 'UNIT' WHEN 'UNIT' THEN 'UNIT' WHEN 'PC' THEN 'UNIT'
    WHEN 'PÇ' THEN 'UNIT' WHEN 'PECA' THEN 'UNIT' WHEN 'PEÇA' THEN 'UNIT'
    WHEN 'CAIXA' THEN 'BOX' WHEN 'BOX' THEN 'BOX'
    WHEN 'PACOTE' THEN 'PACK' WHEN 'PACK' THEN 'PACK'
    WHEN 'CHAPA' THEN 'SHEET' WHEN 'SHEET' THEN 'SHEET'
    WHEN 'KG' THEN 'KG' WHEN 'G' THEN 'G'
    WHEN 'TUBO' THEN 'TUBE' WHEN 'TUBE' THEN 'TUBE'
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.phase3f_normalize_unit(text) IS
  'Normalizes physical unit aliases while preserving AREA dimensions (m² -> M2, mm² -> MM2).';
