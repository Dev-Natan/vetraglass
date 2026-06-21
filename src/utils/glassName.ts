/**
 * Formata o nome de exibição de um item de vidro (unit = m²),
 * acrescentando cor e espessura quando informadas.
 * Ex.: formatGlassName('Vidro Temperado', 'Incolor', 8) → "Vidro Temperado Incolor 8mm"
 */
export function formatGlassName(
  baseName?: string | null,
  color?: string | null,
  thicknessMm?: number | string | null,
): string {
  const name = (baseName || '').trim();
  const c = (color || '').trim();
  const t =
    thicknessMm === null || thicknessMm === undefined || thicknessMm === ''
      ? ''
      : String(thicknessMm).replace(',', '.');
  const parts = [name];
  if (c) parts.push(c);
  if (t) parts.push(`${t}mm`);
  return parts.filter(Boolean).join(' ').trim() || name || 'Item';
}

/** Retorna `true` se a unidade representa vidro (m²). */
export function isGlassUnit(unit?: string | null): boolean {
  const u = String(unit || '').toLowerCase().trim();
  return u === 'm²' || u === 'm2';
}

export const GLASS_THICKNESS_PRESETS = ['3', '4', '5', '6', '8', '10', '12', '15', '19'];
export const GLASS_COLOR_PRESETS = [
  'Incolor',
  'Verde',
  'Fumê',
  'Bronze',
  'Refletivo',
  'Opaco',
  'Azul',
  'Cinza',
];
