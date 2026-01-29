import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  useModuleSettings, 
  useModuleSettingsMutations,
  ModuleSetting 
} from "@/hooks/useModuleSettings";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ClipboardList, 
  Calendar, 
  Ruler, 
  Scissors, 
  Package, 
  DollarSign, 
  Boxes, 
  ShoppingCart, 
  ShoppingBag, 
  Wallet, 
  Receipt, 
  UserCog, 
  BarChart3, 
  Settings,
  Puzzle,
  ToggleLeft,
  ToggleRight,
  Lock,
  Unlock
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  Calendar,
  Ruler,
  Scissors,
  Package,
  DollarSign,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Wallet,
  Receipt,
  UserCog,
  BarChart3,
  Settings,
};

interface ModuleRowProps {
  module: ModuleSetting;
  onToggle: (moduleKey: string, isEnabled: boolean) => void;
  isLoading: boolean;
}

const ModuleRow = React.memo(function ModuleRow({ module, onToggle, isLoading }: ModuleRowProps) {
  const IconComponent = iconMap[module.icon || ""] || Puzzle;
  const isEssential = module.module_key === "dashboard" || module.module_key === "configuracoes";

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${module.is_enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <IconComponent className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{module.module_name}</span>
            {module.is_enabled ? (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-xs">
                <Unlock className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Oculto
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{module.description}</p>
        </div>
      </div>
      <Switch
        checked={module.is_enabled === true}
        onCheckedChange={(checked) => onToggle(module.module_key, checked)}
        disabled={isLoading || isEssential}
      />
    </div>
  );
});

export function ModulesTab() {
  const { data: modules, isLoading } = useModuleSettings();
  const { toggleModuleMutation, bulkUpdateMutation } = useModuleSettingsMutations();

  const handleToggle = (moduleKey: string, isEnabled: boolean) => {
    toggleModuleMutation.mutate(
      { moduleKey, isEnabled },
      {
        onSuccess: () => {
          toast.success(`Módulo ${isEnabled ? "ativado" : "desativado"}!`);
        },
        onError: () => {
          toast.error("Erro ao atualizar módulo");
        },
      }
    );
  };

  const handleEnableAll = () => {
    if (!modules) return;
    const updates = modules
      .filter(m => !m.is_enabled)
      .map(m => ({ moduleKey: m.module_key, isEnabled: true }));
    
    if (updates.length === 0) {
      toast.info("Todos os módulos já estão ativos");
      return;
    }

    bulkUpdateMutation.mutate(updates, {
      onSuccess: () => {
        toast.success(`${updates.length} módulo(s) ativado(s)!`);
      },
      onError: () => {
        toast.error("Erro ao ativar módulos");
      },
    });
  };

  const handleDisableNonEssential = () => {
    if (!modules) return;
    const essentialModules = ["dashboard", "configuracoes", "clientes"];
    const updates = modules
      .filter(m => m.is_enabled && !essentialModules.includes(m.module_key))
      .map(m => ({ moduleKey: m.module_key, isEnabled: false }));
    
    if (updates.length === 0) {
      toast.info("Módulos já estão no modo mínimo");
      return;
    }

    bulkUpdateMutation.mutate(updates, {
      onSuccess: () => {
        toast.success(`${updates.length} módulo(s) desativado(s)!`);
      },
      onError: () => {
        toast.error("Erro ao desativar módulos");
      },
    });
  };

  const enabledCount = modules?.filter(m => m.is_enabled).length || 0;
  const totalCount = modules?.length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Controle de Módulos
          </CardTitle>
          <CardDescription>
            Habilite ou desabilite módulos do sistema. Módulos desabilitados ficam ocultos no menu para todos os usuários.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Actions */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div>
              <p className="font-medium">
                {enabledCount} de {totalCount} módulos ativos
              </p>
              <p className="text-sm text-muted-foreground">
                Gerencie quais funcionalidades estarão disponíveis
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableNonEssential}
                disabled={bulkUpdateMutation.isPending}
              >
                <ToggleLeft className="h-4 w-4 mr-2" />
                Modo Mínimo
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEnableAll}
                disabled={bulkUpdateMutation.isPending}
              >
                <ToggleRight className="h-4 w-4 mr-2" />
                Ativar Todos
              </Button>
            </div>
          </div>

          {/* Modules List */}
          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : (
              modules?.map((module) => (
                <ModuleRow
                  key={module.id}
                  module={module}
                  onToggle={handleToggle}
                  isLoading={toggleModuleMutation.isPending}
                />
              ))
            )}
          </div>

          {/* Info */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
            <p className="font-medium">Nota importante:</p>
            <p>
              Dashboard e Configurações são essenciais e não podem ser desabilitados. 
              Módulos desabilitados ficam completamente ocultos no menu lateral dos usuários.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
