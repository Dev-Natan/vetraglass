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
