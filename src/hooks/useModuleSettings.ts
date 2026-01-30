import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CACHE_TIMES } from "@/lib/queryConfig";

export interface ModuleSetting {
  id: string;
  module_key: string;
  module_name: string;
  description: string | null;
  icon: string | null;
  is_enabled: boolean;
  sort_order: number;
}

export function useModuleSettings() {
  return useQuery({
    queryKey: ["system-module-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_module_settings")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      return data as ModuleSetting[];
    },
    ...CACHE_TIMES.STATIC,
  });
}

export function useModuleEnabled(moduleKey: string): boolean {
  const { data: modules } = useModuleSettings();
  
  if (!modules) return true; // Default to enabled while loading
  
  const module = modules.find(m => m.module_key === moduleKey);
  return module?.is_enabled ?? true;
}

export function useEnabledModulesMap(): Record<string, boolean> {
  const { data: modules } = useModuleSettings();
  
  if (!modules) return {};
  
  return modules.reduce((acc, m) => {
    acc[m.module_key] = m.is_enabled;
    return acc;
  }, {} as Record<string, boolean>);
}

export function useModuleSettingsMutations() {
  const queryClient = useQueryClient();

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleKey, isEnabled }: { moduleKey: string; isEnabled: boolean }) => {
      const { error } = await supabase
        .from("system_module_settings")
        .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
        .eq("module_key", moduleKey);

      if (error) throw error;
    },
    onMutate: async ({ moduleKey, isEnabled }) => {
      await queryClient.cancelQueries({ queryKey: ["system-module-settings"] });
      const previous = queryClient.getQueryData<ModuleSetting[]>(["system-module-settings"]);

      queryClient.setQueryData<ModuleSetting[]>(["system-module-settings"], (old) => {
        if (!old) return old;
        return old.map((m) => (m.module_key === moduleKey ? { ...m, is_enabled: isEnabled } : m));
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["system-module-settings"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["system-module-settings"] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { moduleKey: string; isEnabled: boolean }[]) => {
      for (const { moduleKey, isEnabled } of updates) {
        const { error } = await supabase
          .from("system_module_settings")
          .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
          .eq("module_key", moduleKey);

        if (error) throw error;
      }
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["system-module-settings"] });
      const previous = queryClient.getQueryData<ModuleSetting[]>(["system-module-settings"]);

      queryClient.setQueryData<ModuleSetting[]>(["system-module-settings"], (old) => {
        if (!old) return old;
        const map = new Map(updates.map((u) => [u.moduleKey, u.isEnabled] as const));
        return old.map((m) => (map.has(m.module_key) ? { ...m, is_enabled: map.get(m.module_key)! } : m));
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["system-module-settings"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["system-module-settings"] });
    },
  });

  return { toggleModuleMutation, bulkUpdateMutation };
}
