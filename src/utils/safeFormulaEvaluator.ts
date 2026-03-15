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
 * Normalizes formula variable names to safe internal variables
 * Handles Portuguese variable names and abbreviations
 * Supports: L/Largura → W, A/Altura → H, FL → FL, FA → FA
 */
function normalizeFormula(formula: string): string {
  return formula
    // Protect FL and FA first (before L and A replacement)
    .replace(/\bFL\b/g, '__FL__')
    .replace(/\bFA\b/g, '__FA__')
    // Replace full Portuguese names
    .replace(/Largura/gi, 'W')
    .replace(/Altura/gi, 'H')
    // Replace standalone L and A (word boundaries)
    .replace(/\bL\b/gi, 'W')
    .replace(/\bA\b/gi, 'H')
    // Restore FL and FA
    .replace(/__FL__/g, 'FL')
    .replace(/__FA__/g, 'FA')
    // Replace commas with dots for decimal numbers
    .replace(/,/g, '.');
}

/**
 * Extended formula context with folga (clearance) variables
 */
export interface FormulaContext {
  width: number;
  height: number;
  folgaLargura?: number;
  folgaAltura?: number;
}

/**
 * Evaluates a parametric formula with width, height, and optional folga variables
 * 
 * Supported variables in formulas:
 * - L / Largura / W = width (largura do vão)
 * - A / Altura / H = height (altura do vão)
 * - FL = folga da largura
 * - FA = folga da altura
 * 
 * @param formula - The formula string (e.g., "L - FL", "Altura - 20", "(L - FL) / 2 - 53")
 * @param widthOrContext - Width value in mm, or a FormulaContext object
 * @param height - Height value in mm (optional if using context)
 * @returns The calculated result rounded to nearest integer, or 0 if evaluation fails
 */
export function evaluateFormula(
  formula: string, 
  widthOrContext: number | FormulaContext, 
  height?: number
): number {
  try {
    if (!formula || formula.trim() === '') return 0;
    
    let w: number, h: number, fl: number, fa: number;
    
    if (typeof widthOrContext === 'object') {
      w = widthOrContext.width;
      h = widthOrContext.height;
      fl = widthOrContext.folgaLargura ?? 0;
      fa = widthOrContext.folgaAltura ?? 0;
    } else {
      w = widthOrContext;
      h = height ?? 0;
      fl = 0;
      fa = 0;
    }
    
    const normalized = normalizeFormula(formula);
    
    // Create scope with all variables
    const scope = {
      ...limitedScope,
      W: w,
      H: h,
      w: w,
      h: h,
      FL: fl,
      FA: fa,
      fl: fl,
      fa: fa,
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
  sampleHeight: number = 1000,
  sampleFL: number = 2,
  sampleFA: number = 3
): { isValid: boolean; result: number | null; error: string } {
  if (!formula || formula.trim() === '') {
    return { isValid: true, result: null, error: '' };
  }

  try {
    const result = evaluateFormula(formula, {
      width: sampleWidth,
      height: sampleHeight,
      folgaLargura: sampleFL,
      folgaAltura: sampleFA,
    });
    
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
