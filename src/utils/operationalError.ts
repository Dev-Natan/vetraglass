const OPERATIONAL_ERRORS: Record<string, string> = {
  APPROVED_QUOTE_IS_IMMUTABLE: 'Orçamentos aprovados não podem mais ser alterados.',
  CLIENT_COMPANY_MISMATCH: 'O cliente selecionado pertence a outra empresa.',
  FORBIDDEN_COMPANY_SCOPE: 'Você não tem permissão para operar nesta empresa.',
  INSUFFICIENT_STOCK: 'Estoque disponível insuficiente para concluir a operação.',
  INVALID_UNIT: 'A unidade informada não está habilitada para este item.',
  MISSING_CONVERSION: 'Configure a conversão física deste item antes de movimentá-lo.',
  INVALID_CONVERSION: 'O fator de conversão informado não corresponde ao contrato físico do item.',
  UNCLASSIFIED_ITEM: 'Classifique o tipo físico do item antes de movimentá-lo.',
  MISSING_LOCATION: 'Selecione uma localização física válida para esta movimentação.',
  VARIANT_STOCK_MISMATCH: 'A variante selecionada não pertence a este item ou empresa.',
  INVALID_DIMENSIONS: 'Informe dimensões físicas válidas para a chapa ou peça.',
  AMBIGUOUS_LEGACY_STOCK: 'O saldo legado deste item precisa de revisão antes de novas movimentações.',
  MISSING_COMPANY_ITEM: 'Um material da engenharia não está cadastrado nesta empresa.',
  MISSING_COST: 'Um material está sem custo configurado.',
  MISSING_PRICE: 'Um material está sem preço configurado.',
  MISSING_PRICE_VARIANT: 'A variante comercial selecionada não possui preço configurado.',
  MISSING_STOCK: 'Um material não possui registro de estoque ativo.',
  INVALID_PRICING_SNAPSHOT: 'A precificação mudou ou o snapshot não corresponde ao produto. Recalcule o item.',
  PURCHASE_REQUIRED: 'A operação depende do recebimento de uma compra dedicada.',
  QUOTE_ITEMS_REQUIRED: 'Adicione ao menos um item ao orçamento.',
  QUOTE_ITEMS_TOTAL_MISMATCH: 'A soma dos itens difere do total do orçamento.',
  QUOTE_TOTALS_MISMATCH: 'Os totais e o desconto do orçamento estão inconsistentes.',
  SNAPSHOT_INPUTS_MISMATCH: 'As medidas informadas diferem do snapshot de engenharia.',
  SNAPSHOT_MISSING: 'O snapshot de engenharia não foi gerado.',
};

export function operationalErrorMessage(error: unknown, fallback: string): string {
  const candidate = typeof error === 'object' && error !== null
    ? error as { message?: unknown; details?: unknown }
    : null;
  const raw = error instanceof Error
    ? error.message
    : candidate?.message != null ? String(candidate.message) : String(error ?? '');
  const details = candidate?.details != null && String(candidate.details).trim()
    ? String(candidate.details).trim()
    : '';
  const code = Object.keys(OPERATIONAL_ERRORS).find((candidate) => raw.includes(candidate));
  const message = code ? OPERATIONAL_ERRORS[code] : raw || fallback;
  return details ? `${message} Detalhe: ${details}.` : message;
}
