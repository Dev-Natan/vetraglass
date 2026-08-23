export type EngineeringFormulaTarget = 'formula' | 'quantity_formula' | 'width_formula' | 'height_formula' | 'pieces_formula';

export type EngineeringFormulaVariable = 'L' | 'A' | 'Q' | 'FOLHAS';

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('calibration_value_invalid');
  return Number(value.toFixed(4)).toString();
};

export const buildEngineeringFormula = (
  variable: EngineeringFormulaVariable,
  adjustment: number,
  divisor = 1,
) => {
  if (!Number.isFinite(adjustment) || !Number.isFinite(divisor) || divisor <= 0) {
    throw new Error('formula_adjustment_invalid');
  }
  const adjusted = adjustment === 0
    ? variable
    : `${variable} ${adjustment > 0 ? '+' : '-'} ${formatNumber(Math.abs(adjustment))}`;
  return divisor === 1 ? adjusted : `(${adjusted}) / ${formatNumber(divisor)}`;
};

export const suggestCalibratedFormula = (input: {
  variable: Extract<EngineeringFormulaVariable, 'L' | 'A'>;
  referenceDimensionMm: number;
  measuredCutMm: number;
  divisor?: number;
}) => ({
  formula: buildEngineeringFormula(
    input.variable,
    input.measuredCutMm * (input.divisor ?? 1) - input.referenceDimensionMm,
    input.divisor ?? 1,
  ),
  adjustmentMm: Number((input.measuredCutMm * (input.divisor ?? 1) - input.referenceDimensionMm).toFixed(4)),
  technicalStatus: 'ESTIMATED' as const,
  isValidated: false,
});
