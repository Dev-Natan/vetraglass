/**
 * Hook for OS Cancellation Validation
 * 
 * Provides logic to check if an OS can be cancelled based on material consumption status.
 * If materials have been consumed, cancellation is blocked.
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CancellationCheck {
  canCancel: boolean;
  reason?: string;
  consumedCount?: number;
  pendingCount?: number;
  availableCount?: number;
}

export function useOSCancellation() {
  const [isChecking, setIsChecking] = useState(false);

  const checkCanCancel = async (osId: string): Promise<CancellationCheck> => {
    setIsChecking(true);
    try {
      const { data: consumption, error } = await supabase
        .from('material_consumption')
        .select('status')
        .eq('ordem_servico_id', osId);

      if (error) {
        console.error('Error checking consumption status:', error);
        return {
          canCancel: false,
          reason: 'Erro ao verificar status dos materiais',
        };
      }

      if (!consumption || consumption.length === 0) {
        return { canCancel: true };
      }

      const consumedCount = consumption.filter(c => c.status === 'consumed').length;
      const pendingCount = consumption.filter(c => c.status === 'pending').length;
      const availableCount = consumption.filter(c => c.status === 'available').length;

      if (consumedCount > 0) {
        return {
          canCancel: false,
          reason: `Esta OS já teve ${consumedCount} material(is) consumido(s) do estoque. Para cancelar, é necessário fazer estorno manual dos materiais.`,
          consumedCount,
          pendingCount,
          availableCount,
        };
      }

      return {
        canCancel: true,
        consumedCount: 0,
        pendingCount,
        availableCount,
      };
    } catch (err) {
      console.error('Error in checkCanCancel:', err);
      return {
        canCancel: false,
        reason: 'Erro inesperado ao verificar status',
      };
    } finally {
      setIsChecking(false);
    }
  };

  const cancelOS = async (
    osId: string, 
    onSuccess?: () => void,
    onBlocked?: (reason: string) => void
  ) => {
    const check = await checkCanCancel(osId);
    
    if (!check.canCancel) {
      toast.error(check.reason || 'Não é possível cancelar esta OS');
      onBlocked?.(check.reason || 'Bloqueado');
      return false;
    }

    try {
      // Call the RPC which now handles consumed check and reservation cleanup
      const { data, error: rpcError } = await supabase.rpc('cancel_os_materials', {
        _ordem_servico_id: osId,
      });

      if (rpcError) {
        // RPC raises exception if consumed materials exist
        if (rpcError.message.includes('materiais já foram consumidos')) {
          toast.error('Cancelamento bloqueado: materiais já consumidos do estoque');
          onBlocked?.('Materiais já consumidos');
          return false;
        }
        throw rpcError;
      }

      onSuccess?.();
      return true;
    } catch (err: unknown) {
      console.error('Error cancelling OS materials:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar materiais';
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    checkCanCancel,
    cancelOS,
    isChecking,
  };
}
