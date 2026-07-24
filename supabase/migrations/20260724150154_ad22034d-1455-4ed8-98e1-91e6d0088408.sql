
-- =========================================================
-- FASE 5.1 — BOOTSTRAP DO USUÁRIO ADMIN
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_uid uuid := 'f05a48be-9eb7-44af-8d44-e7af08df776c';
  v_email text := 'natanjk7@gmail.com';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt('Mudar123@', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','Natan (SaaS Admin)'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', v_uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt('Mudar123@', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
    WHERE id = v_uid;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (v_uid, 'Natan (SaaS Admin)', v_email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.saas_admins (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'saas_admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin') ON CONFLICT DO NOTHING;
END $$;

-- =========================================================
-- FASE 5.2 — RATE LIMIT DE LOGIN
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(_email text, _max_attempts int DEFAULT 5, _window_minutes int DEFAULT 15)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE fails int; last_fail timestamptz;
BEGIN
  SELECT COUNT(*), MAX(created_at) INTO fails, last_fail
  FROM public.login_attempts
  WHERE email = lower(trim(_email))
    AND success = false
    AND created_at > now() - make_interval(mins => _window_minutes);

  RETURN jsonb_build_object(
    'is_blocked', fails >= _max_attempts,
    'failed_attempts', COALESCE(fails, 0),
    'max_attempts', _max_attempts,
    'remaining_seconds', CASE WHEN fails >= _max_attempts
      THEN GREATEST(0, EXTRACT(EPOCH FROM (last_fail + make_interval(mins => _window_minutes) - now()))::int)
      ELSE 0 END
  );
END $$;

CREATE OR REPLACE FUNCTION public.record_login_attempt(_email text, _success boolean, _ip_address text DEFAULT NULL, _user_agent text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.login_attempts (email, success, ip_address, user_agent)
  VALUES (lower(trim(_email)), _success, _ip_address, _user_agent);
$$;

-- =========================================================
-- FASE 5.3 — SAAS ADMINS
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_saas_admins()
RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sa.user_id, p.email, p.full_name, sa.created_at
  FROM public.saas_admins sa
  LEFT JOIN public.profiles p ON p.user_id = sa.user_id
  WHERE public.is_saas_admin(auth.uid())
  ORDER BY sa.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.grant_saas_admin(_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  SELECT id INTO v_uid FROM auth.users WHERE email = lower(trim(_email));
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'user_not_found'); END IF;
  INSERT INTO public.saas_admins (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'saas_admin') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_saas_admin(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  DELETE FROM public.saas_admins WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'saas_admin';
  RETURN jsonb_build_object('success', true);
END $$;

-- =========================================================
-- FASE 5.4 — MIGRATIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_schema_migrations()
RETURNS TABLE(version text, name text, statements text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY EXECUTE $sql$
    SELECT version::text, COALESCE(name,'')::text, statements
    FROM supabase_migrations.schema_migrations
    ORDER BY version DESC
  $sql$;
END $$;

-- =========================================================
-- FASE 5.5 — EMPRESA & MEMBROS
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_company_and_assign_admin(
  _name text, _cnpj text DEFAULT NULL, _phone text DEFAULT NULL,
  _email text DEFAULT NULL, _address text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_company_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;
  INSERT INTO public.companies (name, cnpj, phone, email, address)
  VALUES (_name, _cnpj, _phone, _email, _address)
  RETURNING id INTO new_company_id;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_uid, new_company_id, 'admin', true);

  INSERT INTO public.company_cash (company_id, current_balance) VALUES (new_company_id, 0) ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'company_id', new_company_id);
END $$;

CREATE OR REPLACE FUNCTION public.change_company_member_role(_company_id uuid, _target_user_id uuid, _new_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.user_role_in_company(auth.uid(), _company_id) <> 'admin' AND NOT public.is_saas_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.user_companies SET role = _new_role::company_role
  WHERE company_id = _company_id AND user_id = _target_user_id;
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.deactivate_company_member(_company_id uuid, _target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.user_role_in_company(auth.uid(), _company_id) <> 'admin' AND NOT public.is_saas_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.user_companies SET is_active = false WHERE company_id = _company_id AND user_id = _target_user_id;
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.reactivate_company_member(_company_id uuid, _target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.user_role_in_company(auth.uid(), _company_id) <> 'admin' AND NOT public.is_saas_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.user_companies SET is_active = true WHERE company_id = _company_id AND user_id = _target_user_id;
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.transfer_company_ownership(_company_id uuid, _new_admin_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.user_role_in_company(auth.uid(), _company_id) <> 'admin' AND NOT public.is_saas_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.user_companies SET role = 'manager' WHERE company_id = _company_id AND user_id = auth.uid();
  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (_new_admin_user_id, _company_id, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin', is_active = true;
  RETURN jsonb_build_object('success', true);
END $$;

-- =========================================================
-- FASE 5.6 — PERFIS DE PERMISSÃO
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_permission_profile(_user_id uuid, _company_id uuid)
RETURNS TABLE(profile_id uuid, profile_type text, permissions jsonb, hide_prices boolean, hide_costs boolean, can_operate_cash boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.id, COALESCE(pp.name,'employee')::text, pp.permissions,
         COALESCE((pp.permissions->>'hide_prices')::boolean, false),
         COALESCE((pp.permissions->>'hide_costs')::boolean, false),
         COALESCE((pp.permissions->>'can_operate_cash')::boolean, false)
  FROM public.employees e
  JOIN public.permission_profiles pp ON pp.id = e.permission_profile_id
  WHERE e.user_id = _user_id AND e.company_id = _company_id
  LIMIT 1;
$$;

-- =========================================================
-- FASE 5.7 — CONVITES DE FUNCIONÁRIOS
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD; emp_name text; comp_name text;
BEGIN
  SELECT * INTO inv FROM public.employee_invites WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'error', 'invalid_token'); END IF;
  IF inv.accepted_at IS NOT NULL THEN RETURN jsonb_build_object('valid', false, 'error', 'already_accepted'); END IF;
  IF inv.expires_at < now() THEN RETURN jsonb_build_object('valid', false, 'error', 'expired'); END IF;

  SELECT name INTO emp_name FROM public.employees WHERE id = inv.employee_id;
  SELECT name INTO comp_name FROM public.companies WHERE id = inv.company_id;
  RETURN jsonb_build_object('valid', true, 'email', inv.email,
    'employee_name', emp_name, 'company_name', comp_name, 'company_id', inv.company_id);
END $$;

CREATE OR REPLACE FUNCTION public.accept_employee_invite(_token text, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD;
BEGIN
  SELECT * INTO inv FROM public.employee_invites WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_token'); END IF;
  IF inv.accepted_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'already_accepted'); END IF;
  IF inv.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'expired'); END IF;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (_user_id, inv.company_id, inv.role::company_role, true)
  ON CONFLICT (user_id, company_id) DO UPDATE SET is_active = true;

  UPDATE public.employees SET user_id = _user_id WHERE id = inv.employee_id;
  UPDATE public.employee_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN jsonb_build_object('success', true, 'company_id', inv.company_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_employee_login_email(p_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.email FROM public.employees e
  JOIN auth.users u ON u.id = e.user_id
  WHERE lower(e.username) = lower(p_username) LIMIT 1;
$$;

-- =========================================================
-- FASE 5.8 — PAGAMENTOS / CATEGORIAS PADRÃO
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_default_financial_categories(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.financial_categories (company_id, name, kind, dre_group, color, sort_order, active)
  VALUES
    (_company_id, 'Vendas', 'receita', 'receita_bruta', '#10b981', 1, true),
    (_company_id, 'Impostos sobre vendas', 'despesa', 'deducoes', '#f59e0b', 2, true),
    (_company_id, 'Custo de Mercadoria', 'despesa', 'cmv', '#f97316', 3, true),
    (_company_id, 'Salários', 'despesa', 'despesas_operacionais', '#ef4444', 4, true),
    (_company_id, 'Aluguel', 'despesa', 'despesas_operacionais', '#a855f7', 5, true),
    (_company_id, 'Marketing', 'despesa', 'despesas_operacionais', '#3b82f6', 6, true),
    (_company_id, 'Outras despesas', 'despesa', 'outras_despesas', '#64748b', 99, true)
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.create_default_payment_options(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.formas_pagamento (company_id, name, tipo, ativo, sort_order)
  VALUES
    (_company_id, 'Dinheiro', 'dinheiro', true, 1),
    (_company_id, 'PIX', 'pix', true, 2),
    (_company_id, 'Cartão de Débito', 'debito', true, 3),
    (_company_id, 'Cartão de Crédito', 'credito', true, 4),
    (_company_id, 'Boleto', 'boleto', true, 5),
    (_company_id, 'Transferência', 'transferencia', true, 6)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.condicoes_pagamento (company_id, name, parcelas, ativo, sort_order)
  VALUES
    (_company_id, 'À vista', 1, true, 1),
    (_company_id, '2x sem juros', 2, true, 2),
    (_company_id, '3x sem juros', 3, true, 3),
    (_company_id, '6x sem juros', 6, true, 4),
    (_company_id, '10x sem juros', 10, true, 5)
  ON CONFLICT DO NOTHING;
END $$;

-- =========================================================
-- FASE 5.9 — CAIXA DA EMPRESA / MOVIMENTOS
-- =========================================================
CREATE OR REPLACE FUNCTION public.initialize_company_cash(_company_id uuid, _initial_balance numeric DEFAULT 0, _fixed_fund numeric DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  INSERT INTO public.company_cash (company_id, current_balance)
  VALUES (_company_id, COALESCE(_initial_balance, 0))
  ON CONFLICT (company_id) DO UPDATE SET current_balance = EXCLUDED.current_balance, updated_at = now();
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.register_company_cash_movement(
  _company_id uuid, _type text, _category text, _amount numeric, _description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  INSERT INTO public.company_cash_movements (company_id, type, category, amount, description, created_by)
  VALUES (_company_id, _type, _category, _amount, _description, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.company_cash (company_id, current_balance) VALUES (_company_id, 0) ON CONFLICT DO NOTHING;
  UPDATE public.company_cash SET
    current_balance = current_balance + CASE WHEN _type IN ('entrada','transferencia_in') THEN _amount ELSE -_amount END,
    updated_at = now()
  WHERE company_id = _company_id;

  RETURN jsonb_build_object('success', true, 'movement_id', new_id);
END $$;

CREATE OR REPLACE FUNCTION public.register_cash_exit_with_reinforcement(
  _cash_register_id uuid, _amount numeric, _category text, _description text, _payment_method text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; new_id uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.cash_registers WHERE id = _cash_register_id;
  IF v_company IS NULL OR NOT public.user_belongs_to_company(auth.uid(), v_company) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  INSERT INTO public.cash_movements (cash_register_id, company_id, type, category, amount, description, payment_method, created_by)
  VALUES (_cash_register_id, v_company, 'saida', _category, _amount, _description, _payment_method, auth.uid())
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('success', true, 'movement_id', new_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_pending_advances_summary(_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT jsonb_build_object(
    'total_pending', COALESCE(SUM(amount), 0),
    'count', COUNT(*)
  ) INTO result
  FROM public.cash_register_advances
  WHERE company_id = _company_id AND status = 'pending';
  RETURN result;
END $$;

-- =========================================================
-- FASE 5.10 — FLUXO DE CAIXA (PROJEÇÃO)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_cash_flow_projection(p_company_id uuid, p_start date, p_end date)
RETURNS TABLE(day date, receivables numeric, payables numeric, net numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), p_company_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  WITH days AS (SELECT generate_series(p_start, p_end, interval '1 day')::date AS d),
  ar AS (
    SELECT due_date::date AS d, SUM(amount) AS total FROM public.accounts_receivable
    WHERE company_id = p_company_id AND status <> 'cancelled'
      AND due_date BETWEEN p_start AND p_end
    GROUP BY due_date::date
  ),
  ap AS (
    SELECT due_date::date AS d, SUM(amount) AS total FROM public.expenses
    WHERE company_id = p_company_id AND status <> 'cancelled'
      AND due_date BETWEEN p_start AND p_end
    GROUP BY due_date::date
  )
  SELECT days.d, COALESCE(ar.total,0), COALESCE(ap.total,0), COALESCE(ar.total,0) - COALESCE(ap.total,0)
  FROM days LEFT JOIN ar ON ar.d = days.d LEFT JOIN ap ON ap.d = days.d
  ORDER BY days.d;
END $$;

-- =========================================================
-- FASE 5.11 — PLANO DE CORTE
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_cutting_plan_items(_template_id uuid, _company_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid, name text, type text, section text, side text,
  bar_length_mm numeric, pieces_quantity numeric,
  width_formula text, height_formula text, quantity_formula text,
  is_optional boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(cpi.id, pti.id) AS id,
         COALESCE(cpi.name, pti.name) AS name,
         COALESCE(cpi.type, pti.type) AS type,
         COALESCE(cpi.section, pti.section) AS section,
         COALESCE(cpi.side, pti.side) AS side,
         COALESCE(cpi.bar_length_mm, pti.bar_length_mm) AS bar_length_mm,
         COALESCE(cpi.pieces_quantity, pti.pieces_quantity) AS pieces_quantity,
         COALESCE(cpi.width_formula, pti.width_formula) AS width_formula,
         COALESCE(cpi.height_formula, pti.height_formula) AS height_formula,
         COALESCE(cpi.quantity_formula, pti.quantity_formula) AS quantity_formula,
         COALESCE(cpi.is_optional, pti.is_optional, false) AS is_optional
  FROM public.product_template_items pti
  LEFT JOIN public.company_product_items cpi
    ON _company_id IS NOT NULL
    AND cpi.company_id = _company_id
    AND cpi.item_template_id = pti.item_template_id
  WHERE pti.product_template_id = _template_id;
$$;

-- =========================================================
-- FASE 5.12 — CANCELAMENTOS (OS / VENDA)
-- =========================================================
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; consumed_count int;
BEGIN
  SELECT company_id INTO v_company FROM public.ordens_servico WHERE id = _ordem_servico_id;
  IF v_company IS NULL OR NOT public.user_belongs_to_company(auth.uid(), v_company) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COUNT(*) INTO consumed_count FROM public.material_consumption
  WHERE ordem_servico_id = _ordem_servico_id;

  IF consumed_count > 0 THEN
    RAISE EXCEPTION 'materiais já foram consumidos do estoque';
  END IF;

  UPDATE public.stock_reservations SET status = 'cancelled'
  WHERE ordem_servico_id = _ordem_servico_id AND status = 'active';

  UPDATE public.ordens_servico SET status = 'cancelada', cancelled_at = now(), cancelled_by = auth.uid()
  WHERE id = _ordem_servico_id;

  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id uuid, p_company_id uuid, p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_belongs_to_company(p_user_id, p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.sales SET payment_status = 'cancelled', cancelled_at = now(),
    cancelled_by = p_user_id, cancellation_reason = p_reason
  WHERE id = p_sale_id AND company_id = p_company_id;
  UPDATE public.accounts_receivable SET status = 'cancelled'
  WHERE sale_id = p_sale_id AND status <> 'paid';
  RETURN jsonb_build_object('success', true);
END $$;

-- =========================================================
-- FASE 5.13 — PRODUÇÃO / DISCREPÂNCIAS (stubs)
-- =========================================================
CREATE OR REPLACE FUNCTION public.release_materials_for_production(_ordem_servico_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.ordens_servico WHERE id = _ordem_servico_id;
  IF v_company IS NULL OR NOT public.user_belongs_to_company(auth.uid(), v_company) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.ordens_servico SET status = 'em_producao', updated_at = now()
  WHERE id = _ordem_servico_id;
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.get_operator_pending_discrepancies(_company_id uuid)
RETURNS TABLE(id uuid, description text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULL::uuid, NULL::text, NULL::timestamptz WHERE false;
$$;
