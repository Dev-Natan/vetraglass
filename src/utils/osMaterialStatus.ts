export interface OsMaterialOperationalState {
  lifecycle_status?: string | null;
  status: string | null;
  reserved: number | null;
  missing: number | null;
  in_purchase?: number | null;
  received?: number | null;
}

export type OsMaterialSituation =
  | 'Atendido'
  | 'Parcial'
  | 'Comprar'
  | 'Em compra'
  | 'Recebimento parcial'
  | 'Consumido'
  | 'Cancelado';

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const unitLabels: Record<string, string> = {
  M: 'm',
  M2: 'm²',
  MM: 'mm',
  MM2: 'mm²',
  UNIT: 'un',
  UN: 'un',
};

export function formatOperationalQuantity(
  canonicalQuantity: number | null | undefined,
  canonicalUnit: string | null | undefined,
): string {
  const rawQuantity = Number(canonicalQuantity ?? 0);
  const rawUnit = (canonicalUnit ?? '').toUpperCase();
  if (!Number.isFinite(rawQuantity)) return `0 ${unitLabels[rawUnit] ?? canonicalUnit ?? ''}`.trim();

  const quantity = rawUnit === 'MM2'
    ? rawQuantity / 1_000_000
    : rawUnit === 'MM'
      ? rawQuantity / 1_000
      : rawQuantity;
  const displayUnit = rawUnit === 'MM2' ? 'M2' : rawUnit === 'MM' ? 'M' : rawUnit;

  return `${numberFormatter.format(quantity)} ${unitLabels[displayUnit] ?? canonicalUnit ?? ''}`.trim();
}

export function getOsMaterialSituation(row: OsMaterialOperationalState): OsMaterialSituation {
  if (row.lifecycle_status === 'CANCELLED') return 'Cancelado';
  if (row.lifecycle_status === 'COMPLETED') return 'Consumido';

  const missing = Number(row.missing ?? 0);
  const reserved = Number(row.reserved ?? 0);
  const inPurchase = Number(row.in_purchase ?? 0);
  const received = Number(row.received ?? 0);

  if (missing <= 0 || row.status === 'SUPPLIED') return 'Atendido';
  if (inPurchase > 0 && received > 0) return 'Recebimento parcial';
  if (inPurchase > 0) return 'Em compra';
  if (received > 0) return 'Recebimento parcial';
  if (reserved > 0) return 'Parcial';
  return 'Comprar';
}

export type CanonicalMaterialType = 'profile' | 'glass' | 'accessory';

export interface OsMaterialPresentationInput {
  id?: string;
  company_item_id?: string | null;
  item_template_id?: string | null;
  variant_id?: string | null;
  item_name: string;
  item_type?: string | null;
  unit?: string | null;
  required_quantity?: number | null;
  bar_length_mm?: number | null;
  notes?: string | null;
}

export interface ConsolidatedOsMaterial {
  key: string;
  item_name: string;
  item_type: CanonicalMaterialType;
  canonical_unit: string;
  required_canonical_quantity: number;
  bar_length_mm: number | null;
  bars_needed: number | null;
  theoretical_waste_mm: number | null;
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function resolveCanonicalMaterialType(
  itemType: string | null | undefined,
  unit: string | null | undefined,
): CanonicalMaterialType {
  const normalizedType = (itemType ?? '').trim().toLowerCase();
  const normalizedUnit = (unit ?? '').trim().toUpperCase().replace('²', '2');
  if (normalizedType === 'profile' || normalizedType === 'perfil') return 'profile';
  if (normalizedType === 'glass' || normalizedType === 'vidro' || normalizedUnit === 'M2') return 'glass';
  return 'accessory';
}

export function materialTypeLabel(type: CanonicalMaterialType): string {
  if (type === 'profile') return 'Perfil';
  if (type === 'glass') return 'Vidro';
  return 'Acessório';
}

export function canonicalMaterialQuantity(
  quantity: number | null | undefined,
  sourceUnit: string | null | undefined,
  type: CanonicalMaterialType,
): { quantity: number; unit: string } {
  const safeQuantity = finiteNumber(quantity) ?? 0;
  const unit = (sourceUnit ?? '').trim().toUpperCase().replace('²', '2');

  if (type === 'profile') {
    return { quantity: unit === 'MM' ? safeQuantity : safeQuantity * 1_000, unit: 'MM' };
  }
  if (type === 'glass') {
    return { quantity: unit === 'MM2' ? safeQuantity : safeQuantity * 1_000_000, unit: 'MM2' };
  }
  return { quantity: safeQuantity, unit: unit === 'UN' ? 'UNIT' : unit || 'UNIT' };
}

export function basicProfilePurchasePlan(
  requiredLengthMm: number | null | undefined,
  barLengthMm: number | null | undefined,
): { barsNeeded: number; theoreticalWasteMm: number } | null {
  const required = finiteNumber(requiredLengthMm);
  const bar = finiteNumber(barLengthMm);
  if (required == null || required <= 0 || bar == null || bar <= 0) return null;
  const barsNeeded = Math.ceil(required / bar);
  return {
    barsNeeded,
    theoreticalWasteMm: Math.max(0, barsNeeded * bar - required),
  };
}

export function consolidateOsMaterials(
  materials: OsMaterialPresentationInput[],
): ConsolidatedOsMaterial[] {
  const groups = new Map<string, ConsolidatedOsMaterial>();

  for (const material of materials) {
    const type = resolveCanonicalMaterialType(material.item_type, material.unit);
    const canonical = canonicalMaterialQuantity(material.required_quantity, material.unit, type);
    const identity = material.company_item_id ?? material.item_template_id ?? material.item_name;
    const key = `${identity}:${material.variant_id ?? 'default'}:${canonical.unit}`;
    const current = groups.get(key);

    if (current) {
      current.required_canonical_quantity += canonical.quantity;
      continue;
    }

    groups.set(key, {
      key,
      item_name: material.item_name,
      item_type: type,
      canonical_unit: canonical.unit,
      required_canonical_quantity: canonical.quantity,
      bar_length_mm: type === 'profile' ? finiteNumber(material.bar_length_mm) : null,
      bars_needed: null,
      theoretical_waste_mm: null,
    });
  }

  return Array.from(groups.values()).map((group) => {
    if (group.item_type !== 'profile') return group;
    const plan = basicProfilePurchasePlan(group.required_canonical_quantity, group.bar_length_mm);
    return {
      ...group,
      bars_needed: plan?.barsNeeded ?? null,
      theoretical_waste_mm: plan?.theoreticalWasteMm ?? null,
    };
  });
}

export function formatPurchaseQuantity(quantity: number, unit: string): string {
  const safeQuantity = finiteNumber(quantity) ?? 0;
  const normalizedUnit = unit.trim().toUpperCase();
  if (normalizedUnit === 'BAR') {
    return `${numberFormatter.format(safeQuantity)} ${safeQuantity === 1 ? 'barra' : 'barras'}`;
  }
  return formatOperationalQuantity(safeQuantity, normalizedUnit);
}

export interface NormalizedGlassCut {
  glassName: string;
  widthFormula: string;
  heightFormula: string;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
  isMovable?: boolean;
  panelIndex?: number;
  side?: string;
}

export function normalizeGlassCutSnapshot(value: Record<string, unknown>): NormalizedGlassCut | null {
  const width = finiteNumber(value.calculatedWidth ?? value.width_mm);
  const height = finiteNumber(value.calculatedHeight ?? value.height_mm);
  const quantity = finiteNumber(value.quantity ?? value.piece_quantity) ?? 1;
  if (width == null || height == null || width <= 0 || height <= 0 || quantity <= 0) return null;

  const storedArea = finiteNumber(value.areaM2 ?? value.piece_area_m2);
  const areaM2 = storedArea != null && storedArea > 0 ? storedArea : (width * height) / 1_000_000;

  return {
    glassName: String(value.glassName ?? value.role ?? 'Vidro'),
    widthFormula: String(value.widthFormula ?? value.width_formula ?? ''),
    heightFormula: String(value.heightFormula ?? value.height_formula ?? ''),
    calculatedWidth: width,
    calculatedHeight: height,
    areaM2,
    quantity,
    isMovable: value.isMovable === true || value.is_movable === true,
    panelIndex: finiteNumber(value.panelIndex ?? value.panel_index) ?? undefined,
    side: typeof value.side === 'string' ? value.side : undefined,
  };
}
