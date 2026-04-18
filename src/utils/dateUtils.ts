/**
 * Get a time-based greeting for the current time.
 */
export const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

/**
 * Format a currency value to BRL.
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Format a date string to a localized date.
 */
export const formatDate = (date: string | Date, formatStr: string = 'dd/MM/yyyy'): string => {
  const { format } = require('date-fns');
  const { ptBR } = require('date-fns/locale/pt-BR');
  return format(new Date(date), formatStr, { locale: ptBR });
};
