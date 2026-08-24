import { supabase } from '@/integrations/supabase/client';
import { operationalErrorMessage } from '@/utils/operationalError';

/**
 * Rebuilds OS production documents from the immutable commercial snapshot.
 *
 * Phase 3G intentionally keeps this as a single backend operation. The former
 * frontend generator performed independent writes to materials, reservations
 * and purchase orders and is no longer a supported execution path.
 */
export async function regenerateOSDocuments(
  ordemServicoId: string,
  osItemId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('rebuild_os_documents_from_snapshot', {
      _ordem_servico_id: ordemServicoId,
      _os_item_id: osItemId ?? null,
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: operationalErrorMessage(error, 'Erro ao reconstruir documentos da OS.'),
    };
  }
}
