import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Invalida TODAS as query keys que dependem do saldo físico canônico e do
 * agregado compatível em company_stock.
 * Chamar após qualquer mutação de entrada/saída, ajuste de saldo, criação de item
 * ou reset de estoque — garante que os badges de "Em Estoque" no Meus Preços e
 * no motor de busca de orçamentos reflitam o novo saldo imediatamente.
 */
export function useInvalidateStock() {
  const qc = useQueryClient();
  return useCallback(() => {
    // fonte primária
    qc.invalidateQueries({ queryKey: ['company-stock'] });
    qc.invalidateQueries({ queryKey: ['stock-movements'] });
    qc.invalidateQueries({ queryKey: ['stock-locations'] });
    // agregados por template usados pelos badges
    qc.invalidateQueries({ queryKey: ['stock-by-template'] });
    qc.invalidateQueries({ queryKey: ['glass-stock-by-color-thickness'] });
    qc.invalidateQueries({ queryKey: ['glass-stock-options'] });
    qc.invalidateQueries({ queryKey: ['products-profile-stock'] });
    // cadastro/pricing
    qc.invalidateQueries({ queryKey: ['stock-pricing'] });
    qc.invalidateQueries({ queryKey: ['company-items'] });
  }, [qc]);
}
