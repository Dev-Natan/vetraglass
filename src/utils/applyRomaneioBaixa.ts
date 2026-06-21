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

    return { success: true };
  } catch (error) {
    console.error('Erro ao aplicar baixa de romaneio:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao aplicar baixa',
    };
  }
}
