import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Trash2,
  RotateCcw,
  Loader2,
  Wallet,
  FileText,
  Package,
  Boxes,
  Users,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface ResetModuleOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const MODULE_OPTIONS: ResetModuleOption[] = [
  {
    id: "financial",
    label: "Financeiro & Caixa",
    description: "Vendas, caixas abertos/fechados, contas a pagar, contas a receber, comissões e saldo do cofre.",
    icon: Wallet,
  },
  {
    id: "quotes",
    label: "Orçamentos & Ordens de Serviço",
    description: "Todos os orçamentos, itens, ordens de serviço, agendamentos e medições.",
    icon: FileText,
  },
  {
    id: "stock",
    label: "Estoque & Compras",
    description: "Itens em estoque, histórico de movimentações, compras e reservas de material.",
    icon: Package,
  },
  {
    id: "products",
    label: "Produtos & Preços da Empresa",
    description: "Produtos criados pela empresa e tabelas de preços customizadas.",
    icon: Boxes,
  },
  {
    id: "clients",
    label: "Clientes",
    description: "Base cadastral de clientes da vidraçaria.",
    icon: Users,
  },
];

const CONFIRMATION_KEYWORD = "ZERAR";

export function CompanyDataResetCard() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const isAllSelected = selectedModules.length === MODULE_OPTIONS.length;

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedModules([]);
    } else {
      setSelectedModules(MODULE_OPTIONS.map((m) => m.id));
    }
  };

  const handleOpenDialog = () => {
    if (selectedModules.length === 0) {
      toast.warning("Selecione pelo menos um módulo para limpar");
      return;
    }
    setConfirmText("");
    setDialogOpen(true);
  };

  const handleExecuteReset = async () => {
    if (!currentCompany?.id) return;
    if (confirmText.trim().toUpperCase() !== CONFIRMATION_KEYWORD) {
      toast.error(`Digite exatamente "${CONFIRMATION_KEYWORD}" para confirmar.`);
      return;
    }

    setIsResetting(true);
    try {
      const modulesToClear = isAllSelected ? ["all"] : selectedModules;

      const { data, error } = await (supabase.rpc as any)("reset_company_data", {
        p_company_id: currentCompany.id,
        p_modules: modulesToClear,
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || "Erro ao redefinir dados");
      }

      toast.success("Dados selecionados foram redefinidos com sucesso!");
      setDialogOpen(false);
      setSelectedModules([]);
      setConfirmText("");

      // Invalida todos os caches de dados operacionais para refletir o reset
      queryClient.invalidateQueries();
    } catch (err: any) {
      console.error("Erro ao resetar dados:", err);
      toast.error(err.message || "Erro ao redefinir dados da empresa");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Card className="border-destructive/30 bg-destructive/5 animate-slide-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-destructive flex items-center gap-2">
                Zona de Perigo — Limpeza e Reset de Dados
              </CardTitle>
              <CardDescription>
                Apague os dados operacionais da empresa de forma controlada (ideal para iniciar testes do zero ou resetar períodos).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-background/80">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="select-all-modules"
                checked={isAllSelected}
                onCheckedChange={toggleSelectAll}
              />
              <Label htmlFor="select-all-modules" className="font-semibold cursor-pointer">
                Selecionar Todos os Módulos (Zerar Tudo)
              </Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedModules.length} de {MODULE_OPTIONS.length} selecionados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MODULE_OPTIONS.map((module) => {
              const Icon = module.icon;
              const isChecked = selectedModules.includes(module.id);
              return (
                <div
                  key={module.id}
                  onClick={() => toggleModule(module.id)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? "bg-destructive/10 border-destructive/50 shadow-sm"
                      : "bg-background/60 hover:bg-background border-border/70"
                  }`}
                >
                  <Checkbox
                    id={`module-${module.id}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleModule(module.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-destructive flex-shrink-0" />
                      <Label htmlFor={`module-${module.id}`} className="font-medium cursor-pointer">
                        {module.label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-destructive/20">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
              Sua conta, usuários e acesso continuam preservados após a limpeza.
            </p>
            <Button
              variant="destructive"
              disabled={selectedModules.length === 0}
              onClick={handleOpenDialog}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Redefinir Dados Selecionados...
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação Segura */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão de Dados
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span>
                Esta ação é <strong>irreversível</strong> e apagará permanentemente os registros dos seguintes módulos para a empresa <strong>{currentCompany?.name}</strong>:
              </span>
              <ul className="list-disc pl-5 text-xs text-foreground font-medium space-y-1">
                {selectedModules.map((id) => {
                  const mod = MODULE_OPTIONS.find((m) => m.id === id);
                  return <li key={id}>{mod?.label}</li>;
                })}
              </ul>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="confirm-keyword" className="text-xs text-muted-foreground">
              Para confirmar, digite <strong>{CONFIRMATION_KEYWORD}</strong> no campo abaixo:
            </Label>
            <Input
              id="confirm-keyword"
              placeholder={CONFIRMATION_KEYWORD}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="uppercase font-mono font-bold tracking-widest text-center"
              autoComplete="off"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={isResetting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText.trim().toUpperCase() !== CONFIRMATION_KEYWORD || isResetting}
              onClick={handleExecuteReset}
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Apagando dados...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Confirmar e Limpar Dados
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
