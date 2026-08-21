import { create, all, type MathNode } from 'mathjs';

const math = create(all);
const ALLOWED_VARIABLES = new Set(['L', 'A', 'Q', 'FOLHAS']);
const ALLOWED_FUNCTIONS = new Set(['min', 'max', 'ceil', 'floor', 'round']);
const ALLOWED_OPERATORS = new Set(['+', '-', '*', '/']);

export class ParametricFormulaError extends Error {
  constructor(
    public readonly code:
      | 'EMPTY_FORMULA'
      | 'INVALID_FORMULA'
      | 'UNSAFE_EXPRESSION'
      | 'DIVISION_BY_ZERO'
      | 'NON_FINITE_RESULT'
      | 'INVALID_CONDITION',
    message: string,
  ) {
    super(message);
    this.name = 'ParametricFormulaError';
  }
}

export interface ParametricFormulaVariables {
  L: number;
  A: number;
  Q: number;
  FOLHAS: number;
}

export interface ParametricEngineInputs {
  width_mm: number;
  height_mm: number;
  quantity: number;
  line: string | null;
  glass: string | null;
  profile_color: string | null;
  glass_color: string | null;
  variants: Record<string, string | number | boolean>;
}

export type ParametricMaterialType = 'profile' | 'glass' | 'accessory' | 'consumable' | 'service';

export interface ResolvedParametricRule {
  id: string;
  rule_key: string;
  material_type: ParametricMaterialType;
  item_template_id: string | null;
  company_item_id: string | null;
  item_name: string;
  group_name: string;
  formula: string | null;
  width_formula: string | null;
  height_formula: string | null;
  quantity_formula: string | null;
  pieces_formula: string | null;
  pieces_quantity: number;
  condition_expression: string | null;
  unit: string;
  cut_orientation: string | null;
  cut_angle: string | null;
  side: string;
  calculation_type: string;
  applies_to: string;
  loss_percent: number;
  version: number;
  is_validated: boolean;
  validation_source: string | null;
  source: 'global' | 'company_override';
  cost_per_unit: number | null;
  sale_price_per_unit: number | null;
}

export interface ParametricMaterialResult {
  item_template_id: string | null;
  company_item_id: string | null;
  item_name: string;
  material_type: ParametricMaterialType;
  quantity: number;
  unit: string;
  cuts_mm: number[];
  glass_pieces: Array<{ width_mm: number; height_mm: number; quantity: number }>;
  cost: number | null;
  sale_price: number | null;
  source_rule_id: string;
  source_rule_version: number;
  source: 'global' | 'company_override';
  estimated: boolean;
  validated: boolean;
}

export interface ParametricEngineeringResult {
  composition_mode: 'parametric';
  engine_version: 1;
  snapshot_version: 1;
  inputs: ParametricEngineInputs;
  rules: Array<{
    id: string;
    rule_key: string;
    version: number;
    source: 'global' | 'company_override';
    validated: boolean;
  }>;
  materials: ParametricMaterialResult[];
  glass_pieces: Array<ParametricMaterialResult['glass_pieces'][number] & {
    item_template_id: string | null;
    company_item_id: string | null;
    source_rule_id: string;
  }>;
  cuts: Array<{
    item_template_id: string | null;
    company_item_id: string | null;
    item_name: string;
    length_mm: number;
    quantity: number;
    angle: string | null;
    orientation: string | null;
    source_rule_id: string;
  }>;
  totals: {
    cost: number;
    sale_price: number;
    margin: number;
    missing_cost_items: number;
    missing_price_items: number;
  };
  warnings: string[];
  /** Compatibility contract consumed by approve_quote_transactional. */
  items: Array<Record<string, string | number | boolean | null>>;
}

function normalizeFormula(formula: string): string {
  return formula
    .replace(/\bLargura\b/gi, 'L')
    .replace(/\bAltura\b/gi, 'A')
    .replace(/\bFolhas\b/gi, 'FOLHAS')
    .replace(/,/g, '.');
}

function validateNode(node: MathNode): void {
  node.traverse((child) => {
    switch (child.type) {
      case 'ConstantNode':
      case 'ParenthesisNode':
        return;
      case 'SymbolNode': {
        const name = (child as MathNode & { name: string }).name;
        if (!ALLOWED_VARIABLES.has(name) && !ALLOWED_FUNCTIONS.has(name)) {
          throw new ParametricFormulaError('UNSAFE_EXPRESSION', `Símbolo não permitido: ${name}`);
        }
        return;
      }
      case 'OperatorNode': {
        const op = (child as MathNode & { op: string }).op;
        if (!ALLOWED_OPERATORS.has(op)) {
          throw new ParametricFormulaError('UNSAFE_EXPRESSION', `Operador não permitido: ${op}`);
        }
        return;
      }
      case 'FunctionNode': {
        const fn = (child as MathNode & { fn: { name?: string } }).fn.name;
        if (!fn || !ALLOWED_FUNCTIONS.has(fn)) {
          throw new ParametricFormulaError('UNSAFE_EXPRESSION', `Função não permitida: ${fn ?? 'desconhecida'}`);
        }
        return;
      }
      default:
        throw new ParametricFormulaError('UNSAFE_EXPRESSION', `Expressão não permitida: ${child.type}`);
    }
  });
}

export function evaluateParametricFormula(
  formula: string,
  variables: ParametricFormulaVariables,
): number {
  if (!formula.trim()) {
    throw new ParametricFormulaError('EMPTY_FORMULA', 'A fórmula está vazia.');
  }

  let node: MathNode;
  try {
    node = math.parse(normalizeFormula(formula));
  } catch {
    throw new ParametricFormulaError('INVALID_FORMULA', `Fórmula inválida: ${formula}`);
  }
  validateNode(node);

  let value: unknown;
  try {
    value = node.compile().evaluate(Object.freeze({
      ...variables,
      min: Math.min,
      max: Math.max,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
    }));
  } catch (error) {
    if (error instanceof ParametricFormulaError) throw error;
    throw new ParametricFormulaError('INVALID_FORMULA', `Não foi possível calcular: ${formula}`);
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ParametricFormulaError('NON_FINITE_RESULT', `Resultado inválido: ${formula}`);
  }
  if (!Number.isFinite(value)) {
    if (normalizeFormula(formula).includes('/')) {
      throw new ParametricFormulaError('DIVISION_BY_ZERO', `Divisão por zero: ${formula}`);
    }
    throw new ParametricFormulaError('NON_FINITE_RESULT', `Resultado não finito: ${formula}`);
  }
  return value;
}

function evaluateCondition(expression: string | null, inputs: ParametricEngineInputs): boolean {
  if (!expression?.trim()) return true;
  const values: Record<string, string | number | boolean | null> = {
    line: inputs.line,
    glass: inputs.glass,
    profile_color: inputs.profile_color,
    glass_color: inputs.glass_color,
    ...inputs.variants,
  };
  const parts = expression.trim().split(/\s*(&&|\|\|)\s*/);
  if (parts.length % 2 === 0) {
    throw new ParametricFormulaError('INVALID_CONDITION', `Condição inválida: ${expression}`);
  }

  const evaluateClause = (clause: string) => {
    const match = clause.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=)\s*(?:"([^"]*)"|'([^']*)'|([A-Za-z0-9_.-]+))$/);
    if (!match || !(match[1] in values)) {
      throw new ParametricFormulaError('INVALID_CONDITION', `Condição inválida: ${expression}`);
    }
    const actual = String(values[match[1]] ?? '');
    const expected = match[3] ?? match[4] ?? match[5] ?? '';
    return match[2] === '==' ? actual === expected : actual !== expected;
  };

  let result = evaluateClause(parts[0]);
  for (let index = 1; index < parts.length; index += 2) {
    const next = evaluateClause(parts[index + 1]);
    result = parts[index] === '&&' ? result && next : result || next;
  }
  return result;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export function calculateParametricEngineering(
  inputs: ParametricEngineInputs,
  rules: ResolvedParametricRule[],
): ParametricEngineeringResult {
  if (inputs.width_mm <= 0 || inputs.height_mm <= 0 || inputs.quantity <= 0) {
    throw new ParametricFormulaError('INVALID_FORMULA', 'Largura, altura e quantidade devem ser positivas.');
  }
  const variables: ParametricFormulaVariables = {
    L: inputs.width_mm,
    A: inputs.height_mm,
    Q: inputs.quantity,
    FOLHAS: Number(inputs.variants.folhas ?? 2),
  };
  const warnings = new Set<string>();
  const materials: ParametricMaterialResult[] = [];
  const cuts: ParametricEngineeringResult['cuts'] = [];
  const glassPieces: ParametricEngineeringResult['glass_pieces'] = [];
  const snapshotItems: ParametricEngineeringResult['items'] = [];

  for (const rule of rules) {
    if (!evaluateCondition(rule.condition_expression, inputs)) continue;
    if (!rule.item_template_id && !rule.company_item_id) {
      warnings.add(`Regra ${rule.rule_key}: item não configurado.`);
    }
    if (!rule.is_validated) {
      warnings.add(`Regra ${rule.rule_key}: fórmula estimada — confirmar antes da produção.`);
    }

    const basePieces = Math.max(1, Math.ceil(rule.pieces_quantity || 1));
    const dynamicPieces = rule.pieces_formula
      ? Math.max(0, Math.ceil(evaluateParametricFormula(rule.pieces_formula, variables)))
      : 1;
    const formulaMultiplier = rule.quantity_formula?.trim()
      ? Math.max(0, evaluateParametricFormula(rule.quantity_formula, variables))
      : 1;
    const pieces = basePieces * dynamicPieces * formulaMultiplier * inputs.quantity;
    const width = rule.width_formula
      ? evaluateParametricFormula(rule.width_formula, variables)
      : null;
    const height = rule.height_formula
      ? evaluateParametricFormula(rule.height_formula, variables)
      : null;
    const fallback = rule.formula
      ? evaluateParametricFormula(rule.formula, variables)
      : null;
    const cutLength = width ?? height ?? (rule.material_type === 'profile' ? fallback : null);
    if ((width !== null && width <= 0) || (height !== null && height <= 0) || (cutLength !== null && cutLength <= 0)) {
      throw new ParametricFormulaError('INVALID_FORMULA', `Regra ${rule.rule_key} gerou uma medida não positiva.`);
    }

    const materialGlassPieces = rule.material_type === 'glass' && width !== null && height !== null
      ? [{ width_mm: roundQuantity(width), height_mm: roundQuantity(height), quantity: roundQuantity(pieces) }]
      : [];
    const cutsMm = rule.material_type === 'profile' && cutLength !== null
      ? Array.from({ length: Math.ceil(pieces) }, () => roundQuantity(cutLength))
      : [];
    const quantity = rule.material_type === 'glass' && width !== null && height !== null
      ? (width * height * pieces) / 1_000_000
      : rule.material_type === 'profile' && cutLength !== null
        ? (cutLength * pieces) / 1000
        : pieces;
    if (quantity > 10_000) {
      throw new ParametricFormulaError(
        'INVALID_FORMULA',
        `Regra ${rule.rule_key}: quantidade ${roundQuantity(quantity)} fora da faixa segura; exige calibração.`,
      );
    }
    const cost = rule.cost_per_unit === null ? null : roundMoney(quantity * rule.cost_per_unit);
    const salePrice = rule.sale_price_per_unit === null ? null : roundMoney(quantity * rule.sale_price_per_unit);

    materials.push({
      item_template_id: rule.item_template_id,
      company_item_id: rule.company_item_id,
      item_name: rule.item_name,
      material_type: rule.material_type,
      quantity: roundQuantity(quantity),
      unit: rule.unit,
      cuts_mm: cutsMm,
      glass_pieces: materialGlassPieces,
      cost,
      sale_price: salePrice,
      source_rule_id: rule.id,
      source_rule_version: rule.version,
      source: rule.source,
      estimated: !rule.is_validated,
      validated: rule.is_validated,
    });

    if (rule.material_type === 'profile' && cutLength !== null) {
      cuts.push({
        item_template_id: rule.item_template_id,
        company_item_id: rule.company_item_id,
        item_name: rule.item_name,
        length_mm: roundQuantity(cutLength),
        quantity: roundQuantity(pieces),
        angle: rule.cut_angle,
        orientation: rule.cut_orientation,
        source_rule_id: rule.id,
      });
    }
    for (const piece of materialGlassPieces) {
      glassPieces.push({
        ...piece,
        item_template_id: rule.item_template_id,
        company_item_id: rule.company_item_id,
        source_rule_id: rule.id,
      });
    }

    snapshotItems.push({
      id: rule.id,
      rule_key: rule.rule_key,
      source_rule_version: rule.version,
      item_template_id: rule.item_template_id,
      company_item_id: rule.company_item_id,
      material_type: rule.material_type,
      width_formula: rule.width_formula,
      height_formula: rule.height_formula,
      quantity_formula: rule.quantity_formula,
      pieces_formula: rule.pieces_formula,
      pieces_quantity: rule.pieces_quantity,
      side: rule.side,
      calculation_type: rule.calculation_type,
      applies_to: rule.applies_to,
      cut_angle: rule.cut_angle,
      is_optional: false,
      validated: rule.is_validated,
    });
  }

  const missingCost = materials.filter((material) => material.cost === null).length;
  const missingPrice = materials.filter((material) => material.sale_price === null).length;
  if (missingCost) warnings.add(`${missingCost} material(is) sem custo configurado.`);
  if (missingPrice) warnings.add(`${missingPrice} material(is) sem preço de venda configurado.`);
  const totalCost = roundMoney(materials.reduce((sum, material) => sum + (material.cost ?? 0), 0));
  const totalSalePrice = roundMoney(materials.reduce((sum, material) => sum + (material.sale_price ?? 0), 0));

  return {
    composition_mode: 'parametric',
    engine_version: 1,
    snapshot_version: 1,
    inputs: { ...inputs, variants: { ...inputs.variants } },
    rules: rules.map((rule) => ({
      id: rule.id,
      rule_key: rule.rule_key,
      version: rule.version,
      source: rule.source,
      validated: rule.is_validated,
    })),
    materials,
    glass_pieces: glassPieces,
    cuts,
    totals: {
      cost: totalCost,
      sale_price: totalSalePrice,
      margin: roundMoney(totalSalePrice - totalCost),
      missing_cost_items: missingCost,
      missing_price_items: missingPrice,
    },
    warnings: [...warnings],
    items: snapshotItems,
  };
}
