/**
 * Centralized formula presets used across the app
 * (ProductTemplates composition, EditarProduto, CuttingPlanCalculator, OS).
 *
 * All formulas honor the case-insensitive parser in safeFormulaEvaluator.ts,
 * so "Largura", "largura", "L" and "LARGURA" all resolve to the same width.
 */

export interface FormulaPreset {
  label: string;
  formula: string;
  description?: string;
}

/** Length / cut formulas (used for width_formula, height_formula, quantity_formula of profiles) */
export const LENGTH_FORMULA_PRESETS: FormulaPreset[] = [
  { label: 'Altura cheia',        formula: 'Altura',                description: 'Usa a altura do vão' },
  { label: 'Largura cheia',       formula: 'Largura',               description: 'Usa a largura do vão' },
  { label: 'Altura − 40',         formula: 'Altura - 40',           description: 'Altura com desconto de folga' },
  { label: 'Largura − 40',        formula: 'Largura - 40',          description: 'Largura com desconto de folga' },
  { label: '(L − FL) / 2',        formula: '(Largura - FL) / 2',    description: 'Meia largura descontada' },
  { label: '(A − FA) / 2',        formula: '(Altura - FA) / 2',     description: 'Meia altura descontada' },
  { label: 'Lado A + Lado B',     formula: 'largura_lado_a + largura_lado_b' },
  { label: 'Área m²',             formula: 'Altura * Largura / 1000000' },
];

/**
 * Quantity (pieces) formulas.
 * Result is always rounded UP (Math.ceil) then multiplied by the product quantity.
 */
export const PIECES_FORMULA_PRESETS: FormulaPreset[] = [
  { label: 'Fixa 1',                 formula: '1',                            description: 'Uma peça por produto' },
  { label: '(Largura / 500) + 1',    formula: '(Largura / 500) + 1',          description: 'Divisores a cada 500mm de largura' },
  { label: '(Altura / 500) + 1',     formula: '(Altura / 500) + 1',           description: 'Divisores a cada 500mm de altura' },
  { label: '(Altura − 94) / 130',    formula: '(Altura - 94) / 130',          description: 'Travessas espaçadas 130mm' },
  { label: '(Largura − 94) / 130',   formula: '(Largura - 94) / 130',         description: 'Travessas horizontais 130mm' },
  { label: 'Largura / 1000',         formula: 'Largura / 1000',               description: 'Uma peça por metro de largura' },
  { label: 'Altura / 1000',          formula: 'Altura / 1000',                description: 'Uma peça por metro de altura' },
  { label: 'Folhas × 2',             formula: 'folhas * 2',                   description: 'Duas peças por folha' },
  { label: 'Lados',                  formula: 'lados',                        description: 'Uma peça por lado' },
];
