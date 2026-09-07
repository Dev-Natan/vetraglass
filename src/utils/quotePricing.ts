export interface PricingIssue {
  code: string;
  message: string;
  detail?: string;
}

export type SuggestionStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
export type CommercialUnit = 'M2' | 'UNIT';

export function getCompositionSuggestionNotice(status: SuggestionStatus): string | null {
  if (status === 'PARTIAL') {
    return 'Alguns componentes ainda estão sem preço. Revise o valor antes de continuar.';
  }
  if (status === 'UNAVAILABLE') {
    return 'Não foi possível calcular o preço automaticamente. Informe o valor.';
  }
  return null;
}

export function readCompositionSuggestion(snapshot?: {
  suggestion_status?: SuggestionStatus;
  suggested_unit_price?: number | null;
  totals: {
    suggested_unit_price?: number | null;
    sale_price: number | null;
  };
}) {
  const value = snapshot?.suggested_unit_price ?? snapshot?.totals.suggested_unit_price;
  const price = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  const status: SuggestionStatus = price === null ? 'UNAVAILABLE' : snapshot?.suggestion_status ?? 'UNAVAILABLE';
  return {
    price: status === 'UNAVAILABLE' ? null : price,
    status,
    message: status === 'COMPLETE'
      ? 'Preço sugerido calculado.'
      : status === 'PARTIAL'
        ? 'Preço sugerido parcialmente calculado. Existem componentes sem preço ou composição incompleta.'
        : 'Preço sugerido não disponível. Informe o preço aplicado para continuar.',
  };
}

export function calculateQuoteProductPrice({
  commercialUnit,
  appliedUnitPrice,
  areaPerItem,
  quantity,
}: {
  commercialUnit: CommercialUnit | null;
  appliedUnitPrice: number | null;
  areaPerItem: number;
  quantity: number;
}) {
  const measurePerItem = commercialUnit === 'M2'
    ? areaPerItem
    : commercialUnit === 'UNIT'
      ? 1
      : 0;
  const commercialMeasure = measurePerItem > 0 && quantity > 0
    ? measurePerItem * quantity
    : 0;
  const itemUnitPrice = appliedUnitPrice !== null && measurePerItem > 0
    ? appliedUnitPrice * measurePerItem
    : 0;

  return {
    measurePerItem,
    commercialMeasure,
    itemUnitPrice,
    productTotal: itemUnitPrice * Math.max(quantity, 0),
  };
}

export function commercialUnitLabel(unit: CommercialUnit | null): string {
  if (unit === 'M2') return 'm²';
  if (unit === 'UNIT') return 'un';
  return '';
}

function humanizeAttributeValue(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

export function describeQuotePricingError(error: unknown): PricingIssue {
  if (!error || typeof error !== 'object') {
    return { code: 'PRICE_UNAVAILABLE', message: 'Não foi possível calcular uma sugestão de preço.' };
  }
  const candidate = error as { message?: string; details?: string };
  const code = candidate.message ?? '';
  const rawDetail = candidate.details ?? '';
  const componentMatch = rawDetail.match(/^(.+?)\s*\|\s*atributos=(\{.*\})$/i);
  let friendlyDetail: string | undefined;

  if (componentMatch) {
    try {
      const attributes = JSON.parse(componentMatch[2]) as Record<string, unknown>;
      const values = Object.values(attributes)
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
        .map((value) => humanizeAttributeValue(String(value)));
      friendlyDetail = [componentMatch[1].trim(), ...values].join(' — ');
    } catch {
      friendlyDetail = componentMatch[1].trim();
    }
  }

  if (code.includes('MISSING_PRICE_VARIANT') || code.includes('PRICE_NOT_CONFIGURED')
    || code.includes('MISSING_COST') || code.includes('MISSING_PRICE') || code.includes('MISSING_VARIANT')) {
    return {
      code: code.split(':')[0] || 'PRICE_NOT_CONFIGURED',
      message: componentMatch
        ? 'Um componente ainda não possui preço configurado.'
        : 'Esta configuração ainda não possui preço automático.',
      detail: friendlyDetail,
    };
  }
  return { code: code || 'PRICE_UNAVAILABLE', message: 'Não foi possível calcular uma sugestão de preço.' };
}

export function parseAppliedQuotePrice(value: string): number | null {
  const normalized = value
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatAppliedQuotePriceInput(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function syncAppliedQuotePrice(
  currentValue: string,
  manuallyEdited: boolean,
  suggestedPrice: number | null,
): string {
  if (manuallyEdited) return currentValue;
  return suggestedPrice != null && Number.isFinite(suggestedPrice)
    ? formatAppliedQuotePriceInput(suggestedPrice)
    : '';
}
