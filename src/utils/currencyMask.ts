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

/** Converte string formatada BRL ("1.234,56") para número. */
export function brlStringToNumber(value: string): number {
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

/** Pipeline completo: digitação livre -> string formatada BRL. */
export function maskBRLOnChange(rawInput: string): { display: string; numericString: string } {
  const numeric = parseBRLInput(rawInput);
  return {
    display: formatBRLInput(numeric),
    numericString: numeric.toString(),
  };
}
