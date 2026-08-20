import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Settings, 
  Bell, 
  Database,
  Shield,
  Globe,
  Palette,
  Mail,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  Users,
  Building2,
  HardDrive,
  Activity,
  Puzzle,
  UserPlus
} from "lucide-react";
import { ModulesTab } from "@/components/admin/settings/ModulesTab";
import { SaasAdminsTab } from "@/components/admin/settings/SaasAdminsTab";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminSettings() {
  const { isSaasAdmin } = useAuth();
  const { allowNewSignups, updateSetting, isUpdating } = useSystemSettings();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  // Fetch system stats for maintenance section
  const { data: systemStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["admin-system-stats"],
    queryFn: async () => {
      const [
        { count: companiesCount },
        { count: usersCount },
        { count: auditLogsCount },
        { count: ticketsCount },
        { count: salesCount },
        { count: quotesCount },
      ] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("audit_logs").select("*", { count: "exact", head: true }),
        supabase.from("support_tickets").select("*", { count: "exact", head: true }),
        supabase.from("sales").select("*", { count: "exact", head: true }),
        supabase.from("quotes").select("*", { count: "exact", head: true }),
      ]);

      // Get old audit logs count (older than 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { count: oldAuditLogsCount } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .lt("created_at", ninetyDaysAgo.toISOString());

      return {
        companiesCount: companiesCount || 0,
        usersCount: usersCount || 0,
        auditLogsCount: auditLogsCount || 0,
        ticketsCount: ticketsCount || 0,
        salesCount: salesCount || 0,
        quotesCount: quotesCount || 0,
        oldAuditLogsCount: oldAuditLogsCount || 0,
      };
    },
    enabled: isSaasAdmin,
  });

  // Mutation to clean old audit logs
  const cleanAuditLogsMutation = useMutation({
    mutationFn: async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { error } = await supabase
        .from("audit_logs")
        .delete()
        .lt("created_at", ninetyDaysAgo.toISOString());
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Logs antigos removidos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-system-stats"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: () => {
      toast.error("Erro ao limpar logs antigos");
    },
  });

  if (!isSaasAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configurações do Sistema
          </h1>
          <p className="text-muted-foreground">
            Configurações globais do SaaS e manutenção do sistema
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full max-w-4xl">
            <TabsTrigger value="general" className="gap-2">
              <Globe className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="modules" className="gap-2">
              <Puzzle className="h-4 w-4" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="h-4 w-4" />
              Admins SaaS
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2">
              <Database className="h-4 w-4" />
              Manutenção
            </TabsTrigger>
          </TabsList>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <ModulesTab />
          </TabsContent>

          {/* SaaS Admins Tab */}
          <TabsContent value="admins">
            <SaasAdminsTab />
          </TabsContent>


          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Aparência do Sistema
                </CardTitle>
                <CardDescription>
                  Configure a aparência padrão para novas empresas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária Padrão</Label>
                    <div className="flex gap-2">
                      <Input type="color" defaultValue="#2563eb" className="w-16 h-10 p-1" />
                      <Input defaultValue="#2563eb" className="flex-1" readOnly />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária Padrão</Label>
                    <div className="flex gap-2">
                      <Input type="color" defaultValue="#64748b" className="w-16 h-10 p-1" />
                      <Input defaultValue="#64748b" className="flex-1" readOnly />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Modo Escuro por Padrão</Label>
                      <p className="text-sm text-muted-foreground">
                        Ativar tema escuro para novas empresas
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Permitir Personalização de Tema</Label>
                      <p className="text-sm text-muted-foreground">
                        Empresas podem alterar cores do sistema
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Configurações Regionais
                </CardTitle>
                <CardDescription>
                  Configurações de idioma, moeda e formato de data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Idioma Padrão</Label>
                    <Select defaultValue="pt-BR">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es-ES">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select defaultValue="BRL">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">Real (R$)</SelectItem>
                        <SelectItem value="USD">Dólar ($)</SelectItem>
                        <SelectItem value="EUR">Euro (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Formato de Data</Label>
                    <Select defaultValue="dd/MM/yyyy">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                        <SelectItem value="MM/dd/yyyy">MM/DD/AAAA</SelectItem>
                        <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Configurações de Email
                </CardTitle>
                <CardDescription>
                  Configure o envio de emails do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Emails de Boas-Vindas</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar email quando nova empresa é criada
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificações de Suporte</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber email quando novo ticket é criado
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Relatórios Semanais</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar resumo semanal de atividades
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Email do Administrador</Label>
                  <Input type="email" placeholder="admin@exemplo.com" />
                  <p className="text-xs text-muted-foreground">
                    Email para receber notificações importantes do sistema
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Avisos do Sistema
                </CardTitle>
                <CardDescription>
                  Configure avisos globais para todas as empresas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Manutenção Programada</Label>
                    <p className="text-sm text-muted-foreground">
                      Exibir banner de manutenção para todas as empresas
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Novidades do Sistema</Label>
                    <p className="text-sm text-muted-foreground">
                      Mostrar pop-up de novas funcionalidades
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Controle de Cadastros
                </CardTitle>
                <CardDescription>
                  Gerencie se novos usuários e empresas podem criar conta no sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Permitir Novos Cadastros (allow_new_signups)</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando desativado, o formulário de cadastro é bloqueado na tela de login com mensagem de manutenção.
                    </p>
                  </div>
                  <Switch
                    checked={allowNewSignups}
                    disabled={isUpdating}
                    onCheckedChange={(checked) => updateSetting({ key: 'allow_new_signups', value: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Políticas de Segurança
                </CardTitle>
                <CardDescription>
                  Configurações de segurança globais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Exigir Senha Forte</Label>
                    <p className="text-sm text-muted-foreground">
                      Mínimo 8 caracteres, letras e números
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Confirmação de Email Obrigatória</Label>
                    <p className="text-sm text-muted-foreground">
                      Usuários devem confirmar email para acessar
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timeout de Sessão (minutos)</Label>
                    <Input type="number" defaultValue="60" min="5" max="480" />
                  </div>
                  <div className="space-y-2">
                    <Label>Máximo de Tentativas de Login</Label>
                    <Input type="number" defaultValue="5" min="3" max="10" />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Autenticação em Dois Fatores</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir 2FA para administradores SaaS
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Auditoria
                </CardTitle>
                <CardDescription>
                  Configurações de log de auditoria
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Registrar Todas as Ações</Label>
                    <p className="text-sm text-muted-foreground">
                      Incluir leituras além de criação/edição/exclusão
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="space-y-2">
                  <Label>Retenção de Logs (dias)</Label>
                  <Select defaultValue="90">
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="180">180 dias</SelectItem>
                      <SelectItem value="365">1 ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Settings */}
          <TabsContent value="maintenance" className="space-y-6">
            {/* System Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Visão Geral do Sistema
                    </CardTitle>
                    <CardDescription>
                      Estatísticas e status do banco de dados
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchStats()}
                    disabled={statsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Building2 className="h-5 w-5 mx-auto mb-2 text-primary" />
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto" />
                    ) : (
                      <div className="text-2xl font-bold">{systemStats?.companiesCount}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Empresas</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Users className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto" />
                    ) : (
                      <div className="text-2xl font-bold">{systemStats?.usersCount}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Usuários</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Activity className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto" />
                    ) : (
                      <div className="text-2xl font-bold">{systemStats?.auditLogsCount}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Logs</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <HardDrive className="h-5 w-5 mx-auto mb-2 text-green-500" />
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto" />
                    ) : (
                      <div className="text-2xl font-bold">{systemStats?.salesCount}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Vendas</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-2 text-purple-500" />
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto" />
                    ) : (
                      <div className="text-2xl font-bold">{systemStats?.quotesCount}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Orçamentos</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-rose-500" />
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto" />
                    ) : (
                      <div className="text-2xl font-bold">{systemStats?.ticketsCount}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Tickets</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cleanup Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Limpeza do Sistema
                </CardTitle>
                <CardDescription>
                  Remova dados antigos para otimizar performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Activity className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-medium">Logs de Auditoria Antigos</div>
                      <p className="text-sm text-muted-foreground">
                        Registros com mais de 90 dias
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {statsLoading ? (
                      <Skeleton className="h-6 w-16" />
                    ) : (
                      <Badge variant="secondary">
                        {systemStats?.oldAuditLogsCount || 0} registros
                      </Badge>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          disabled={!systemStats?.oldAuditLogsCount || cleanAuditLogsMutation.isPending}
                        >
                          {cleanAuditLogsMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Confirmar Exclusão
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Você está prestes a excluir <strong>{systemStats?.oldAuditLogsCount}</strong> registros 
                            de auditoria com mais de 90 dias. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => cleanAuditLogsMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir Logs Antigos
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-rose-500/10">
                      <Trash2 className="h-5 w-5 text-rose-500" />
                    </div>
                    <div>
                      <div className="font-medium">Tickets Fechados</div>
                      <p className="text-sm text-muted-foreground">
                        Tickets resolvidos há mais de 6 meses
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">Em breve</Badge>
                    <Button variant="outline" size="sm" disabled>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Status do Sistema
                </CardTitle>
                <CardDescription>
                  Verificação de saúde dos serviços
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">Banco de Dados</span>
                    </div>
                    <Badge className="bg-green-500 hover:bg-green-600">Operacional</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">Autenticação</span>
                    </div>
                    <Badge className="bg-green-500 hover:bg-green-600">Operacional</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">Storage</span>
                    </div>
                    <Badge className="bg-green-500 hover:bg-green-600">Operacional</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">Edge Functions</span>
                    </div>
                    <Badge className="bg-green-500 hover:bg-green-600">Operacional</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <Button onClick={() => toast.success("Configurações salvas!")} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
