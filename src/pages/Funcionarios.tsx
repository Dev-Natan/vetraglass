import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { UserCog, Plus, Search, MoreVertical, Pencil, Trash2, UserCheck, UserX, CheckCircle, ShieldOff, FileText, Printer, IdCard, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EmployeeDialog } from '@/components/funcionarios/EmployeeDialog';
import { PermissionProfileBadge } from '@/components/funcionarios/PermissionProfileSelect';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionGuard } from '@/components/PermissionGuard';
import { generateCredentialCardPdf, generateCredentialSheetPdf } from '@/utils/generateCredentialCardPdf';
import { generateEmployeeBadgePdf, imageUrlToBase64 } from '@/utils/generateEmployeeBadgePdf';
import { cropImageToCircle } from '@/utils/cropImageToCircle';
import { toast } from 'sonner';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

const roleLabels: Record<string, string> = {
  operador: 'Operador',
  vidraceiro: 'Vidraceiro',
  instalador: 'Instalador',
  vendedor: 'Vendedor',
  gerente: 'Gerente',
  administrativo: 'Administrativo',
};

const specialtyLabels: Record<string, string> = {
  corte: 'Corte de Vidro',
  lapidacao: 'Lapidação',
  temperado: 'Vidro Temperado',
  instalacao: 'Instalação',
  box: 'Box de Banheiro',
  espelho: 'Espelhos',
  esquadrias: 'Esquadrias',
  geral: 'Geral',
};

export default function Funcionarios() {
  const navigate = useNavigate();
  const { employees, isLoading, createEmployee, updateEmployee, deleteEmployee, toggleEmployeeStatus } = useEmployees();
  const { canCreate, isAdmin, isManager } = usePermissions();
  const { currentCompany } = useAuth();

  // Module tutorial trigger
  useModuleTutorialTrigger('funcionarios');

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const handlePrintCredentialCard = (employee: Employee) => {
    if (!employee.username || !currentCompany) {
      toast.error('Funcionário não possui acesso ao sistema configurado');
      return;
    }
    generateCredentialCardPdf({
      employeeName: employee.name,
      login: employee.username,
      companyName: currentCompany.name,
      companyToken: currentCompany.login_token || '',
    });
    toast.success('Cartão de credenciais gerado!');
  };

  const handlePrintCredentialSheet = (employee: Employee) => {
    if (!employee.username || !currentCompany) {
      toast.error('Funcionário não possui acesso ao sistema configurado');
      return;
    }
    generateCredentialSheetPdf({
      employeeName: employee.name,
      login: employee.username,
      companyName: currentCompany.name,
      companyToken: currentCompany.login_token || '',
    });
    toast.success('Folha de credenciais gerada!');
  };

  const handlePrintBadge = async (employee: Employee) => {
    if (!currentCompany) {
      toast.error('Empresa não encontrada');
      return;
    }
    
    toast.loading('Preparando crachá...', { id: 'badge-loading' });
    
    // Convert photo URL to base64 if available
    let photoBase64: string | null = null;
    if (employee.photo_url) {
      photoBase64 = await imageUrlToBase64(employee.photo_url);
    }
    
    // Convert company logo to base64 if available
    let companyLogoBase64: string | null = null;
    if (currentCompany.logo_url) {
      const raw = await imageUrlToBase64(currentCompany.logo_url);
      if (raw) {
        try {
          companyLogoBase64 = await cropImageToCircle(raw);
        } catch {
          companyLogoBase64 = raw;
        }
      }
    }
    
    toast.dismiss('badge-loading');
    
    generateEmployeeBadgePdf({
      employeeName: employee.name,
      role: employee.role,
      specialty: employee.specialty,
      phone: employee.phone,
      companyName: currentCompany.name,
      companyPhone: currentCompany.phone,
      companyAddress: currentCompany.address,
      employeeId: employee.id,
      photoUrl: employee.photo_url,
      photoBase64,
      companyLogoUrl: currentCompany.logo_url,
      companyLogoBase64,
    });
    toast.success('Crachá gerado com sucesso!');
  };

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.phone?.includes(term) ||
      roleLabels[emp.role]?.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const activeEmployees = filteredEmployees.filter(e => e.is_active);
  const inactiveEmployees = filteredEmployees.filter(e => !e.is_active);

  const handleOpenDialog = (employee?: Employee) => {
    setSelectedEmployee(employee || null);
    setDialogOpen(true);
  };

  const handleSave = async (data: Omit<Employee, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
    if (selectedEmployee) {
      await updateEmployee.mutateAsync({ id: selectedEmployee.id, ...data });
    } else {
      await createEmployee.mutateAsync(data);
    }
    setDialogOpen(false);
    setSelectedEmployee(null);
  };

  const handleDelete = async () => {
    if (employeeToDelete) {
      await deleteEmployee.mutateAsync(employeeToDelete.id);
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    }
  };

  const handleToggleStatus = async (employee: Employee) => {
    await toggleEmployeeStatus.mutateAsync({ 
      id: employee.id, 
      is_active: !employee.is_active,
      user_id: employee.user_id 
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const EmployeeCard = ({ employee }: { employee: Employee }) => {
    const hasSystemAccess = !!employee.user_id;

    return (
      <div className={`section-card p-4 ${!employee.is_active ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-foreground truncate">{employee.name}</h3>
              {!employee.is_active && (
                <Badge variant="secondary" className="text-xs">Inativo</Badge>
              )}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {roleLabels[employee.role] || employee.role}
                </Badge>
                {employee.specialty && (
                  <span className="text-xs">• {specialtyLabels[employee.specialty] || employee.specialty}</span>
                )}
              </p>
              {employee.email && <p className="truncate">{employee.email}</p>}
              {employee.phone && <p>{employee.phone}</p>}
              {employee.hourly_rate > 0 && (
                <p className="text-primary font-medium">{formatCurrency(employee.hourly_rate)}/hora</p>
              )}
              {employee.permission_profile_id && (
                <div className="mt-2">
                  <PermissionProfileBadge profileId={employee.permission_profile_id} />
                </div>
              )}
            </div>

            {/* System Access Status */}
            <div className="mt-3 pt-3 border-t">
              {hasSystemAccess ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Ativo no sistema
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ShieldOff className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Sem acesso ao sistema
                  </span>
                  {(isAdmin || isManager) && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary"
                      onClick={() => handleOpenDialog(employee)}
                    >
                      Editar para criar acesso
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <PermissionGuard module="funcionarios" action="edit">
                <DropdownMenuItem onClick={() => handleOpenDialog(employee)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              </PermissionGuard>

              {/* Badge generation - available for all employees */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePrintBadge(employee)}>
                <IdCard className="w-4 h-4 mr-2" />
                Gerar Crachá
              </DropdownMenuItem>

              {/* Print credentials options - only if has system access */}
              {hasSystemAccess && (
                <>
                  <DropdownMenuItem onClick={() => handlePrintCredentialCard(employee)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Cartão de Credenciais
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrintCredentialSheet(employee)}>
                    <Printer className="w-4 h-4 mr-2" />
                    Folha de Instruções
                  </DropdownMenuItem>
                </>
              )}

              <PermissionGuard module="funcionarios" action="edit">
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleToggleStatus(employee)}>
                  {employee.is_active ? (
                    <>
                      <UserX className="w-4 h-4 mr-2" />
                      Desativar
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Ativar
                    </>
                  )}
                </DropdownMenuItem>
              </PermissionGuard>

              <PermissionGuard module="funcionarios" action="delete">
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => { setEmployeeToDelete(employee); setDeleteDialogOpen(true); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </PermissionGuard>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <UserCog className="w-7 h-7 text-primary" />
              Funcionários
            </h1>
            <p className="text-muted-foreground">
              {employees.length} funcionário{employees.length !== 1 ? 's' : ''} cadastrado{employees.length !== 1 ? 's' : ''}
            </p>
          </div>
          <PermissionGuard module="funcionarios" action="create">
            <Button className="gap-2" onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4" />
              Novo Funcionário
            </Button>
          </PermissionGuard>
        </div>

        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar funcionários..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserCog className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">
                {searchTerm ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário cadastrado'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Tente buscar com outros termos.' 
                  : 'Cadastre os membros da sua equipe para gerenciar melhor.'}
              </p>
              {!searchTerm && canCreate('funcionarios') && (
                <Button className="gap-2" onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Funcionário
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {activeEmployees.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Ativos ({activeEmployees.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activeEmployees.map((employee) => (
                      <EmployeeCard key={employee.id} employee={employee} />
                    ))}
                  </div>
                </div>
              )}
              
              {inactiveEmployees.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Inativos ({inactiveEmployees.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {inactiveEmployees.map((employee) => (
                      <EmployeeCard key={employee.id} employee={employee} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={selectedEmployee}
        onSave={handleSave}
        isLoading={createEmployee.isPending || updateEmployee.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {employeeToDelete?.name}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
