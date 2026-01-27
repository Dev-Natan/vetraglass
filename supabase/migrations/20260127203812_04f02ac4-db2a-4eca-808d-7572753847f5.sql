
-- Fix FK constraint on os_cutting_plan to allow deleting quotes
ALTER TABLE os_cutting_plan
  DROP CONSTRAINT IF EXISTS os_cutting_plan_quote_item_id_fkey;

ALTER TABLE os_cutting_plan
  ADD CONSTRAINT os_cutting_plan_quote_item_id_fkey
  FOREIGN KEY (quote_item_id) REFERENCES quote_items(id)
  ON DELETE SET NULL;

-- Also fix material_consumption quote_item_id constraint
ALTER TABLE material_consumption
  DROP CONSTRAINT IF EXISTS material_consumption_quote_item_id_fkey;

ALTER TABLE material_consumption
  ADD CONSTRAINT material_consumption_quote_item_id_fkey
  FOREIGN KEY (quote_item_id) REFERENCES quote_items(id)
  ON DELETE SET NULL;
