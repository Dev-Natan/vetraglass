
ALTER TABLE public.quote_items DROP CONSTRAINT quote_items_product_template_id_fkey,
  ADD CONSTRAINT quote_items_product_template_id_fkey FOREIGN KEY (product_template_id) REFERENCES public.product_templates(id) ON DELETE SET NULL;

ALTER TABLE public.glass_projects DROP CONSTRAINT glass_projects_product_template_id_fkey,
  ADD CONSTRAINT glass_projects_product_template_id_fkey FOREIGN KEY (product_template_id) REFERENCES public.product_templates(id) ON DELETE SET NULL;

ALTER TABLE public.os_cutting_plan DROP CONSTRAINT os_cutting_plan_product_template_id_fkey,
  ADD CONSTRAINT os_cutting_plan_product_template_id_fkey FOREIGN KEY (product_template_id) REFERENCES public.product_templates(id) ON DELETE SET NULL;

ALTER TABLE public.os_glass_projects DROP CONSTRAINT os_glass_projects_product_template_id_fkey,
  ADD CONSTRAINT os_glass_projects_product_template_id_fkey FOREIGN KEY (product_template_id) REFERENCES public.product_templates(id) ON DELETE SET NULL;
