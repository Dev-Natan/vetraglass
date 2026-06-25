/**
 * Normaliza o nome de uma categoria: troca _ e - por espaço,
 * remove espaços extras e aplica Title Case.
 * Ex.: "guarda_corpo" | "GUARDA CORPO" | "Guarda-Corpo" -> "Guarda Corpo"
 */
export function normalizeCategory(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function categoriesMatch(a?: string | null, b?: string | null): boolean {
  return normalizeCategory(a) === normalizeCategory(b);
}
