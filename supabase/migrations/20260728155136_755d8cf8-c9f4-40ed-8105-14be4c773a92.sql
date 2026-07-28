
-- 1) Reservar materiais automaticamente quando o orçamento vira OS
CREATE OR REPLACE FUNCTION public.reserve_os_materials(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_created int := 0;
  r RECORD;
  v_res_id uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.ordens_servico WHERE id = _ordem_servico_id;
  IF v_company IS NULL OR NOT public.user_belongs_to_company(auth.uid(), v_company) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  FOR r IN
    SELECT mc.id AS consumption_id,
           mc.company_item_id,
           mc.item_template_id,
           mc.quantity_calculated,
           mc.unit
    FROM public.material_consumption mc
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND COALESCE(mc.status, 'pending') = 'pending'
      AND mc.stock_reservation_id IS NULL
      AND COALESCE(mc.quantity_calculated, 0) > 0
  LOOP
    INSERT INTO public.stock_reservations (
      company_id, company_item_id, item_template_id,
      ordem_servico_id, quantity_reserved, unit, status, created_by
    ) VALUES (
      v_company, r.company_item_id, r.item_template_id,
      _ordem_servico_id, r.quantity_calculated, r.unit, 'active', auth.uid()
    ) RETURNING id INTO v_res_id;

    UPDATE public.material_consumption
       SET stock_reservation_id = v_res_id,
           status = 'reserved'
     WHERE id = r.consumption_id;

    -- Atualiza estoque somente se o item existe cadastrado
    UPDATE public.company_stock cs
       SET quantity_reserved = COALESCE(quantity_reserved, 0) + r.quantity_calculated,
           updated_at = now()
     WHERE cs.company_id = v_company
       AND (
         (r.company_item_id IS NOT NULL AND cs.company_item_id = r.company_item_id)
         OR (r.company_item_id IS NULL AND r.item_template_id IS NOT NULL AND cs.item_template_id = r.item_template_id)
       );

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reserved', v_created);
END $$;

-- 2) Baixa real quando a OS entra em produção
CREATE OR REPLACE FUNCTION public.release_materials_for_production(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_consumed int := 0;
  r RECORD;
  v_stock RECORD;
  v_mov_id uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.ordens_servico WHERE id = _ordem_servico_id;
  IF v_company IS NULL OR NOT public.user_belongs_to_company(auth.uid(), v_company) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Se ainda não existem reservas, reserva agora antes de baixar
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_reservations
    WHERE ordem_servico_id = _ordem_servico_id AND status = 'active'
  ) THEN
    PERFORM public.reserve_os_materials(_ordem_servico_id);
  END IF;

  FOR r IN
    SELECT mc.id AS consumption_id,
           mc.stock_reservation_id,
           mc.company_item_id,
           mc.item_template_id,
           mc.quantity_calculated,
           mc.unit,
           mc.item_name
    FROM public.material_consumption mc
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND COALESCE(mc.status, 'pending') IN ('pending', 'reserved')
      AND COALESCE(mc.quantity_calculated, 0) > 0
  LOOP
    -- Busca estoque disponível
    SELECT id, quantity, quantity_reserved
      INTO v_stock
      FROM public.company_stock
     WHERE company_id = v_company
       AND (
         (r.company_item_id IS NOT NULL AND company_item_id = r.company_item_id)
         OR (r.company_item_id IS NULL AND r.item_template_id IS NOT NULL AND item_template_id = r.item_template_id)
       )
     LIMIT 1;

    IF v_stock.id IS NOT NULL THEN
      UPDATE public.company_stock
         SET quantity = GREATEST(0, quantity - r.quantity_calculated),
             quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - r.quantity_calculated),
             updated_at = now()
       WHERE id = v_stock.id;

      INSERT INTO public.stock_movements (
        company_id, item_template_id, company_item_id,
        type, category, quantity, description,
        reference_id, reference_type
      ) VALUES (
        v_company, r.item_template_id, r.company_item_id,
        'saida', 'consumo_producao', r.quantity_calculated,
        'Consumo em produção: ' || COALESCE(r.item_name, ''),
        _ordem_servico_id, 'ordem_servico'
      ) RETURNING id INTO v_mov_id;

      UPDATE public.material_consumption
         SET status = 'consumed',
             stock_movement_id = v_mov_id,
             consumed_at = now()
       WHERE id = r.consumption_id;
    ELSE
      -- Item sem cadastro no estoque: apenas marca como consumido para não bloquear a produção
      UPDATE public.material_consumption
         SET status = 'consumed',
             consumed_at = now()
       WHERE id = r.consumption_id;
    END IF;

    -- Baixa a reserva associada
    IF r.stock_reservation_id IS NOT NULL THEN
      UPDATE public.stock_reservations
         SET status = 'consumed', updated_at = now()
       WHERE id = r.stock_reservation_id;
    END IF;

    v_consumed := v_consumed + 1;
  END LOOP;

  UPDATE public.ordens_servico
     SET status = 'em_producao', updated_at = now()
   WHERE id = _ordem_servico_id;

  RETURN jsonb_build_object('success', true, 'consumed', v_consumed);
END $$;

-- 3) Cancelamento: devolve reservas ao estoque
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  consumed_count int;
  r RECORD;
BEGIN
  SELECT company_id INTO v_company FROM public.ordens_servico WHERE id = _ordem_servico_id;
  IF v_company IS NULL OR NOT public.user_belongs_to_company(auth.uid(), v_company) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COUNT(*) INTO consumed_count FROM public.material_consumption
   WHERE ordem_servico_id = _ordem_servico_id AND status = 'consumed';
  IF consumed_count > 0 THEN
    RAISE EXCEPTION 'materiais já foram consumidos do estoque';
  END IF;

  -- Devolve o reservado ao estoque disponível
  FOR r IN
    SELECT sr.id, sr.company_item_id, sr.item_template_id, sr.quantity_reserved
      FROM public.stock_reservations sr
     WHERE sr.ordem_servico_id = _ordem_servico_id AND sr.status = 'active'
  LOOP
    UPDATE public.company_stock
       SET quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - r.quantity_reserved),
           updated_at = now()
     WHERE company_id = v_company
       AND (
         (r.company_item_id IS NOT NULL AND company_item_id = r.company_item_id)
         OR (r.company_item_id IS NULL AND r.item_template_id IS NOT NULL AND item_template_id = r.item_template_id)
       );

    UPDATE public.stock_reservations
       SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE id = r.id;
  END LOOP;

  UPDATE public.material_consumption
     SET status = 'cancelled'
   WHERE ordem_servico_id = _ordem_servico_id AND status <> 'consumed';

  UPDATE public.ordens_servico
     SET status = 'cancelada', cancelled_at = now(), cancelled_by = auth.uid()
   WHERE id = _ordem_servico_id;

  RETURN jsonb_build_object('success', true);
END $$;
