import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSystemSettings() {
  const queryClient = useQueryClient();

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('key, value');

      if (error) {
        // Se a tabela ainda não existir ou falhar, fallback gracioso
        console.warn('Could not fetch system settings, using defaults:', error.message);
        return { allow_new_signups: true };
      }

      const map: Record<string, any> = {};
      (data as any[])?.forEach((row) => {
        map[row.key] = row.value;
      });

      return map;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from('system_settings' as any)
        .upsert(
          {
            key,
            value,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'key' }
        );

      if (error) throw error;
    },
    onSuccess: (_, { key }) => {
      toast.success(`Configuração "${key}" atualizada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar configuração: ${err.message}`);
    },
  });

  const allowNewSignups = settings.allow_new_signups !== false;

  return {
    settings,
    isLoading,
    allowNewSignups,
    updateSetting: updateSettingMutation.mutateAsync,
    isUpdating: updateSettingMutation.isPending,
  };
}
