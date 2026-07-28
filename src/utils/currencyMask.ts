/**
 * Máscara de moeda BRL para inputs de texto.
 * Aceita digitação de centavos da direita para a esquerda (estilo calculadora).
 */

/** Converte string de input (qualquer formato) para número. */
export function parseBRLInput(value: string): number {
  if (!value) return 0;
  // Remove tudo que não for dígito
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  // Últimos 2 dígitos = centavos
  return parseInt(digits, 10) / 100;
}

/** Formata número como string BRL sem o símbolo R$ (ex: "1.234,56"). */
export function formatBRLInput(value: number): string {
  if (!value || isNaN(value)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Converte string de moeda BRL para número, tratando todos os formatos comuns.
 * - "5.248,50" (pt-BR com milhar e decimal) → 5248.50
 * - "5248,50"  (só vírgula decimal)         → 5248.50
 * - "5248.50"  (ponto decimal en-US)        → 5248.50
 * - "5.248"    (milhar sem decimal)         → 5248
 * - "R$ 1.234,56" (com símbolo/espaços)     → 1234.56
 */
export function brlStringToNumber(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  // Mantém apenas dígitos, pontos, vírgulas e sinal
  let s = String(value).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // Ambos: ponto é milhar, vírgula é decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Só vírgula: decimal
    s = s.replace(',', '.');
  } else if (hasDot) {
    // Só ponto: pode ser milhar (ex: "5.248") ou decimal (ex: "5248.50")
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 2 || (parts.length === 2 && last.length === 3 && parts[0].length > 0)) {
      // Múltiplos pontos OU padrão de milhar (3 dígitos após ponto) → remove
      s = parts.join('');
    }
    // Caso contrário mantém como decimal
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Alias universal para parsing de moeda BRL. */
export const parseCurrencyBRL = brlStringToNumber;

/** Pipeline completo: digitação livre -> string formatada BRL. */
export function maskBRLOnChange(rawInput: string): { display: string; numericString: string } {
  const numeric = parseBRLInput(rawInput);
  return {
    display: formatBRLInput(numeric),
    numericString: numeric.toString(),
  };
}
