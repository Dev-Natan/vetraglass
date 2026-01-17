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
import { ArrowLeft, Users, Shield, UserCog, Crown, Briefcase, User } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { usePermissions, Module, AppRole } from "@/hooks/usePermissions";

const MODULES: { id: Module; label: string; description: string }[] = [
  { id: 'clientes', label: 'Clientes', description: 'Gerenciar cadastro de clientes' },
  { id: 'orcamentos', label: 'Orçamentos', description: 'Criar e gerenciar orçamentos' },
  { id: 'ordens-servico', label: 'Ordens de Serviço', description: 'Acompanhar ordens de serviço' },
  { id: 'agenda', label: 'Agenda', description: 'Visualizar e gerenciar agenda' },
  { id: 'medicoes', label: 'Medições', description: 'Registrar medições em obra' },
  { id: 'produtos', label: 'Produtos', description: 'Catálogo de produtos' },
  { id: 'precos', label: 'Preços', description: 'Gerenciar tabela de preços' },
  { id: 'estoque', label: 'Estoque', description: 'Controle de estoque' },
  { id: 'caixa-vendas', label: 'Caixa e Vendas', description: 'PDV e vendas diretas' },
  { id: 'financeiro', label: 'Financeiro', description: 'Relatórios financeiros e impostos' },
  { id: 'notas-fiscais', label: 'Notas Fiscais', description: 'Emissão de NF-e/NFS-e' },
  { id: 'funcionarios', label: 'Funcionários', description: 'Gerenciar equipe' },
  { id: 'configuracoes', label: 'Configurações', description: 'Configurações do sistema' },
];

const ROLES: { id: AppRole; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'admin', label: 'Administrador', icon: Crown, description: 'Acesso total ao sistema' },
  { id: 'manager', label: 'Gerente', icon: Briefcase, description: 'Acesso gerencial com restrições' },
  { id: 'employee', label: 'Funcionário', icon: User, description: 'Acesso operacional básico' },
];

export default function ConfiguracoesUsuarios() {
  const { currentCompany } = useAuth();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>('manager');

  // Fetch permissions for selected role
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions-config', currentCompany?.id, selectedRole],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('role', selectedRole);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch employees with roles
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-with-roles', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, role, is_active, user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ 
      module, 
      field, 
      value 
    }: { 
      module: Module; 
      field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete'; 
      value: boolean 
    }) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");

      const existingPerm = permissions.find(p => p.module === module);
      
      if (existingPerm) {
        const { error } = await supabase
          .from('role_permissions')
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('id', existingPerm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .insert({
            company_id: currentCompany.id,
            role: selectedRole,
            module,
            can_view: field === 'can_view' ? value : false,
            can_create: field === 'can_create' ? value : false,
            can_edit: field === 'can_edit' ? value : false,
            can_delete: field === 'can_delete' ? value : false,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions-config'] });
      toast.success("Permissão atualizada!");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Update employee role mutation
  const updateEmployeeRoleMutation = useMutation({
    mutationFn: async ({ employeeId, role }: { employeeId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('employees')
        .update({ role })
        .eq('id', employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-roles'] });
      toast.success("Cargo atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const getPermissionValue = (module: Module, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    const perm = permissions.find(p => p.module === module);
    return perm ? Boolean(perm[field]) : false;
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas administradores podem gerenciar permissões.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 pt-12 lg:pt-0">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Link to="/configuracoes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Usuários e Permissões</h1>
            <p className="text-muted-foreground mt-1">Controle o acesso dos funcionários ao sistema.</p>
          </div>
        </div>

        {/* Employees with Roles */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Funcionários e Cargos</CardTitle>
                <CardDescription>Atribua cargos aos funcionários vinculados ao sistema.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum funcionário com acesso ao sistema.
                <br />
                <Link to="/funcionarios" className="text-primary hover:underline">
                  Convide funcionários
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {employees.map((emp) => (
                  <div 
                    key={emp.id} 
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-sm text-muted-foreground">{emp.email || 'Sem email'}</p>
                      </div>
                      {!emp.user_id && (
                        <Badge variant="outline" className="ml-2">Sem acesso</Badge>
                      )}
                    </div>
                    <Select
                      value={emp.role || 'employee'}
                      onValueChange={(value) => updateEmployeeRoleMutation.mutate({ 
                        employeeId: emp.id, 
                        role: value as AppRole 
                      })}
                      disabled={!emp.user_id}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Permissions Matrix */}
        <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Matriz de Permissões</CardTitle>
                  <CardDescription>Configure o que cada cargo pode acessar no sistema.</CardDescription>
                </div>
              </div>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r.id !== 'admin').map((role) => (
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
                    <th className="text-center py-3 px-4 font-medium w-24">Ver</th>
                    <th className="text-center py-3 px-4 font-medium w-24">Criar</th>
                    <th className="text-center py-3 px-4 font-medium w-24">Editar</th>
                    <th className="text-center py-3 px-4 font-medium w-24">Excluir</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod) => (
                    <tr key={mod.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{mod.label}</p>
                          <p className="text-sm text-muted-foreground">{mod.description}</p>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Switch
                          checked={getPermissionValue(mod.id, 'can_view')}
                          onCheckedChange={(v) => updatePermissionMutation.mutate({ 
                            module: mod.id, 
                            field: 'can_view', 
                            value: v 
                          })}
                          disabled={isLoading}
                        />
                      </td>
                      <td className="text-center py-3 px-4">
                        <Switch
                          checked={getPermissionValue(mod.id, 'can_create')}
                          onCheckedChange={(v) => updatePermissionMutation.mutate({ 
                            module: mod.id, 
                            field: 'can_create', 
                            value: v 
                          })}
                          disabled={isLoading}
                        />
                      </td>
                      <td className="text-center py-3 px-4">
                        <Switch
                          checked={getPermissionValue(mod.id, 'can_edit')}
                          onCheckedChange={(v) => updatePermissionMutation.mutate({ 
                            module: mod.id, 
                            field: 'can_edit', 
                            value: v 
                          })}
                          disabled={isLoading}
                        />
                      </td>
                      <td className="text-center py-3 px-4">
                        <Switch
                          checked={getPermissionValue(mod.id, 'can_delete')}
                          onCheckedChange={(v) => updatePermissionMutation.mutate({ 
                            module: mod.id, 
                            field: 'can_delete', 
                            value: v 
                          })}
                          disabled={isLoading}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Administradores sempre têm acesso total ao sistema, 
                independente das configurações acima. As permissões se aplicam apenas a Gerentes e Funcionários.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
