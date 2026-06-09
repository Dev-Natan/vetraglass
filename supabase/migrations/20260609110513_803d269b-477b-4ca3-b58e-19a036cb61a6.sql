-- First, drop the problematic constraints
ALTER TABLE public.accounts_receivable DROP CONSTRAINT IF EXISTS accounts_receivable_created_by_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;
ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_created_by_fkey;
ALTER TABLE public.cash_register_advances DROP CONSTRAINT IF EXISTS cash_register_advances_created_by_fkey;
ALTER TABLE public.employee_invites DROP CONSTRAINT IF EXISTS employee_invites_created_by_fkey;
ALTER TABLE public.financial_audit_logs DROP CONSTRAINT IF EXISTS financial_audit_logs_changed_by_fkey;
ALTER TABLE public.financial_periods DROP CONSTRAINT IF EXISTS financial_periods_closed_by_fkey;
ALTER TABLE public.os_photos DROP CONSTRAINT IF EXISTS os_photos_uploaded_by_fkey;
ALTER TABLE public.os_cutting_plan DROP CONSTRAINT IF EXISTS os_cutting_plan_completed_by_fkey;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
ALTER TABLE public.stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_created_by_fkey;
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_approved_by_fkey;
ALTER TABLE public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_operator_id_fkey;
ALTER TABLE public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_audited_by_fkey;
ALTER TABLE public.cash_register_audits DROP CONSTRAINT IF EXISTS cash_register_audits_auditor_id_fkey;

-- Now recreate them with ON DELETE SET NULL
ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cash_register_advances ADD CONSTRAINT cash_register_advances_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.employee_invites ADD CONSTRAINT employee_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_audit_logs ADD CONSTRAINT financial_audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_periods ADD CONSTRAINT financial_periods_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.os_photos ADD CONSTRAINT os_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.os_cutting_plan ADD CONSTRAINT os_cutting_plan_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.stock_reservations ADD CONSTRAINT stock_reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cash_registers ADD CONSTRAINT cash_registers_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cash_registers ADD CONSTRAINT cash_registers_audited_by_fkey FOREIGN KEY (audited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cash_register_audits ADD CONSTRAINT cash_register_audits_auditor_id_fkey FOREIGN KEY (auditor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Handle non-nullable columns by making them nullable first
ALTER TABLE public.os_dimension_history ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.os_dimension_history DROP CONSTRAINT IF EXISTS os_dimension_history_user_id_fkey;
ALTER TABLE public.os_dimension_history ADD CONSTRAINT os_dimension_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.cash_register_audits ALTER COLUMN operator_id DROP NOT NULL;
ALTER TABLE public.cash_register_audits DROP CONSTRAINT IF EXISTS cash_register_audits_operator_id_fkey;
ALTER TABLE public.cash_register_audits ADD CONSTRAINT cash_register_audits_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.operator_discrepancies ALTER COLUMN operator_id DROP NOT NULL;
ALTER TABLE public.operator_discrepancies DROP CONSTRAINT IF EXISTS operator_discrepancies_operator_id_fkey;
ALTER TABLE public.operator_discrepancies ADD CONSTRAINT operator_discrepancies_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
