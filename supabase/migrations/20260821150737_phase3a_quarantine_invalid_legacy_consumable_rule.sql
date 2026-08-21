-- The imported BORRACHA row has L * 4 * A both as geometry and quantity,
-- producing 9.6 million pieces at 2000 x 1200 mm and overflowing the OS
-- integer contract. Preserve its version for audit, but do not execute it
-- until engineering supplies a dimensionally valid calibrated replacement.
UPDATE public.product_parametric_rules
SET is_active = false,
    validation_source = 'quarantined_invalid_legacy_L_times_4_times_A',
    updated_at = now()
WHERE product_template_id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
  AND item_template_id = '15172644-31c0-4bcc-9a38-92b1863a604e'::uuid
  AND formula = 'L * 4 * A'
  AND is_validated = false;
