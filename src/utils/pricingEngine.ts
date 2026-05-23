/**
 * Pricing Engine - Motor de Precificação em Camadas
 * 
 * Nível 1: Fórmulas Geométricas (medidas derivadas)
 * Nível 2: Fórmulas de Composição (quantidade de insumos)
 * Nível 3: Fórmulas Financeiras (custos, perdas, margem)
 */

import { evaluateFormula, type FormulaContext } from './safeFormulaEvaluator';

// ─── Types ───────────────────────────────────────────────────

export type MarginType = 'simple' | 'markup';
export type RoundingMode = 'round' | 'ceil' | 'floor' | 'none';

export interface PricingPolicy {
  marginType: MarginType;
  defaultMargin: number;
  defaultLossPercent: number;
  includeLabor: boolean;
  laborCostPerSqm: number;
  includePackaging: boolean;
  packagingCostPerUnit: number;
  includeInstallation: boolean;
  installationCostPerSqm: number;
  includeTransport: boolean;
  transportCostPerUnit: number;
  includeCommission: boolean;
  commissionPercent: number;
  includeTax: boolean;
  taxPercent: number;
  adminFee: number;
  roundingMode: RoundingMode;
  priceDecimals: number;
}

export const DEFAULT_PRICING_POLICY: PricingPolicy = {
  marginType: 'simple',
  defaultMargin: 30,
  defaultLossPercent: 5,
  includeLabor: false,
  laborCostPerSqm: 0,
  includePackaging: false,
  packagingCostPerUnit: 0,
  includeInstallation: false,
  installationCostPerSqm: 0,
  includeTransport: false,
  transportCostPerUnit: 0,
  includeCommission: false,
  commissionPercent: 0,
  includeTax: false,
  taxPercent: 0,
  adminFee: 0,
  roundingMode: 'round',
  priceDecimals: 2,
};

export interface PricingInput {
  vaoLargura: number;   // mm
  vaoAltura: number;    // mm
  vaoLarguraB?: number; // mm
  vaoAlturaB?: number;  // mm
  vaoLarguraC?: number; // mm
  vaoAlturaC?: number;  // mm
  quantity: number;
  leaves_count?: number;
  glasses_count?: number;
  panels_count?: number;
  sides_count?: number;
  folgaLargura?: number;
  folgaAltura?: number;
}

export interface CompositionItemInput {
  id: string;
  itemName: string;
  itemType: 'profile' | 'glass' | 'accessory' | 'component' | 'service';
  unit: string;
  imageUrl?: string | null;
  widthFormula: string | null;
  heightFormula: string | null;
  quantityFormula: string;
  piecesQuantity: number;
  side?: string | null;
  calculation_type?: 'fixed' | 'per_side' | 'per_leaf' | 'per_glass' | 'formula' | null;
  applies_to?: 'product' | 'side' | 'leaf' | 'glass' | 'panel' | null;
  piecesFormula?: string | null;
  cutAngle?: number | null;
  lossPercent: number;
  // Cost fields
  barLengthMm: number;
  weightPerMeter: number;
  costPerBar: number;
  costPerKg: number;
  costPerMeter: number;
  costPerUnit: number;
}

export interface CalculatedItem {
  id: string;
  itemName: string;
  itemType: string;
  imageUrl?: string | null;
  // Geometric results
  calculatedLength: number;       // mm for profiles, m² for glass
  calculatedWidth: number;        // mm (glass only)
  calculatedHeight: number;       // mm (glass only)
  piecesQuantity: number;
  totalPieces: number;            // pieces * qty
  // Composition results
  consumoTotal: number;           // total consumption in base unit
  consumoUnit: string;            // mm, m², un
  displayMeasure: string;         // human readable
  // Financial results
  unitCost: number;               // cost per base unit used
  subtotalCost: number;           // before loss
  lossPercent: number;
  lossCost: number;
  totalCost: number;              // after loss
  formula: string;                // formula used (for memory)
}

export interface IndirectCosts {
  laborCost: number;
  packagingCost: number;
  installationCost: number;
  transportCost: number;
  commissionCost: number;
  taxCost: number;
  adminFee: number;
  totalIndirect: number;
}

export interface PricingResult {
  // Level 1: Geometric
  areaM2: number;
  
  // Level 2: Composition
  items: CalculatedItem[];
  costByType: Record<string, number>;
  
  // Level 3: Financial
  directCost: number;
  totalLossCost: number;
  costWithLosses: number;
  indirectCosts: IndirectCosts;
  totalCost: number;
  marginType: MarginType;
  marginPercent: number;
  marginValue: number;
  priceBeforeRounding: number;
  finalPrice: number;
  costPerSqm: number;
  pricePerSqm: number;
  profitPerUnit: number;
}

// ─── Engine ──────────────────────────────────────────────────

/**
 * Calculate the cost of a single component
 */
function calculateItemCost(
  item: CompositionItemInput,
  input: PricingInput,
  folgaCtx: FormulaContext,
  side?: string | null,
): CalculatedItem {
  // Determine multiplier based on calculation_type
  let multiplier = 1;
  const calcType = item.calculation_type || 'formula';
  
  if (calcType === 'per_side') {
    multiplier = input.sides_count || 1;
  } else if (calcType === 'per_leaf') {
    multiplier = input.leaves_count || 1;
  } else if (calcType === 'per_glass') {
    multiplier = input.glasses_count || 1;
  } else if (calcType === 'fixed') {
    multiplier = 1; // Explicitly 1 for fixed
  }

  const piecesQty = (item.piecesFormula 
    ? evaluateFormula(item.piecesFormula, folgaCtx, undefined, side)
    : (item.piecesQuantity || 1)) * multiplier;
    
  const totalPieces = piecesQty * input.quantity;
  
  let calculatedLength = 0;
  let calculatedWidth = 0;
  let calculatedHeight = 0;
  let consumoTotal = 0;
  let consumoUnit = 'un';
  let displayMeasure = '';
  let unitCost = 0;
  let subtotalCost = 0;
  let formulaUsed = item.quantityFormula || '1';

  if (item.itemType === 'glass') {
    // Glass: calculate area in m²
    const calcW = evaluateFormula(item.widthFormula || 'Largura', folgaCtx, undefined, side);
    const calcH = evaluateFormula(item.heightFormula || 'Altura', folgaCtx, undefined, side);
    calculatedWidth = calcW;
    calculatedHeight = calcH;
    const areaM2 = (calcW * calcH) / 1_000_000;
    calculatedLength = areaM2;
    consumoTotal = areaM2 * piecesQty;
    consumoUnit = 'm²';
    unitCost = item.costPerMeter || 0; // cost per m² for glass
    subtotalCost = unitCost * consumoTotal * input.quantity;
    displayMeasure = `${piecesQty} × (${calcW.toFixed(0)} × ${calcH.toFixed(0)} mm) = ${(consumoTotal).toFixed(4)} m²`;
    formulaUsed = `${item.widthFormula || 'L'} × ${item.heightFormula || 'A'}`;
    
  } else if (item.itemType === 'profile') {
    // Profile: calculate length in mm
    const length = item.heightFormula
      ? evaluateFormula(item.heightFormula, folgaCtx, undefined, side)
      : item.widthFormula
        ? evaluateFormula(item.widthFormula, folgaCtx, undefined, side)
        : evaluateFormula(item.quantityFormula, folgaCtx, undefined, side);
    
    calculatedLength = length;
    consumoTotal = length * piecesQty; // total mm
    consumoUnit = 'mm';
    
    // Cost per mm from bar cost
    const barLengthMm = item.barLengthMm || 6000;
    const costPerMm = item.costPerBar > 0 
      ? item.costPerBar / barLengthMm 
      : (item.costPerMeter || 0) / 1000;
    
    unitCost = costPerMm;
    subtotalCost = costPerMm * consumoTotal * input.quantity;
    displayMeasure = `${piecesQty} × ${length.toFixed(0)} mm = ${consumoTotal.toFixed(0)} mm`;
    formulaUsed = item.heightFormula || item.widthFormula || item.quantityFormula;
    
    // If cost is by kg, recalculate
    if (item.costPerKg > 0 && item.weightPerMeter > 0) {
      const lengthM = consumoTotal / 1000;
      const weightKg = item.weightPerMeter * lengthM;
      unitCost = item.costPerKg;
      subtotalCost = item.costPerKg * weightKg * input.quantity;
      displayMeasure += ` (${weightKg.toFixed(3)} kg)`;
    }
    
  } else {
    // Accessories, components, services: by unit
    consumoTotal = piecesQty;
    consumoUnit = item.unit || 'un';
    unitCost = item.costPerUnit || item.costPerBar || 0;
    subtotalCost = unitCost * consumoTotal * input.quantity;
    displayMeasure = `${consumoTotal} ${consumoUnit}`;
    formulaUsed = `${piecesQty} ${consumoUnit}`;
  }

  const lossPercent = item.lossPercent || 0;
  const lossCost = subtotalCost * (lossPercent / 100);
  const totalCost = subtotalCost + lossCost;

  return {
    id: item.id,
    itemName: item.itemName,
    itemType: item.itemType,
    imageUrl: item.imageUrl,
    calculatedLength,
    calculatedWidth,
    calculatedHeight,
    piecesQuantity: piecesQty,
    totalPieces,
    consumoTotal,
    consumoUnit,
    displayMeasure,
    unitCost,
    subtotalCost,
    lossPercent,
    lossCost,
    totalCost,
    formula: formulaUsed,
  };
}

/**
 * Calculate indirect costs
 */
function calculateIndirectCosts(
  policy: PricingPolicy,
  areaM2: number,
  quantity: number,
  directCostWithLosses: number,
): IndirectCosts {
  const laborCost = policy.includeLabor ? policy.laborCostPerSqm * areaM2 * quantity : 0;
  const packagingCost = policy.includePackaging ? policy.packagingCostPerUnit * quantity : 0;
  const installationCost = policy.includeInstallation ? policy.installationCostPerSqm * areaM2 * quantity : 0;
  const transportCost = policy.includeTransport ? policy.transportCostPerUnit * quantity : 0;
  const commissionCost = policy.includeCommission ? directCostWithLosses * (policy.commissionPercent / 100) : 0;
  const taxCost = policy.includeTax ? directCostWithLosses * (policy.taxPercent / 100) : 0;
  const adminFee = policy.adminFee * quantity;
  
  const totalIndirect = laborCost + packagingCost + installationCost + transportCost + commissionCost + taxCost + adminFee;

  return { laborCost, packagingCost, installationCost, transportCost, commissionCost, taxCost, adminFee, totalIndirect };
}

/**
 * Apply margin based on type
 */
function applyMargin(totalCost: number, marginPercent: number, marginType: MarginType): number {
  if (marginType === 'markup') {
    // Markup: cost represents (100 - margin)% of the final price
    const divisor = 1 - (marginPercent / 100);
    return divisor > 0 ? totalCost / divisor : totalCost;
  }
  // Simple: add margin on top of cost
  return totalCost * (1 + marginPercent / 100);
}

/**
 * Apply rounding
 */
function applyRounding(value: number, mode: RoundingMode, decimals: number): number {
  const factor = Math.pow(10, decimals);
  switch (mode) {
    case 'ceil': return Math.ceil(value * factor) / factor;
    case 'floor': return Math.floor(value * factor) / factor;
    case 'round': return Math.round(value * factor) / factor;
    default: return value;
  }
}

/**
 * Main pricing engine function
 * Executes the 3-layer calculation pipeline
 */
export function calculatePricing(
  compositionItems: CompositionItemInput[],
  input: PricingInput,
  policy: PricingPolicy,
  marginOverride?: number,
): PricingResult {
  const margin = marginOverride ?? policy.defaultMargin;
  
  // ─── Level 1: Geometric ───
  const areaM2 = (input.vaoLargura * input.vaoAltura) / 1_000_000;
  
  const folgaCtx: FormulaContext = {
    width: input.vaoLargura,
    height: input.vaoAltura,
    folgaLargura: input.folgaLargura ?? 0,
    folgaAltura: input.folgaAltura ?? 0,
    widthB: input.vaoLarguraB,
    heightB: input.vaoAlturaB,
  };

  // ─── Level 2: Composition ───
  const items = compositionItems.map(item => {
    // If side is 'Todos' or 'Produto', treat as null side (global product item)
    // for dimension context but ensure it doesn't duplicate.
    const effectiveSide = (item.side === 'Todos' || item.side === 'Produto') ? null : item.side;
    return calculateItemCost(item, input, folgaCtx, effectiveSide);
  });
  
  const costByType: Record<string, number> = {};
  items.forEach(item => {
    costByType[item.itemType] = (costByType[item.itemType] || 0) + item.totalCost;
  });

  const directCost = items.reduce((sum, i) => sum + i.subtotalCost, 0);
  const totalLossCost = items.reduce((sum, i) => sum + i.lossCost, 0);
  const costWithLosses = directCost + totalLossCost;

  // ─── Level 3: Financial ───
  const indirectCosts = calculateIndirectCosts(policy, areaM2, input.quantity, costWithLosses);
  const totalCost = costWithLosses + indirectCosts.totalIndirect;
  
  const priceBeforeRounding = applyMargin(totalCost, margin, policy.marginType);
  const finalPrice = applyRounding(priceBeforeRounding, policy.roundingMode, policy.priceDecimals);
  
  const marginValue = finalPrice - totalCost;
  const costPerSqm = areaM2 > 0 ? totalCost / (areaM2 * input.quantity) : 0;
  const pricePerSqm = areaM2 > 0 ? finalPrice / (areaM2 * input.quantity) : 0;
  const profitPerUnit = input.quantity > 0 ? marginValue / input.quantity : 0;

  return {
    areaM2,
    items,
    costByType,
    directCost,
    totalLossCost,
    costWithLosses,
    indirectCosts,
    totalCost,
    marginType: policy.marginType,
    marginPercent: margin,
    marginValue,
    priceBeforeRounding,
    finalPrice,
    costPerSqm,
    pricePerSqm,
    profitPerUnit,
  };
}

/**
 * Format currency in BRL
 */
export const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
