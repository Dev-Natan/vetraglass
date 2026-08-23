-- Authorized global item catalog reset.
-- Scope: item_templates and directly dependent global color prices only.
-- Storage, structural catalogs, Auth, profiles, products and engineering schema are preserved.
DO $$
DECLARE
  v_item_count bigint;
  v_color_price_count bigint;
  v_reference_count bigint;
  v_deleted_items bigint;
  v_deleted_color_prices bigint;
  v_items_with_images bigint;
  v_distinct_image_urls bigint;
  v_populated_legacy_formulas bigint;
BEGIN
  LOCK TABLE
    public.item_templates,
    public.item_template_color_prices,
    public.company_item_color_prices,
    public.company_item_prices,
    public.company_items,
    public.company_product_items,
    public.company_stock,
    public.material_consumption,
    public.os_glass_pieces,
    public.os_materials,
    public.product_parametric_rules,
    public.product_template_items,
    public.purchase_order_items,
    public.sale_item_components,
    public.sale_items,
    public.stock_movements,
    public.stock_offcuts
  IN ACCESS EXCLUSIVE MODE;

  SELECT
    count(*),
    count(*) FILTER (WHERE nullif(btrim(image_url), '') IS NOT NULL),
    count(DISTINCT image_url) FILTER (WHERE nullif(btrim(image_url), '') IS NOT NULL),
    count(*) FILTER (
      WHERE default_formulas IS NOT NULL
        AND default_formulas <> '[]'::jsonb
        AND default_formulas <> '{}'::jsonb
        AND default_formulas <> 'null'::jsonb
    )
  INTO
    v_item_count,
    v_items_with_images,
    v_distinct_image_urls,
    v_populated_legacy_formulas
  FROM public.item_templates;

  SELECT count(*) INTO v_color_price_count
  FROM public.item_template_color_prices;

  SELECT
    (SELECT count(*) FROM public.company_item_color_prices)
    + (SELECT count(*) FROM public.company_item_prices)
    + (SELECT count(*) FROM public.company_items WHERE item_template_id IS NOT NULL)
    + (SELECT count(*) FROM public.company_product_items)
    + (SELECT count(*) FROM public.company_stock)
    + (SELECT count(*) FROM public.item_template_color_prices)
    + (SELECT count(*) FROM public.material_consumption)
    + (SELECT count(*) FROM public.os_glass_pieces WHERE item_template_id IS NOT NULL)
    + (SELECT count(*) FROM public.os_materials)
    + (SELECT count(*) FROM public.product_parametric_rules)
    + (SELECT count(*) FROM public.product_template_items)
    + (SELECT count(*) FROM public.purchase_order_items)
    + (SELECT count(*) FROM public.sale_item_components WHERE item_template_id IS NOT NULL)
    + (SELECT count(*) FROM public.sale_items WHERE item_template_id IS NOT NULL)
    + (SELECT count(*) FROM public.stock_movements)
    + (SELECT count(*) FROM public.stock_offcuts WHERE item_template_id IS NOT NULL)
  INTO v_reference_count;

  IF v_item_count <> 494 THEN
    RAISE EXCEPTION 'RESET_ABORTED_ITEM_COUNT_CHANGED: expected 494, found %', v_item_count;
  END IF;

  IF v_reference_count <> 0 THEN
    RAISE EXCEPTION 'RESET_ABORTED_REFERENCES_FOUND: %', v_reference_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quotes
    UNION ALL SELECT 1 FROM public.sales
    UNION ALL SELECT 1 FROM public.ordens_servico
    UNION ALL SELECT 1 FROM public.os_materials
    UNION ALL SELECT 1 FROM public.material_consumption
    UNION ALL SELECT 1 FROM public.stock_movements
    UNION ALL SELECT 1 FROM public.purchase_order_items
  ) THEN
    RAISE EXCEPTION 'RESET_ABORTED_OPERATIONAL_DATA_FOUND';
  END IF;

  DELETE FROM public.item_template_color_prices;
  GET DIAGNOSTICS v_deleted_color_prices = ROW_COUNT;

  DELETE FROM public.item_templates;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  IF v_deleted_items <> v_item_count THEN
    RAISE EXCEPTION 'RESET_ABORTED_DELETE_COUNT_MISMATCH: expected %, deleted %',
      v_item_count, v_deleted_items;
  END IF;

  IF EXISTS (SELECT 1 FROM public.item_templates)
     OR EXISTS (SELECT 1 FROM public.item_template_color_prices) THEN
    RAISE EXCEPTION 'RESET_ABORTED_POSTCONDITION_FAILED';
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    old_data,
    metadata
  )
  VALUES (
    (SELECT user_id FROM public.saas_admins ORDER BY created_at LIMIT 1),
    'delete',
    'item_templates',
    jsonb_build_object(
      'item_templates', v_item_count,
      'item_template_color_prices', v_color_price_count,
      'items_with_images', v_items_with_images,
      'distinct_image_urls', v_distinct_image_urls,
      'populated_legacy_default_formulas', v_populated_legacy_formulas
    ),
    jsonb_build_object(
      'event', 'AUTHORIZED_GLOBAL_ITEM_TEMPLATE_RESET',
      'deleted_item_templates', v_deleted_items,
      'deleted_item_template_color_prices', v_deleted_color_prices,
      'storage_objects_deleted', 0,
      'scope', 'global_item_catalog_only'
    )
  );
END;
$$;
