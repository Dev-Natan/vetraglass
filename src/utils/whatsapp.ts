/**
 * Gera link do WhatsApp Web com mensagem pré-preenchida
 * @param phone - Telefone (qualquer formato)
 * @param message - Mensagem opcional
 * @returns URL do wa.me ou string vazia se inválido
 */
export function getWhatsappLink(phone: string | null | undefined, message?: string): string {
  if (!phone) return '';
  
  // Remove tudo que não é dígito
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!cleanPhone) return '';

  let fullPhone = cleanPhone;

  // Adicionar DDI Brasil (55) se estiver faltando
  // Telefone BR: 10 dígitos (fixo) ou 11 dígitos (celular)
  if (fullPhone.length === 10 || fullPhone.length === 11) {
    fullPhone = `55${fullPhone}`;
  }
  
  const encodedMessage = encodeURIComponent(message || '');
  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
}

/**
 * Abre WhatsApp em nova aba
 * @param phone - Telefone
 * @param message - Mensagem
 * @returns true se abriu, false se telefone inválido
 */
export function openWhatsapp(phone: string | null | undefined, message?: string): boolean {
  const link = getWhatsappLink(phone, message);
  if (!link) return false;

  // Em PWA / iOS Safari, window.open pode ser bloqueado.
  // Disparar um clique real em <a> tende a ser mais confiável.
  const a = document.createElement('a');
  a.href = link;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
