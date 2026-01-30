import { supabase } from '@/integrations/supabase/client';

export type StockEntryCategory = 
  | 'compra_fornecedor' 
  | 'devolucao_cliente' 
  | 'ajuste_inventario' 
  | 'transferencia'
  | 'producao_sobra';

export type StockExitCategory = 
  | 'venda' 
  | 'uso_interno' 
  | 'perda' 
  | 'devolucao_fornecedor' 
  | 'consumo_producao'
  | 'ajuste_inventario';

export type ReferenceType = 'purchase_order' | 'sale' | 'ordem_servico' | 'manual' | 'expense';

interface StockMovementParams {
  companyId: string;
  itemTemplateId: string;
  companyItemId?: string;
  quantity: number;
  description?: string;
  referenceId?: string;
  referenceType?: ReferenceType;
  unitCost?: number;
  valorFinanceiro?: number;
}

interface StockEntryParams extends StockMovementParams {
  category: StockEntryCategory;
}

interface StockExitParams extends StockMovementParams {
  category: StockExitCategory;
}

interface StockMovementResult {
  success: boolean;
  newQuantity: number;
  stockId?: string;
  movementId?: string;
  error?: string;
}

/**
 * Busca estoque existente para o item.
 * REGRA DE OURO: Não cria estoque automaticamente - isso viola o controle rigoroso.
 * O estoque deve ser cadastrado manualmente pelo usuário antes de qualquer movimentação.
 */
export async function getExistingStock(
  companyId: string,
  itemTemplateId: string
): Promise<{ stockId: string; currentQuantity: number } | null> {
  const { data: existingStock } = await supabase
    .from('company_stock')
    .select('id, quantity')
    .eq('company_id', companyId)
    .eq('item_template_id', itemTemplateId)
    .maybeSingle();

  if (!existingStock) {
    return null;
  }

  return { 
    stockId: existingStock.id, 
    currentQuantity: existingStock.quantity 
  };
}

/**
 * @deprecated Use getExistingStock instead. 
 * Esta função agora apenas busca estoque existente e NÃO cria automaticamente.
 * Mantida para compatibilidade, mas lança erro se o estoque não existir.
 */
export async function ensureStockExists(
  companyId: string,
  itemTemplateId: string,
  companyItemId?: string,
  initialQuantity: number = 0
): Promise<{ stockId: string; currentQuantity: number }> {
  const existing = await getExistingStock(companyId, itemTemplateId);
  
  if (!existing) {
    throw new Error(
      'Item não cadastrado no estoque. Cadastre-o primeiro em Estoque > Adicionar Item antes de registrar movimentações.'
    );
  }

  return existing;
}

/**
 * Busca o company_item_id correspondente ao item_template_id
 */
async function getCompanyItemId(
  companyId: string, 
  itemTemplateId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('company_items')
    .select('id')
    .eq('company_id', companyId)
    .eq('item_template_id', itemTemplateId)
    .maybeSingle();
  
  return data?.id || null;
}

/**
 * Verifica se já existe um movimento com a mesma referência (evita duplicados)
 */
async function checkDuplicateMovement(
  companyId: string,
  itemTemplateId: string,
  referenceId: string,
  referenceType: string
): Promise<boolean> {
  const { data } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('company_id', companyId)
    .eq('item_template_id', itemTemplateId)
    .eq('reference_id', referenceId)
    .eq('reference_type', referenceType)
    .maybeSingle();
  
  return !!data;
}

/**
 * Registra uma entrada de estoque (compra, devolução, ajuste positivo)
 * REGRA DE OURO: Falha se o item não estiver cadastrado no estoque.
 * O usuário deve cadastrar o item manualmente antes de registrar entradas.
 */
export async function registerStockEntry(
  params: StockEntryParams
): Promise<StockMovementResult> {
  const { 
    companyId, 
    itemTemplateId, 
    companyItemId,
    quantity, 
    category, 
    description, 
    referenceId,
    referenceType = 'manual'
  } = params;

  try {
    // Verificar duplicatas se tiver referência
    if (referenceId && referenceType) {
      const isDuplicate = await checkDuplicateMovement(
        companyId, 
        itemTemplateId, 
        referenceId, 
        referenceType
      );
      if (isDuplicate) {
        console.warn(`Movimento duplicado ignorado: ${referenceType}/${referenceId}`);
        return { 
          success: true, 
          newQuantity: 0, 
          error: 'Movimento já registrado anteriormente' 
        };
      }
    }

    // REGRA DE OURO: Buscar estoque existente - NÃO criar automaticamente
    const existingStock = await getExistingStock(companyId, itemTemplateId);
    
    if (!existingStock) {
      return {
        success: false,
        newQuantity: 0,
        error: 'Item não cadastrado no estoque. Cadastre-o primeiro em Estoque > Adicionar Item antes de registrar movimentações.',
      };
    }

    const { stockId, currentQuantity } = existingStock;
    const resolvedCompanyItemId = companyItemId || await getCompanyItemId(companyId, itemTemplateId);

    const newQuantity = currentQuantity + quantity;

    // Atualizar quantidade no estoque
    const { error: updateError } = await supabase
      .from('company_stock')
      .update({ 
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', stockId);

    if (updateError) throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);

    // Registrar movimento com custo
    const unitCost = params.unitCost || 0;
    const valorFinanceiro = params.valorFinanceiro || (quantity * unitCost);
    
    const { data: movement, error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        company_id: companyId,
        item_template_id: itemTemplateId,
        company_item_id: resolvedCompanyItemId,
        type: 'entrada',
        category,
        quantity,
        description: description || `Entrada: ${category}`,
        reference_id: referenceId,
        reference_type: referenceType,
        unit_cost: unitCost,
        valor_financeiro: valorFinanceiro,
      })
      .select('id')
      .single();

    if (movementError) {
      console.error('Erro ao registrar movimento:', movementError);
      // Não falha a operação, apenas loga
    }

    return {
      success: true,
      newQuantity,
      stockId,
      movementId: movement?.id,
    };
  } catch (error: any) {
    console.error('Erro em registerStockEntry:', error);
    return {
      success: false,
      newQuantity: 0,
      error: error.message,
    };
  }
}

/**
 * Registra uma saída de estoque (venda, consumo, perda, devolução)
 */
export async function registerStockExit(
  params: StockExitParams
): Promise<StockMovementResult> {
  const { 
    companyId, 
    itemTemplateId,
    companyItemId,
    quantity, 
    category, 
    description, 
    referenceId,
    referenceType = 'manual'
  } = params;

  try {
    // Verificar duplicatas se tiver referência
    if (referenceId && referenceType) {
      const isDuplicate = await checkDuplicateMovement(
        companyId, 
        itemTemplateId, 
        referenceId, 
        referenceType
      );
      if (isDuplicate) {
        console.warn(`Movimento duplicado ignorado: ${referenceType}/${referenceId}`);
        return { 
          success: true, 
          newQuantity: 0, 
          error: 'Movimento já registrado anteriormente' 
        };
      }
    }

    // Buscar estoque atual
    const resolvedCompanyItemId = companyItemId || await getCompanyItemId(companyId, itemTemplateId);
    const { data: stock } = await supabase
      .from('company_stock')
      .select('id, quantity')
      .eq('company_id', companyId)
      .eq('item_template_id', itemTemplateId)
      .maybeSingle();

    if (!stock) {
      return {
        success: false,
        newQuantity: 0,
        error: 'Item não encontrado no estoque',
      };
    }

    const newQuantity = Math.max(0, stock.quantity - quantity);

    // Atualizar quantidade no estoque
    const { error: updateError } = await supabase
      .from('company_stock')
      .update({ 
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', stock.id);

    if (updateError) throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);

    // Registrar movimento
    const { data: movement, error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        company_id: companyId,
        item_template_id: itemTemplateId,
        company_item_id: resolvedCompanyItemId,
        type: 'saida',
        category,
        quantity,
        description: description || `Saída: ${category}`,
        reference_id: referenceId,
        reference_type: referenceType,
      })
      .select('id')
      .single();

    if (movementError) {
      console.error('Erro ao registrar movimento:', movementError);
    }

    return {
      success: true,
      newQuantity,
      stockId: stock.id,
      movementId: movement?.id,
    };
  } catch (error: any) {
    console.error('Erro em registerStockExit:', error);
    return {
      success: false,
      newQuantity: 0,
      error: error.message,
    };
  }
}

/**
 * Registra entrada de múltiplos itens em batch (ex: recebimento de pedido de compra)
 */
export async function registerBatchStockEntry(
  companyId: string,
  items: Array<{
    itemTemplateId: string;
    companyItemId?: string;
    quantity: number;
    description?: string;
  }>,
  category: StockEntryCategory,
  referenceId: string,
  referenceType: ReferenceType
): Promise<{ success: boolean; results: StockMovementResult[] }> {
  const results: StockMovementResult[] = [];
  
  for (const item of items) {
    const result = await registerStockEntry({
      companyId,
      itemTemplateId: item.itemTemplateId,
      companyItemId: item.companyItemId,
      quantity: item.quantity,
      category,
      description: item.description,
      referenceId,
      referenceType,
    });
    results.push(result);
  }
  
  const allSuccess = results.every(r => r.success);
  return { success: allSuccess, results };
}

/**
 * Formata referência para exibição no histórico
 */
export function formatMovementReference(
  referenceType: string | null, 
  referenceId: string | null
): { label: string; badgeVariant: 'default' | 'secondary' | 'outline' } | null {
  if (!referenceType || !referenceId) {
    return { label: 'Manual', badgeVariant: 'outline' };
  }

  switch (referenceType) {
    case 'purchase_order':
      return { label: 'Compra', badgeVariant: 'default' };
    case 'sale':
      return { label: 'Venda', badgeVariant: 'secondary' };
    case 'ordem_servico':
      return { label: 'Produção', badgeVariant: 'default' };
    case 'manual':
      return { label: 'Manual', badgeVariant: 'outline' };
    default:
      return { label: referenceType, badgeVariant: 'outline' };
  }
}
