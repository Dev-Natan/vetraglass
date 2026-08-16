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
  ordemServicoId,
  lines,
  cancelledConsumptionIds,
}: ApplyRomaneioParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('complete_os_production', {
      _ordem_servico_id: ordemServicoId,
      _lines: lines.map((line) => ({
        consumption_id: line.consumptionId,
        company_item_id: line.companyItemId,
        quantity: line.quantity,
      })),
      _cancelled_consumption_ids: cancelledConsumptionIds,
    });

    if (error) throw error;

    const result = data as { success?: boolean } | null;
    if (!result?.success) {
      throw new Error('A baixa transacional não foi confirmada');
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
