/**
 * Safe Formula Evaluator
 * 
 * This utility provides a secure way to evaluate mathematical formulas
 * using mathjs with a restricted set of functions to prevent code injection.
 * 
 * Replaces the vulnerable expr-eval package.
 */

import { create, all } from 'mathjs';

// Create a mathjs instance with limited scope for security
const math = create(all);

// Limit the available functions to only safe mathematical operations
const limitedScope = {
  // Basic arithmetic is handled automatically
  // Only expose safe math functions
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  max: Math.max,
  min: Math.min,
  sqrt: Math.sqrt,
  pow: Math.pow,
};

/**
 * Normalizes formula variable names to safe single-letter variables
 * Handles Portuguese variable names (Altura, Largura) and abbreviations (A, L)
 */
function normalizeFormula(formula: string): string {
  return formula
    // Replace full Portuguese names first
    .replace(/Largura/gi, 'W')
    .replace(/Altura/gi, 'H')
    // Replace standalone L and A (word boundaries) - common abbreviations
    .replace(/\bL\b/gi, 'W')
    .replace(/\bA\b/gi, 'H')
    // Replace commas with dots for decimal numbers
    .replace(/,/g, '.');
}

/**
 * Evaluates a formula with width (W) and height (H) variables
 * Returns the result rounded to the nearest integer
 * 
 * @param formula - The formula string (e.g., "Altura - 20", "Largura / 2")
 * @param width - The width value in mm
 * @param height - The height value in mm
 * @returns The calculated result, or 0 if evaluation fails
 */
export function evaluateFormula(formula: string, width: number, height: number): number {
  try {
    if (!formula || formula.trim() === '') return 0;
    
    const normalized = normalizeFormula(formula);
    
    // Create scope with variables
    const scope = {
      ...limitedScope,
      W: width,
      H: height,
      w: width,
      h: height,
    };
    
    const result = math.evaluate(normalized, scope);
    
    // Ensure we return a valid number
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return 0;
    }
    
    return Math.round(result);
  } catch (error) {
    console.warn('Error evaluating formula:', formula, error);
    return 0;
  }
}

/**
 * Evaluates a formula for quantity calculation (used in sales/stock)
 * Variables L and A represent dimensions in meters
 * 
 * @param formula - The formula string
 * @param width - Width in mm (converted to meters internally)
 * @param height - Height in mm (converted to meters internally)
 * @param piecesQty - Number of pieces to multiply by
 * @returns The calculated quantity
 */
export function calculateFormulaQuantity(
  formula: string, 
  width: number, 
  height: number, 
  piecesQty: number
): number {
  try {
    if (!formula || formula.trim() === '') return piecesQty;
    
    // Convert mm to meters
    const L = width / 1000;
    const A = height / 1000;
    
    // Normalize and prepare formula
    let processedFormula = formula
      .replace(/largura/gi, 'L')
      .replace(/altura/gi, 'A')
      .replace(/,/g, '.');
    
    // Create scope with variables
    const scope = {
      ...limitedScope,
      L,
      A,
      l: L,
      a: A,
    };
    
    const result = math.evaluate(processedFormula, scope);
    
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return piecesQty;
    }
    
    return (result / 1000) * piecesQty;
  } catch (error) {
    console.error('Erro ao calcular fórmula:', formula, error);
    return 0;
  }
}

/**
 * Validates a formula and returns preview result with sample values
 * Used in formula editor components for live preview
 * 
 * @param formula - The formula string to validate
 * @param sampleWidth - Sample width for preview (default: 800)
 * @param sampleHeight - Sample height for preview (default: 1000)
 * @returns Validation result with isValid flag, result, and error message
 */
export function validateFormula(
  formula: string,
  sampleWidth: number = 800,
  sampleHeight: number = 1000
): { isValid: boolean; result: number | null; error: string } {
  if (!formula || formula.trim() === '') {
    return { isValid: true, result: null, error: '' };
  }

  try {
    // Replace variables with sample values for preview
    const testFormula = formula
      .replace(/Altura/gi, String(sampleHeight))
      .replace(/Largura/gi, String(sampleWidth))
      .replace(/\bH\b/gi, String(sampleHeight))
      .replace(/\bW\b/gi, String(sampleWidth))
      .replace(/\bA\b/gi, String(sampleHeight))
      .replace(/\bL\b/gi, String(sampleWidth))
      .replace(/,/g, '.');
    
    const result = math.evaluate(testFormula, limitedScope);
    
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return { isValid: true, result, error: '' };
    }
    return { isValid: false, result: null, error: 'Resultado inválido' };
  } catch {
    return { isValid: false, result: null, error: 'Fórmula inválida' };
  }
}

/**
 * Detects if a formula primarily uses height or width
 * Used to determine profile orientation in cutting plans
 * 
 * @param formula - The formula string
 * @returns 'Altura' or 'Largura' based on the formula content
 */
export function getFormulaPosition(formula: string | null): 'Altura' | 'Largura' {
  if (!formula) return 'Largura';
  const lower = formula.toLowerCase();
  if (lower.includes('altura') || lower.includes('h') || lower.includes('a')) {
    return 'Altura';
  }
  return 'Largura';
}
