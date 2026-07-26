import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Shield, UserCog, Crown, Briefcase, User, Mail,
  Copy, Trash2, RefreshCw, Send, History, UserMinus, UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { usePermissions, Module, AppRole } from "@/hooks/usePermissions";
import {
  useCompanyMembers,
  useChangeMemberRole,
  useDeactivateMember,
  useReactivateMember,
  useTransferOwnership,
  useMemberAuditLog,
} from "@/hooks/useCompanyMembers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MODULES: { id: Module; label: string; description: string }[] = [
  { id: "clientes", label: "Clientes", description: "Gerenciar cadastro de clientes" },
  { id: "orcamentos", label: "Orçamentos", description: "Criar e gerenciar orçamentos" },
  { id: "ordens-servico", label: "Ordens de Serviço", description: "Acompanhar ordens de serviço" },
  { id: "agenda", label: "Agenda", description: "Visualizar e gerenciar agenda" },
  { id: "medicoes", label: "Medições", description: "Registrar medições em obra" },
  { id: "plano-corte", label: "Produção", description: "Plano de corte e projeto de vidros" },
  { id: "produtos", label: "Produtos", description: "Catálogo e preços de produtos" },
  { id: "estoque", label: "Estoque", description: "Controle de estoque" },
  { id: "caixa-vendas", label: "Caixa", description: "PDV e vendas diretas" },
  { id: "financeiro", label: "Financeiro", description: "Relatórios financeiros e impostos" },
  
  { id: "funcionarios", label: "Funcionários", description: "Gerenciar equipe" },
  { id: "configuracoes", label: "Configurações", description: "Configurações do sistema" },
];

const ROLES: { id: AppRole; label: string; icon: React.ElementType; description: string }[] = [
  { id: "admin", label: "Administrador", icon: Crown, description: "Acesso total" },
  { id: "manager", label: "Gerente", icon: Briefcase, description: "Acesso gerencial" },
  { id: "employee", label: "Funcionário", icon: User, description: "Acesso operacional" },
];

const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

export default function ConfiguracoesUsuarios() {
  const { currentCompany, user } = useAuth();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>("manager");

  const { data: members = [], isLoading: loadingMembers } = useCompanyMembers(currentCompany?.id);
  const { data: auditLog = [] } = useMemberAuditLog(currentCompany?.id);

  const changeRole = useChangeMemberRole();
  const deactivate = useDeactivateMember();
  const reactivate = useReactivateMember();
  const transferOwnership = useTransferOwnership();

  // Pending invites
  const { data: invites = [] } = useQuery({
    queryKey: ["employee-invites", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("employee_invites")
        .select("id, email, role, token, created_at, expires_at, accepted_at, employee_id")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from("employee_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-invites"] });
      toast.success("Convite revogado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Permissions matrix
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["role-permissions-config", currentCompany?.id, selectedRole],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("role", selectedRole);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      module, field, value,
    }: { module: Module; field: "can_view" | "can_create" | "can_edit" | "can_delete"; value: boolean }) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      const existingPerm = permissions.find((p: any) => p.module === module);
      if (existingPerm) {
        const { error } = await supabase
          .from("role_permissions")
          .update({ [field]: value, updated_at: new Date().toISOString() } as never)
          .eq("id", existingPerm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").insert({
          company_id: currentCompany.id,
          role: selectedRole,
          module,
          can_view: field === "can_view" ? value : false,
          can_create: field === "can_create" ? value : false,
          can_edit: field === "can_edit" ? value : false,
          can_delete: field === "can_delete" ? value : false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions-config"] });
      toast.success("Permissão atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getPermissionValue = (module: Module, field: "can_view" | "can_create" | "can_edit" | "can_delete") => {
    const perm = permissions.find((p: any) => p.module === module);
    return perm ? Boolean(perm[field]) : false;
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas administradores podem gerenciar usuários e permissões.</p>
        </div>
      </MainLayout>
    );
  }

  const activeMembers = members.filter((m) => m.is_active);
  const inactiveMembers = members.filter((m) => !m.is_active);
  const pendingInvites = invites.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date());
  const expiredInvites = invites.filter((i) => !i.accepted_at && new Date(i.expires_at) <= new Date());

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/aceitar-convite?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <MainLayout>
      <div className="space-y-6 pt-12 lg:pt-0">
        <div className="flex items-center gap-4 animate-fade-in">
          <Link to="/configuracoes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Usuários e Acessos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie quem tem acesso à empresa <strong>{currentCompany?.name}</strong>.
            </p>
          </div>
        </div>

        <Tabs defaultValue="membros" className="space-y-4">
          <TabsList>
            <TabsTrigger value="membros" className="gap-2">
              <UserCog className="w-4 h-4" />
              Membros ({activeMembers.length})
            </TabsTrigger>
            <TabsTrigger value="convites" className="gap-2">
              <Mail className="w-4 h-4" />
              Convites ({pendingInvites.length})
            </TabsTrigger>
            <TabsTrigger value="permissoes" className="gap-2">
              <Shield className="w-4 h-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* MEMBROS */}
          <TabsContent value="membros" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Membros ativos</CardTitle>
                  <CardDescription>
                    Pessoas que podem acessar esta empresa. Convide novos pela página{" "}
                    <Link to="/funcionarios" className="text-primary hover:underline">
                      Funcionários
                    </Link>
                    .
                  </CardDescription>
                </div>
                <Link to="/funcionarios">
                  <Button size="sm" className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Convidar
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loadingMembers ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
                ) : activeMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhum membro ativo.</p>
                ) : (
                  <div className="space-y-2">
                    {activeMembers.map((m) => {
                      const Icon = ROLE_BY_ID[m.role]?.icon ?? User;
                      const isSelf = m.user_id === user?.id;
                      const displayName = m.profile_name || m.employee_name || m.employee_email || "Sem nome";
                      return (
                        <div
                          key={m.user_company_id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{displayName}</p>
                                {isSelf && <Badge variant="outline" className="text-[10px]">você</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {m.employee_email || "Sem e-mail"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Select
                              value={m.role}
                              disabled={isSelf || changeRole.isPending}
                              onValueChange={(v) =>
                                changeRole.mutate({
                                  companyId: m.company_id,
                                  userId: m.user_id,
                                  role: v as AppRole,
                                })
                              }
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    <div className="flex items-center gap-2">
                                      <r.icon className="w-4 h-4" />
                                      {r.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {!isSelf && m.role !== "admin" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1">
                                    <Crown className="w-3.5 h-3.5" />
                                    Promover
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Transferir titularidade?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      <strong>{displayName}</strong> será promovido a Administrador,
                                      com acesso total à empresa. Você continuará como Administrador também.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        transferOwnership.mutate({
                                          companyId: m.company_id,
                                          newAdminUserId: m.user_id,
                                        })
                                      }
                                    >
                                      Confirmar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {!isSelf && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="icon" className="text-destructive">
                                    <UserMinus className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revogar acesso?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      <strong>{displayName}</strong> não poderá mais acessar esta empresa.
                                      Você pode reativar depois quando quiser.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deactivate.mutate({
                                          companyId: m.company_id,
                                          userId: m.user_id,
                                        })
                                      }
                                    >
                                      Revogar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {inactiveMembers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Acessos revogados ({inactiveMembers.length})</CardTitle>
                  <CardDescription>Reative para devolver o acesso.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {inactiveMembers.map((m) => {
                      const displayName = m.profile_name || m.employee_name || "Sem nome";
                      return (
                        <div
                          key={m.user_company_id}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 opacity-75"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground">{m.employee_email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              reactivate.mutate({ companyId: m.company_id, userId: m.user_id })
                            }
                          >
                            Reativar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CONVITES */}
          <TabsContent value="convites" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Convites pendentes</CardTitle>
                <CardDescription>Aguardando aceite. O usuário recebe um link para criar a senha.</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingInvites.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum convite pendente.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Cargo: {ROLE_BY_ID[inv.role]?.label || inv.role} · expira em{" "}
                            {format(new Date(inv.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => copyInviteLink(inv.token)}>
                            <Copy className="w-3.5 h-3.5" /> Link
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => revokeInvite.mutate(inv.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {expiredInvites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Expirados ({expiredInvites.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {expiredInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 opacity-75"
                      >
                        <p className="text-sm truncate">{inv.email}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => revokeInvite.mutate(inv.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PERMISSÕES */}
          <TabsContent value="permissoes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>Matriz de Permissões</CardTitle>
                    <CardDescription>Configure o que cada cargo pode acessar.</CardDescription>
                  </div>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r.id !== "admin").map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <role.icon className="w-4 h-4" />
                            {role.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium">Módulo</th>
                        <th className="text-center py-3 px-4 font-medium w-20">Ver</th>
                        <th className="text-center py-3 px-4 font-medium w-20">Criar</th>
                        <th className="text-center py-3 px-4 font-medium w-20">Editar</th>
                        <th className="text-center py-3 px-4 font-medium w-20">Excluir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((mod) => (
                        <tr key={mod.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-4">
                            <p className="font-medium">{mod.label}</p>
                            <p className="text-xs text-muted-foreground">{mod.description}</p>
                          </td>
                          {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((field) => (
                            <td key={field} className="text-center py-3 px-4">
                              <Switch
                                checked={getPermissionValue(mod.id, field)}
                                onCheckedChange={(v) =>
                                  updatePermissionMutation.mutate({ module: mod.id, field, value: v })
                                }
                                disabled={isLoading}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 p-4 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    <strong>Nota:</strong> Administradores têm acesso total, independente das opções acima.
                    As permissões aplicam-se apenas a Gerentes e Funcionários.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de acessos</CardTitle>
                <CardDescription>Últimas 100 alterações de membros desta empresa.</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Sem registros ainda.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {auditLog.map((a: any) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 text-sm p-2 rounded hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="shrink-0">{actionLabel(a.action)}</Badge>
                          <span className="text-muted-foreground truncate">
                            {a.before_role && a.after_role && a.before_role !== a.after_role
                              ? `${a.before_role} → ${a.after_role}`
                              : a.after_role || ""}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function actionLabel(a: string) {
  switch (a) {
    case "invited": return "Convidado";
    case "accepted": return "Aceitou";
    case "role_changed": return "Cargo alterado";
    case "deactivated": return "Acesso revogado";
    case "reactivated": return "Reativado";
    case "removed": return "Removido";
    case "transferred_ownership": return "Promovido a admin";
    default: return a;
  }
}
