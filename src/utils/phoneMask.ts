export function formatPhoneBR(value: string | null | undefined): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  let out = `(${digits.slice(0, 2)}`;
  if (digits.length > 2) {
    const split = digits.length > 10 ? 7 : 6;
    out += `) ${digits.slice(2, split)}`;
    if (digits.length > split) {
      out += `-${digits.slice(split, 11)}`;
    }
  }
  return out;
}
