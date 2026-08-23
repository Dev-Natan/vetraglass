-- Hotfix: safe, transactional lifecycle for global item templates.
-- Physical deletion is allowed only for an item with no operational,
-- engineering or immutable-history references. Referenced items are archived.
CREATE OR REPLACE FUNCTION public.delete_item_template_transactional(
  _item_template_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.item_templates%ROWTYPE;
  v_engineering_count bigint := 0;
  v_company_count bigint := 0;
  v_history_count bigint := 0;
  v_dependencies jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_saas_admin(v_uid) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Apenas o SaaS Admin pode excluir itens globais.'
    );
  END IF;

  IF _item_template_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DELETE_FAILED',
      'message', 'ID do item não informado.'
    );
  END IF;

  SELECT * INTO v_item
  FROM public.item_templates
  WHERE id = _item_template_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ITEM_ALREADY_DELETED',
      'action', 'already_deleted',
      'idempotent', true
    );
  END IF;

  SELECT
    (SELECT count(*) FROM public.product_template_items WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.product_parametric_rules WHERE item_template_id = _item_template_id)
  INTO v_engineering_count;

  SELECT
    (SELECT count(*) FROM public.company_items WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.company_product_items WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.company_item_prices WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.company_item_color_prices WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.company_stock WHERE item_template_id = _item_template_id)
  INTO v_company_count;

  SELECT
    (SELECT count(*) FROM public.sale_items WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.sale_item_components WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.os_materials WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.material_consumption WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.purchase_order_items WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.stock_movements WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.os_glass_pieces WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.stock_offcuts WHERE item_template_id = _item_template_id)
    + (SELECT count(*) FROM public.quote_items
       WHERE composition_snapshot IS NOT NULL
         AND composition_snapshot::text LIKE '%' || _item_template_id::text || '%')
    + (SELECT count(*) FROM public.sale_items
       WHERE engineering_snapshot IS NOT NULL
         AND engineering_snapshot::text LIKE '%' || _item_template_id::text || '%')
    + (SELECT count(*) FROM public.os_items
       WHERE engineering_snapshot IS NOT NULL
         AND engineering_snapshot::text LIKE '%' || _item_template_id::text || '%')
    + (SELECT count(*) FROM public.os_cutting_plan
       WHERE engineering_snapshot IS NOT NULL
         AND engineering_snapshot::text LIKE '%' || _item_template_id::text || '%')
  INTO v_history_count;

  v_dependencies := jsonb_build_object(
    'engineering', v_engineering_count,
    'company_links', v_company_count,
    'history', v_history_count
  );

  IF v_engineering_count > 0 OR v_company_count > 0 OR v_history_count > 0 THEN
    UPDATE public.item_templates
    SET is_active = false, updated_at = now()
    WHERE id = _item_template_id AND is_active;

    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, old_data, new_data, metadata
    ) VALUES (
      v_uid,
      'update',
      'item_templates',
      _item_template_id,
      to_jsonb(v_item),
      to_jsonb(v_item) || jsonb_build_object('is_active', false),
      jsonb_build_object(
        'event', 'ITEM_TEMPLATE_ARCHIVED_ON_DELETE',
        'dependencies', v_dependencies
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'code', CASE
        WHEN v_history_count > 0 THEN 'ITEM_IN_USE'
        WHEN v_engineering_count > 0 THEN 'ITEM_HAS_ENGINEERING_REFERENCES'
        ELSE 'ITEM_HAS_COMPANY_LINKS'
      END,
      'action', 'archived',
      'idempotent', NOT v_item.is_active,
      'dependencies', v_dependencies,
      'message', 'O item possui vínculos e foi arquivado para preservar o histórico.'
    );
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, metadata
  ) VALUES (
    v_uid,
    'delete',
    'item_templates',
    _item_template_id,
    to_jsonb(v_item),
    jsonb_build_object('event', 'ITEM_TEMPLATE_DELETED')
  );

  DELETE FROM public.item_templates WHERE id = _item_template_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'ITEM_DELETED',
    'action', 'deleted',
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_item_template_transactional(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_item_template_transactional(uuid)
TO authenticated, service_role;

COMMENT ON FUNCTION public.delete_item_template_transactional(uuid) IS
  'SaaS Admin-only item lifecycle: delete unreferenced items; archive referenced items transactionally.';
