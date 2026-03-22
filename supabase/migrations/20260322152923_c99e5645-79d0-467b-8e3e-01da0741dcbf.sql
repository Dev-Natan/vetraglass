
ALTER TABLE public.company_products
  DROP CONSTRAINT company_products_product_template_id_fkey,
  ADD CONSTRAINT company_products_product_template_id_fkey
    FOREIGN KEY (product_template_id) REFERENCES public.product_templates(id)
    ON DELETE SET NULL;
