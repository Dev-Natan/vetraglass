import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const readSource = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const migration = readSource(
  'supabase/migrations/20260909233531_phase01a_dynamic_os_material_availability.sql',
);
const purchases = readSource('src/components/ordens-servico/OSPurchasesList.tsx');
const functionBody = migration.match(/AS \$\$([\s\S]*?)\$\$;/)?.[1] ?? '';

test('DASTATIC01 RPC is stable, invoker-scoped and explicitly tenant-checked', () => {
  assert.match(migration, /get_os_dynamic_material_availability/);
  assert.match(migration, /STABLE\s+SECURITY INVOKER/);
  assert.match(functionBody, /user_belongs_to_company/);
  assert.match(migration, /REVOKE ALL[\s\S]*FROM PUBLIC, anon/);
});

test('DASTATIC02 RPC body is read-only and does not invoke Phase 3G mutation flows', () => {
  assert.doesNotMatch(functionBody, /\b(?:INSERT|UPDATE|DELETE|MERGE|CALL)\b/i);
  for (const forbidden of [
    'reconcile_os_material_requirements',
    'reserve_os_materials',
    'release_materials_for_production',
    'start_os_production',
    'complete_os_production',
  ]) {
    assert.doesNotMatch(functionBody, new RegExp(forbidden));
  }
});

test('DASTATIC03 contract separates physical stock, reservations and open purchases', () => {
  for (const field of [
    'physical_on_hand',
    'reserved_total',
    'reserved_for_this_os',
    'available_free',
    'available_for_os',
    'missing_quantity',
    'purchase_coverage_open',
  ]) {
    assert.match(functionBody, new RegExp(field));
  }
  assert.match(functionBody, /physical_stock_balances/);
  assert.match(functionBody, /material_purchase_requirements_summary/);
});

test('DASTATIC04 dimensional glass is not reported as exactly available', () => {
  assert.match(functionBody, /availability_precision = 'UNSUPPORTED'/);
  assert.match(functionBody, /dimension_validation_required/);
  assert.doesNotMatch(functionBody, /VIDRO FIXO|VIDRO MOVEL|VIDRO MÓVEL/);
});

test('DASTATIC05 purchases UI uses the dynamic RPC and primary business columns', () => {
  assert.match(purchases, /get_os_dynamic_material_availability/);
  assert.doesNotMatch(purchases, /get_os_material_availability/);
  for (const label of ['Material', 'Necessário', 'Disponível', 'Faltante', 'Situação']) {
    assert.match(purchases, new RegExp(label));
  }
  assert.doesNotMatch(purchases, /\.insert\(|\.update\(|\.delete\(/);
});
