-- Phase 3F follow-up from Supabase database advisors. The SECURITY DEFINER
-- movement/location RPCs remain intentional and validate auth.uid + company.

CREATE INDEX inventory_item_units_company_item_company_idx
  ON public.inventory_item_units(company_item_id,company_id);
CREATE INDEX physical_stock_balances_company_item_company_idx
  ON public.physical_stock_balances(company_item_id,company_id);
CREATE INDEX physical_stock_balances_location_company_idx
  ON public.physical_stock_balances(location_id,company_id);
CREATE INDEX physical_stock_balances_variant_cover_idx
  ON public.physical_stock_balances(variant_id)
  WHERE variant_id IS NOT NULL;
CREATE INDEX stock_locations_parent_company_idx
  ON public.stock_locations(parent_id,company_id)
  WHERE parent_id IS NOT NULL;

-- Both tables expose SELECT only. Writes remain behind checked RPCs, so the
-- broad manage policies were redundant and caused duplicate SELECT policies.
DROP POLICY inventory_item_units_manage ON public.inventory_item_units;
DROP POLICY stock_locations_manage ON public.stock_locations;

-- Conversion lookup is an internal implementation detail of the movement RPC.
REVOKE EXECUTE ON FUNCTION public.phase3f_unit_factor(uuid,text,numeric,numeric)
  FROM authenticated;

NOTIFY pgrst,'reload schema';
