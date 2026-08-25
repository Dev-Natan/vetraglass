-- Cover both new foreign-key access paths used by catalog option reconciliation.
CREATE INDEX IF NOT EXISTS company_item_variant_options_attribute_idx
  ON public.company_item_variant_options(attribute_id);

CREATE INDEX IF NOT EXISTS company_item_variant_options_option_attribute_idx
  ON public.company_item_variant_options(option_id, attribute_id);
