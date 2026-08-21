-- Preserve the fixed-composition piece multiplier in the parametric rule.
-- Kept separate because the base Phase 3A migration is already applied.
ALTER TABLE public.product_parametric_rules
  ADD COLUMN pieces_quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.product_parametric_rules
  ADD CONSTRAINT product_parametric_rules_pieces_quantity_check
  CHECK (pieces_quantity > 0);

ALTER TABLE public.company_parametric_rule_overrides
  ADD COLUMN pieces_quantity_override integer;
ALTER TABLE public.company_parametric_rule_overrides
  ADD CONSTRAINT company_parametric_overrides_pieces_quantity_check
  CHECK (pieces_quantity_override IS NULL OR pieces_quantity_override > 0);

UPDATE public.product_parametric_rules ppr
SET pieces_quantity = pti.pieces_quantity
FROM public.product_template_items pti
WHERE ppr.rule_key = 'legacy-' || pti.id::text
  AND ppr.product_template_id = pti.product_template_id;
