/**
 * Dicionário de correções específicas (acentuação, singular/plural).
 * Chave = forma normalizada (lowercase, sem _/-), Valor = label final.
 */
const CATEGORY_OVERRIDES: Record<string, string> = {
  'divisoria': 'Divisória',
  'divisorias': 'Divisória',
  'espelho': 'Espelho',
  'espelhos': 'Espelho',
  'guarda corpo': 'Guarda Corpo',
  'guarda corpos': 'Guarda Corpo',
  'box': 'Box',
  'janela': 'Janela',
  'janelas': 'Janela',
  'porta': 'Porta',
  'portas': 'Porta',
  'sacada': 'Sacada',
  'sacadas': 'Sacada',
  'fachada': 'Fachada',
  'fachadas': 'Fachada',
  'cobertura': 'Cobertura',
  'coberturas': 'Cobertura',
  'vidro': 'Vidro',
  'vidros': 'Vidro',
  'other': 'Outros',
  'outros': 'Outros',
};

/** Plural -> singular para unificação de chave (sem acento, lowercase). */
const PLURAL_TO_SINGULAR: Record<string, string> = {
  'janelas': 'janela',
  'portas': 'porta',
  'divisorias': 'divisoria',
  'espelhos': 'espelho',
  'guarda corpos': 'guarda corpo',
  'sacadas': 'sacada',
  'fachadas': 'fachada',
  'coberturas': 'cobertura',
  'vidros': 'vidro',
};

function baseNormalize(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza nome de categoria: troca _/- por espaço, Title Case e aplica
 * dicionário (acentuação + singular/plural). Ex.: "janelas" -> "Janela".
 */
export function normalizeCategory(raw?: string | null): string {
  const base = baseNormalize(raw);
  if (!base) return '';
  if (CATEGORY_OVERRIDES[base]) return CATEGORY_OVERRIDES[base];
  return base
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Chave estável para deduplicar (ignora acento, caixa e plural conhecido). */
export function categoryKey(raw?: string | null): string {
  const stripped = stripAccents(baseNormalize(raw));
  return PLURAL_TO_SINGULAR[stripped] ?? stripped;
}

export function categoriesMatch(a?: string | null, b?: string | null): boolean {
  return categoryKey(a) === categoryKey(b);
}
