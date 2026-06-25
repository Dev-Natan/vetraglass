/**
 * Normalização de categorias baseada no cadastro do Admin (product_categories).
 * Mantém um fallback estático mínimo para dados legados sem cadastro.
 */

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

/** Chave canônica (sem acento, lowercase, espaços simples). */
function canonicalKey(raw?: string | null): string {
  return stripAccents(baseNormalize(raw));
}

/** Fallback genérico (sem dicionário): troca _/- por espaço + Title Case. */
export function normalizeCategory(raw?: string | null): string {
  const base = baseNormalize(raw);
  if (!base) return '';
  return base
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Comparação simples (fallback) — ignora acento, caixa, _/-. */
export function categoriesMatch(a?: string | null, b?: string | null): boolean {
  return canonicalKey(a) === canonicalKey(b);
}

export interface AdminCategoryEntry {
  slug: string;
  name: string;
}

export interface CategoryNormalizer {
  /** Retorna o label oficial (Admin) ou Title Case fallback. */
  normalize: (raw?: string | null) => string;
  /** Chave estável para deduplicar/comparar. Usa o slug cadastrado quando existe. */
  key: (raw?: string | null) => string;
  /** Compara duas categorias (ex.: botão vs campo do produto). */
  match: (a?: string | null, b?: string | null) => boolean;
}

/**
 * Constrói um normalizador a partir das categorias cadastradas no Admin.
 * Para qualquer variação digitada no banco (slug, nome com/sem acento, plural
 * cadastrado como sinônimo), retorna o label e a chave canônica do Admin.
 */
export function buildCategoryNormalizer(
  categories: AdminCategoryEntry[] | undefined | null
): CategoryNormalizer {
  // canonicalKey -> { slug, name }
  const lookup = new Map<string, AdminCategoryEntry>();

  (categories ?? []).forEach((c) => {
    if (!c) return;
    const entry = { slug: c.slug, name: c.name };
    const candidates = [c.slug, c.name];
    candidates.forEach((v) => {
      const k = canonicalKey(v);
      if (k && !lookup.has(k)) lookup.set(k, entry);
    });
  });

  const resolve = (raw?: string | null) => lookup.get(canonicalKey(raw));

  return {
    normalize: (raw) => resolve(raw)?.name ?? normalizeCategory(raw),
    key: (raw) => resolve(raw)?.slug ?? canonicalKey(raw),
    match: (a, b) => {
      const ka = resolve(a)?.slug ?? canonicalKey(a);
      const kb = resolve(b)?.slug ?? canonicalKey(b);
      return ka === kb;
    },
  };
}
