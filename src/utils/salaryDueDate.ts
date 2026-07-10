/**
 * Utilidades para geração de despesas de salário.
 */

/**
 * Calcula a data de vencimento do salário para um mês/ano,
 * ajustando quando o dia informado excede o último dia do mês.
 */
export function computeSalaryDueDate(year: number, monthIndex0: number, paymentDay: number): Date {
  const day = Math.max(1, Math.min(31, Math.floor(paymentDay || 5)));
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  return new Date(year, monthIndex0, Math.min(day, lastDay));
}

/**
 * Retorna a próxima data de vencimento a partir de "hoje",
 * levando em consideração se o dia do mês corrente já passou.
 * Se `admissionDate` for informada e for futura, usa o mês/ano da admissão.
 */
export function getNextSalaryDueDate(paymentDay: number, admissionDate?: Date | null): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let baseYear = today.getFullYear();
  let baseMonth = today.getMonth();

  if (admissionDate) {
    const adm = new Date(admissionDate);
    adm.setHours(0, 0, 0, 0);
    if (adm.getTime() > today.getTime()) {
      baseYear = adm.getFullYear();
      baseMonth = adm.getMonth();
    }
  }

  const dueThisMonth = computeSalaryDueDate(baseYear, baseMonth, paymentDay);

  // Se já passou o dia do mês corrente e não estamos em admissão futura, gera para o próximo mês.
  if (dueThisMonth < today && (!admissionDate || new Date(admissionDate) <= today)) {
    return computeSalaryDueDate(baseYear, baseMonth + 1, paymentDay);
  }
  return dueThisMonth;
}

export function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}
