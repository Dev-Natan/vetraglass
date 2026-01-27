
-- =====================================================
-- FIX: Sales table - add policy for employees to see own sales
-- =====================================================

-- Regular employees can only see sales they made (sold_by links to their employee record)
CREATE POLICY "Employees can view own sales"
  ON sales FOR SELECT
  USING (
    sold_by IS NOT NULL 
    AND sold_by IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    AND company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
