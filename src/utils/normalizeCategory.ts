/**
 * Dicionário de correções específicas (acentuação, termos compostos).
 * Chave = forma normalizada (lowercase, sem _/-), Valor = label final.
 */
const CATEGORY_OVERRIDES: Record<string, string> = {
  'divisoria': 'Divisória',
  'divisorias': 'Divisórias',
  'espelho': 'Espelho',
  'espelhos': 'Espelhos',
  'guarda corpo': 'Guarda Corpo',
  'guarda corpos': 'Guarda Corpos',
  'box': 'Box',
  'janela': 'Janela',
  'janelas': 'Janelas',
  'porta': 'Porta',
  'portas': 'Portas',
  'sacada': 'Sacada',
  'sacadas': 'Sacadas',
  'fachada': 'Fachada',
  'fachadas': 'Fachadas',
  'cobertura': 'Cobertura',
  'coberturas': 'Coberturas',
  'vidro': 'Vidro',
  'vidros': 'Vidros',
  'other': 'Outros',
  'outros': 'Outros',
};

function baseNormalize(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normaliza nome de categoria: troca _/- por espaço, Title Case e aplica
 * dicionário de acentuação (ex.: "divisoria" -> "Divisória").
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

/** Chave estável para deduplicar (ignora acento e caixa). */
export function categoryKey(raw?: string | null): string {
  return baseNormalize(raw).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function categoriesMatch(a?: string | null, b?: string | null): boolean {
  return categoryKey(a) === categoryKey(b);
}
