-- Supporting indexes for foreign-key maintenance on the Phase 4A global
-- material-combination catalog. Kept separate because the canonical migration
-- was already recorded on the official project.

CREATE INDEX IF NOT EXISTS item_template_variant_definitions_created_by_idx
  ON public.item_template_variant_definitions(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS item_template_variant_definitions_updated_by_idx
  ON public.item_template_variant_definitions(updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS item_template_variant_definition_options_attribute_family_idx
  ON public.item_template_variant_definition_options(attribute_id,item_template_id);
