import assert from 'node:assert/strict';
import {
  calculateParametricEngineering,
  evaluateParametricFormula,
  ParametricFormulaError,
  type ResolvedParametricRule,
} from '../src/utils/parametricEngineeringEngine.ts';
import { evaluateFormula } from '../src/utils/safeFormulaEvaluator.ts';

const baseRule: ResolvedParametricRule = {
  id: '00000000-0000-0000-0000-000000000001',
  rule_key: 'su-001-horizontal',
  material_type: 'profile',
  item_template_id: '00000000-0000-0000-0000-000000000101',
  company_item_id: '00000000-0000-0000-0000-000000000201',
  item_name: 'SU-001',
  group_name: 'Perfis',
  formula: 'L - 26',
  width_formula: 'L - 26',
  height_formula: null,
  quantity_formula: '1',
  pieces_formula: null,
  pieces_quantity: 1,
  condition_expression: 'folhas == 2',
  unit: 'm',
  cut_orientation: 'horizontal',
  cut_angle: '90',
  side: 'A',
  calculation_type: 'formula',
  applies_to: 'side',
  loss_percent: 0,
  version: 1,
  is_validated: false,
  validation_source: 'existing_product_template_items_estimated',
  source: 'global',
  cost_per_unit: 10,
  sale_price_per_unit: 18,
};

const glassRule: ResolvedParametricRule = {
  ...baseRule,
  id: '00000000-0000-0000-0000-000000000002',
  rule_key: 'glass',
  material_type: 'glass',
  item_name: 'Vidro',
  width_formula: 'L - 72',
  height_formula: 'A - 134',
  pieces_quantity: 2,
  unit: 'm2',
  cut_orientation: null,
  cost_per_unit: 80,
  sale_price_per_unit: 150,
  is_validated: true,
};

const inputs = {
  width_mm: 2000,
  height_mm: 1200,
  quantity: 1,
  line: 'Suprema',
  glass: 'Comum',
  profile_color: 'Branco',
  glass_color: 'Incolor',
  variants: { folhas: 2 },
};

assert.equal(evaluateParametricFormula('round((L - 26) / 2)', { L: 2000, A: 1200, Q: 1, FOLHAS: 2 }), 987);
assert.equal(evaluateFormula('L - 26', 2000, 1200), 1974, 'FIXED evaluator compatibility changed');

const first = calculateParametricEngineering(inputs, [baseRule, glassRule]);
const replay = calculateParametricEngineering(inputs, [baseRule, glassRule]);
assert.deepEqual(first, replay, 'engine output is not deterministic');
assert.deepEqual(first.materials[0].cuts_mm, [1974]);
assert.deepEqual(first.glass_pieces[0], {
  width_mm: 1928,
  height_mm: 1066,
  quantity: 2,
  item_template_id: glassRule.item_template_id,
  company_item_id: glassRule.company_item_id,
  source_rule_id: glassRule.id,
});
assert.equal(first.items[0].source_rule_version, 1);
assert.ok(first.warnings.some((warning) => warning.includes('estimada')));

const overridden = calculateParametricEngineering(inputs, [{
  ...baseRule,
  width_formula: 'L - 40',
  formula: 'L - 40',
  source: 'company_override',
}]);
assert.equal(overridden.cuts[0].length_mm, 1960);
assert.equal(overridden.materials[0].source, 'company_override');

const missingConfiguration = calculateParametricEngineering(inputs, [{
  ...baseRule,
  item_template_id: null,
  company_item_id: null,
  cost_per_unit: null,
  sale_price_per_unit: null,
}]);
assert.equal(missingConfiguration.totals.missing_cost_items, 1);
assert.equal(missingConfiguration.totals.missing_price_items, 1);
assert.ok(missingConfiguration.warnings.some((warning) => warning.includes('item não configurado')));

for (const [formula, expectedCode] of [
  ['L / (A - A)', 'DIVISION_BY_ZERO'],
  ['import("fs")', 'UNSAFE_EXPRESSION'],
  ['L ^ 2', 'UNSAFE_EXPRESSION'],
] as const) {
  assert.throws(
    () => evaluateParametricFormula(formula, { L: 2000, A: 1200, Q: 1, FOLHAS: 2 }),
    (error) => error instanceof ParametricFormulaError && error.code === expectedCode,
  );
}

assert.throws(
  () => calculateParametricEngineering(inputs, [{
    ...baseRule,
    condition_expression: 'globalThis.execute()',
  }]),
  (error) => error instanceof ParametricFormulaError && error.code === 'INVALID_CONDITION',
);

console.log(JSON.stringify({
  deterministic: true,
  fixed_compatibility: true,
  cuts: first.cuts,
  glass_pieces: first.glass_pieces,
  totals: first.totals,
  warnings: first.warnings,
}, null, 2));
