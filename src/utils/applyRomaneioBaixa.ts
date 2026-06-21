import { supabase } from '@/integrations/supabase/client';

export interface RomaneioLineFinal {
  /** material_consumption id if linha veio da sugestão (para marcar consumed). Pode ser null em itens extras. */
  consumptionId: string | null;
  companyItemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

export interface ApplyRomaneioParams {
  companyId: string;
  ordemServicoId: string;
  lines: RomaneioLineFinal[];
  /** consumption ids que o usuário excluiu da lista (marcar cancelled). */
  cancelledConsumptionIds: string[];
}

/**
 * Aplica baixa revisada de estoque ao confirmar romaneio de uma OS.
 * - Subtrai company_stock.quantity
 * - Cria stock_movements (saida / consumo_producao)
 * - Atualiza material_consumption (consumed / cancelled)
 */
export async function applyRomaneioBaixa({
  companyId,
  ordemServicoId,
  lines,
  cancelledConsumptionIds,
}: ApplyRomaneioParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // 1) Cancela as linhas removidas pelo usuário
    if (cancelledConsumptionIds.length > 0) {
      await supabase
        .from('material_consumption')
        .update({ status: 'cancelled' })
        .in('id', cancelledConsumptionIds);
    }

    // 2) Processa cada linha confirmada
    for (const line of lines) {
      if (!line.companyItemId || line.quantity <= 0) continue;

      // Busca / atualiza estoque
      const { data: stock } = await supabase
        .from('company_stock')
        .select('id, quantity')
        .eq('company_item_id', line.companyItemId)
        .maybeSingle();

      if (stock) {
        const newQty = Math.max(0, Number(stock.quantity) - line.quantity);
        await supabase
          .from('company_stock')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', stock.id);
      }

      // Registra stock_movements
      const { data: movement } = await supabase
        .from('stock_movements')
        .insert({
          company_id: companyId,
          company_item_id: line.companyItemId,
          type: 'saida',
          category: 'consumo_producao',
          quantity: line.quantity,
          unit_cost: line.unitCost || 0,
          description: `Romaneio OS - ${line.itemName}`,
          reference_id: ordemServicoId,
          reference_type: 'ordem_servico',
          created_by: userId,
        })
        .select('id')
        .single();

      // Atualiza material_consumption se origem da sugestão
      if (line.consumptionId) {
        await supabase
          .from('material_consumption')
          .update({
            status: 'consumed',
            consumed_at: new Date().toISOString(),
            stock_movement_id: movement?.id || null,
            company_item_id: line.companyItemId,
            quantity_calculated: line.quantity,
          })
          .eq('id', line.consumptionId);
      } else {
        // Item extra adicionado manualmente — cria registro de consumo já consumido
        await supabase.from('material_consumption').insert({
          company_id: companyId,
          ordem_servico_id: ordemServicoId,
          company_item_id: line.companyItemId,
          item_name: line.itemName,
          item_type: 'extra',
          unit: line.unit,
          quantity_calculated: line.quantity,
          status: 'consumed',
          consumed_at: new Date().toISOString(),
          stock_movement_id: movement?.id || null,
        });
      }
    }

    // 3) Sincroniza accounts_receivable da OS (cria se não existir; mantém se já existir)
    await syncOSReceivable(companyId, ordemServicoId, userId);

    return { success: true };
  } catch (error) {
    console.error('Erro ao aplicar baixa de romaneio:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao aplicar baixa',
    };
  }
}

/**
 * Garante que exista um accounts_receivable para a OS faturada.
 * - Se não existir: cria com base no total_amount da OS (status 'pending').
 * - Se existir: mantém status atual (controle de pagamento é externo).
 */
async function syncOSReceivable(
  companyId: string,
  ordemServicoId: string,
  userId: string | undefined,
): Promise<void> {
  // Já existe AR para essa OS?
  const { data: existing } = await supabase
    .from('accounts_receivable')
    .select('id, status')
    .eq('ordem_servico_id', ordemServicoId)
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle();

  if (existing) return; // já faturado / em cobrança

  // Busca dados da OS para criar AR
  const { data: os } = await supabase
    .from('ordens_servico')
    .select('id, os_number, customer_name, total_amount, paid_amount, quote_id, client_id, estimated_end')
    .eq('id', ordemServicoId)
    .maybeSingle();

  if (!os) return;

  const total = Number(os.total_amount || 0);
  const paid = Number(os.paid_amount || 0);
  const remaining = Math.max(0, total - paid);
  if (remaining <= 0) return; // nada a receber

  const dueDate = os.estimated_end
    ? new Date(os.estimated_end).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  await supabase.from('accounts_receivable').insert({
    company_id: companyId,
    ordem_servico_id: ordemServicoId,
    quote_id: os.quote_id || null,
    client_id: os.client_id || null,
    customer_name: os.customer_name || 'Cliente',
    description: `Faturamento OS #${String(os.os_number).padStart(4, '0')}`,
    total_amount: remaining,
    due_date: dueDate,
    status: 'pending',
    receivable_type: 'os_billing',
    created_by: userId,
  });
}
