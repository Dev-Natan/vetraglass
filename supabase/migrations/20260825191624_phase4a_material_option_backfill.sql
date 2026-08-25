-- Reconcile equivalent legacy option values and attach canonical IDs to existing prices.
BEGIN;

WITH ranked AS (
  SELECT o.id,
    row_number() OVER (
      PARTITION BY o.attribute_id, o.canonical_value
      ORDER BY
        CASE WHEN a.data_type='NUMBER' AND o.option_code LIKE 'MM_%' THEN 0 ELSE 1 END,
        o.sort_order, o.id
    ) AS position
  FROM public.item_template_attribute_options o
  JOIN public.item_template_attributes a ON a.id=o.attribute_id
  WHERE o.is_active
), duplicates AS (
  SELECT r.id FROM ranked r
  WHERE r.position>1
    AND NOT EXISTS(SELECT 1 FROM public.company_item_variant_options link WHERE link.option_id=r.id)
)
UPDATE public.item_template_attribute_options o
SET is_active=false,updated_at=now()
FROM duplicates d WHERE o.id=d.id;

DO $$
DECLARE v record; v_ids uuid[]; v_signature text;
BEGIN
  FOR v IN
    SELECT civ.id,ci.item_template_id,civ.attributes
    FROM public.company_item_variants civ
    JOIN public.company_items ci ON ci.id=civ.company_item_id
    WHERE ci.item_template_id IS NOT NULL AND ci.is_commercial_area_material
      AND civ.attribute_signature IS NULL
  LOOP
    SELECT array_agg(selected.id ORDER BY selected.attribute_id) INTO v_ids
    FROM (
      SELECT DISTINCT ON (a.id) a.id attribute_id,o.id
      FROM public.item_template_attributes a
      JOIN public.item_template_attribute_options o ON o.attribute_id=a.id AND o.is_active
      WHERE a.item_template_id=v.item_template_id AND a.is_active
        AND (
          upper(COALESCE(v.attributes->>lower(a.attribute_code),''))=upper(COALESCE(o.canonical_value #>> '{}',o.option_code))
          OR public.phase4a_normalize_catalog_code(v.attributes->>lower(a.attribute_code))=o.option_code
          OR (a.attribute_code='THICKNESS_MM' AND 'MM_'||(v.attributes->>lower(a.attribute_code))=o.option_code)
        )
      ORDER BY a.id,
        CASE WHEN a.data_type='NUMBER' AND o.option_code LIKE 'MM_%' THEN 0 ELSE 1 END,
        o.sort_order,o.id
    ) selected;
    BEGIN
      v_signature:=public.phase4a_material_attribute_signature(v.item_template_id,v_ids,false);
      INSERT INTO public.company_item_variant_options(variant_id,attribute_id,option_id)
      SELECT v.id,o.attribute_id,o.id FROM public.item_template_attribute_options o WHERE o.id=ANY(v_ids)
      ON CONFLICT(variant_id,attribute_id) DO UPDATE SET option_id=EXCLUDED.option_id;
      UPDATE public.company_item_variants SET attribute_signature=v_signature WHERE id=v.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

COMMIT;
