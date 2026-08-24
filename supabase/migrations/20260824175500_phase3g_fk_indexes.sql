-- Phase 3G: covering indexes for foreign-key validation and operational lookups.

CREATE INDEX material_purchase_requirements_cancelled_by_idx
  ON public.material_purchase_requirements(cancelled_by)
  WHERE cancelled_by IS NOT NULL;
CREATE INDEX material_purchase_requirements_company_item_company_idx
  ON public.material_purchase_requirements(company_item_id,company_id);
CREATE INDEX material_purchase_requirements_created_by_idx
  ON public.material_purchase_requirements(created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX material_purchase_requirements_item_template_idx
  ON public.material_purchase_requirements(item_template_id)
  WHERE item_template_id IS NOT NULL;
CREATE INDEX material_purchase_requirements_os_item_idx
  ON public.material_purchase_requirements(os_item_id)
  WHERE os_item_id IS NOT NULL;
CREATE INDEX material_purchase_requirements_sale_idx
  ON public.material_purchase_requirements(sale_id)
  WHERE sale_id IS NOT NULL;
CREATE INDEX material_purchase_requirements_sale_item_idx
  ON public.material_purchase_requirements(sale_item_id)
  WHERE sale_item_id IS NOT NULL;
CREATE INDEX material_purchase_requirements_variant_idx
  ON public.material_purchase_requirements(variant_id)
  WHERE variant_id IS NOT NULL;
CREATE INDEX po_requirement_allocations_created_by_idx
  ON public.purchase_order_item_requirement_allocations(created_by)
  WHERE created_by IS NOT NULL;
