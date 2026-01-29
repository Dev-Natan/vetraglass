import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Shield, 
  Plus, 
  Pencil, 
  Trash2,
  Crown,
  Briefcase,
  ShoppingCart,
  Wallet,
  Package,
  Factory,
  Wrench,
  PiggyBank,
  Settings,
  Eye,
  EyeOff,
  DollarSign,
  Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePermissionProfiles, PermissionProfileRow, PROFILE_TYPE_LABELS, Module } from '@/hooks/usePermissionProfiles';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const PROFILE_TYPE_ICONS: Record<string, React.ElementType> = {
  admin: Crown,
  gerente: Briefcase,
  vendedor: ShoppingCart,
  caixa: Wallet,
  almoxarifado: Package,
  producao: Factory,
  instalador: Wrench,
  financeiro: PiggyBank,
  custom: Settings,
};

const MODULES: { id: Module; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Painel principal' },
  { id: 'clientes', label: 'Clientes', description: 'Cadastro de clientes' },
  { id: 'orcamentos', label: 'Orçamentos', description: 'Criar e gerenciar orçamentos' },
  { id: 'ordens-servico', label: 'Ordens de Serviço', description: 'Acompanhar OS' },
  { id: 'agenda', label: 'Agenda', description: 'Visualizar e gerenciar agenda' },
  { id: 'medicoes', label: 'Medições', description: 'Registrar medições' },
  { id: 'plano-corte', label: 'Produção', description: 'Plano de corte e vidros' },
  { id: 'produtos', label: 'Produtos', description: 'Catálogo e preços' },
  { id: 'estoque', label: 'Estoque', description: 'Controle de estoque' },
  { id: 'caixa-vendas', label: 'Caixa', description: 'PDV e vendas' },
  { id: 'financeiro', label: 'Financeiro', description: 'Relatórios financeiros' },
  { id: 'notas-fiscais', label: 'Fiscal', description: 'Emissão de NF' },
  { id: 'funcionarios', label: 'Funcionários', description: 'Gerenciar equipe' },
  { id: 'configuracoes', label: 'Configurações', description: 'Configurações do sistema' },
];

export default function ConfiguracoesPerfis() {
  const { profiles, isLoading, updateProfile, deleteProfile } = usePermissionProfiles();
  const { isAdmin } = usePermissions();
  const [selectedProfile, setSelectedProfile] = useState<PermissionProfileRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<PermissionProfileRow | null>(null);

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <Lock className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas administradores podem gerenciar perfis.</p>
        </div>
      </MainLayout>
    );
  }

  const handleUpdatePermission = (
    profile: PermissionProfileRow,
    module: Module,
    action: 'view' | 'create' | 'edit' | 'delete',
    value: boolean
  ) => {
    const updatedPermissions = {
      ...profile.permissions,
      [module]: {
        ...(profile.permissions[module] || { view: false, create: false, edit: false, delete: false }),
        [action]: value,
      },
    };

    updateProfile.mutate({ id: profile.id, permissions: updatedPermissions });
  };

  const handleUpdateSpecialPermission = (
    profile: PermissionProfileRow,
    field: string,
    value: boolean
  ) => {
    updateProfile.mutate({ id: profile.id, [field]: value });
  };

  const handleDeleteProfile = () => {
    if (profileToDelete) {
      deleteProfile.mutate(profileToDelete.id);
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
      setSelectedProfile(null);
    }
  };

  const ProfileCard = ({ profile }: { profile: PermissionProfileRow }) => {
    const Icon = PROFILE_TYPE_ICONS[profile.profile_type] || Settings;
    const isSelected = selectedProfile?.id === profile.id;

    return (
      <Card 
        className={`cursor-pointer transition-all hover:border-primary/50 ${
          isSelected ? 'border-primary ring-2 ring-primary/20' : ''
        }`}
        onClick={() => setSelectedProfile(profile)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{profile.name}</CardTitle>
                <CardDescription className="text-xs">
                  {PROFILE_TYPE_LABELS[profile.profile_type]}
                </CardDescription>
              </div>
            </div>
            {profile.is_system && (
              <Badge variant="secondary" className="text-xs">Padrão</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {profile.description || 'Sem descrição'}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {profile.hide_prices && (
              <Badge variant="outline" className="text-xs gap-1">
                <EyeOff className="w-3 h-3" /> Preços ocultos
              </Badge>
            )}
            {profile.can_operate_cash && (
              <Badge variant="outline" className="text-xs gap-1">
                <Wallet className="w-3 h-3" /> Opera caixa
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

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
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold text-foreground">Perfis de Permissão</h1>
            <p className="text-muted-foreground mt-1">Configure os níveis de acesso para sua equipe.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profiles List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Perfis Disponíveis</h2>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            )}
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2">
            {selectedProfile ? (
              <Card className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = PROFILE_TYPE_ICONS[selectedProfile.profile_type] || Settings;
                        return (
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                        );
                      })()}
                      <div>
                        <CardTitle>{selectedProfile.name}</CardTitle>
                        <CardDescription>{selectedProfile.description}</CardDescription>
                      </div>
                    </div>
                    {!selectedProfile.is_system && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setProfileToDelete(selectedProfile);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Excluir
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="modules" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="modules">Módulos</TabsTrigger>
                      <TabsTrigger value="special">Permissões Especiais</TabsTrigger>
                    </TabsList>

                    <TabsContent value="modules" className="space-y-4 mt-4">
                      <div className="rounded-lg border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-3 px-4 font-medium">Módulo</th>
                              <th className="text-center py-3 px-4 font-medium w-16">Ver</th>
                              <th className="text-center py-3 px-4 font-medium w-16">Criar</th>
                              <th className="text-center py-3 px-4 font-medium w-16">Editar</th>
                              <th className="text-center py-3 px-4 font-medium w-16">Excluir</th>
                            </tr>
                          </thead>
                          <tbody>
                            {MODULES.map((mod) => {
                              const perm = selectedProfile.permissions[mod.id] || {
                                view: false,
                                create: false,
                                edit: false,
                                delete: false,
                              };
                              return (
                                <tr key={mod.id} className="border-b last:border-0 hover:bg-muted/30">
                                  <td className="py-2 px-4">
                                    <div>
                                      <p className="font-medium text-sm">{mod.label}</p>
                                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                                    </div>
                                  </td>
                                  <td className="text-center py-2 px-4">
                                    <Switch
                                      checked={perm.view}
                                      onCheckedChange={(v) => 
                                        handleUpdatePermission(selectedProfile, mod.id, 'view', v)
                                      }
                                      disabled={selectedProfile.profile_type === 'admin'}
                                    />
                                  </td>
                                  <td className="text-center py-2 px-4">
                                    <Switch
                                      checked={perm.create}
                                      onCheckedChange={(v) => 
                                        handleUpdatePermission(selectedProfile, mod.id, 'create', v)
                                      }
                                      disabled={selectedProfile.profile_type === 'admin'}
                                    />
                                  </td>
                                  <td className="text-center py-2 px-4">
                                    <Switch
                                      checked={perm.edit}
                                      onCheckedChange={(v) => 
                                        handleUpdatePermission(selectedProfile, mod.id, 'edit', v)
                                      }
                                      disabled={selectedProfile.profile_type === 'admin'}
                                    />
                                  </td>
                                  <td className="text-center py-2 px-4">
                                    <Switch
                                      checked={perm.delete}
                                      onCheckedChange={(v) => 
                                        handleUpdatePermission(selectedProfile, mod.id, 'delete', v)
                                      }
                                      disabled={selectedProfile.profile_type === 'admin'}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>

                    <TabsContent value="special" className="space-y-4 mt-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Visibility Controls */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              Visibilidade de Valores
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="hide_prices" className="text-sm">Ocultar Preços</Label>
                              <Switch
                                id="hide_prices"
                                checked={selectedProfile.hide_prices}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'hide_prices', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="hide_costs" className="text-sm">Ocultar Custos</Label>
                              <Switch
                                id="hide_costs"
                                checked={selectedProfile.hide_costs}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'hide_costs', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Cash Operations */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Wallet className="w-4 h-4" />
                              Operações de Caixa
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="can_operate_cash" className="text-sm">Operar Caixa</Label>
                              <Switch
                                id="can_operate_cash"
                                checked={selectedProfile.can_operate_cash}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'can_operate_cash', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="can_cancel_sales" className="text-sm">Cancelar Vendas</Label>
                              <Switch
                                id="can_cancel_sales"
                                checked={selectedProfile.can_cancel_sales}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'can_cancel_sales', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Approvals */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Aprovações
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="can_approve_discounts" className="text-sm">Aprovar Descontos</Label>
                              <Switch
                                id="can_approve_discounts"
                                checked={selectedProfile.can_approve_discounts}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'can_approve_discounts', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="can_approve_refunds" className="text-sm">Aprovar Devoluções</Label>
                              <Switch
                                id="can_approve_refunds"
                                checked={selectedProfile.can_approve_refunds}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'can_approve_refunds', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Stock & Reports */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Estoque e Relatórios
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="can_manage_stock" className="text-sm">Gerenciar Estoque</Label>
                              <Switch
                                id="can_manage_stock"
                                checked={selectedProfile.can_manage_stock}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'can_manage_stock', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="can_view_reports" className="text-sm">Ver Relatórios</Label>
                              <Switch
                                id="can_view_reports"
                                checked={selectedProfile.can_view_reports}
                                onCheckedChange={(v) => 
                                  handleUpdateSpecialPermission(selectedProfile, 'can_view_reports', v)
                                }
                                disabled={selectedProfile.profile_type === 'admin'}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {selectedProfile.profile_type === 'admin' && (
                        <div className="p-4 rounded-xl bg-muted/50">
                          <p className="text-sm text-muted-foreground">
                            <strong>Nota:</strong> Perfis de Administrador têm acesso total e não podem ser modificados.
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Selecione um perfil para editar suas permissões</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil "{profileToDelete?.name}"? 
              Funcionários vinculados a este perfil ficarão sem perfil de permissão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProfile} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
