import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, UserPlus, Mail } from 'lucide-react';
import { PermissionProfileSelect } from './PermissionProfileSelect';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  specialty: string | null;
  hourly_rate: number;
  is_active: boolean;
  notes: string | null;
  commission_enabled: boolean;
  commission_percent: number;
  commission_type: string;
  permission_profile_id?: string | null;
  user_id?: string | null;
}

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSave: (data: Omit<Employee, 'id'> & { createSystemAccess?: boolean }) => Promise<void>;
  isLoading: boolean;
}

const roles = [
  { value: 'operador', label: 'Operador' },
  { value: 'vidraceiro', label: 'Vidraceiro' },
  { value: 'instalador', label: 'Instalador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'administrativo', label: 'Administrativo' },
];

const specialties = [
  { value: 'corte', label: 'Corte de Vidro' },
  { value: 'lapidacao', label: 'Lapidação' },
  { value: 'temperado', label: 'Vidro Temperado' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'box', label: 'Box de Banheiro' },
  { value: 'espelho', label: 'Espelhos' },
  { value: 'esquadrias', label: 'Esquadrias de Alumínio' },
  { value: 'geral', label: 'Geral' },
];

export function EmployeeDialog({ open, onOpenChange, employee, onSave, isLoading }: EmployeeDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'operador',
    specialty: '',
    hourly_rate: 0,
    is_active: true,
    notes: '',
    commission_enabled: false,
    commission_percent: 0,
    commission_type: 'sales',
    permission_profile_id: null as string | null,
    createSystemAccess: false,
  });

  const isNewEmployee = !employee;
  const hasExistingAccess = !!employee?.user_id;

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name,
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role,
        specialty: employee.specialty || '',
        hourly_rate: employee.hourly_rate,
        is_active: employee.is_active,
        notes: employee.notes || '',
        commission_enabled: employee.commission_enabled ?? false,
        commission_percent: employee.commission_percent ?? 0,
        commission_type: employee.commission_type || 'sales',
        permission_profile_id: employee.permission_profile_id || null,
        createSystemAccess: false,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'operador',
        specialty: '',
        hourly_rate: 0,
        is_active: true,
        notes: '',
        commission_enabled: false,
        commission_percent: 0,
        commission_type: 'sales',
        permission_profile_id: null,
        createSystemAccess: false,
      });
    }
  }, [employee, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      role: formData.role,
      specialty: formData.specialty || null,
      hourly_rate: formData.hourly_rate,
      is_active: formData.is_active,
      notes: formData.notes || null,
      commission_enabled: formData.commission_enabled,
      commission_percent: formData.commission_percent,
      commission_type: formData.commission_type,
      permission_profile_id: formData.permission_profile_id,
      createSystemAccess: formData.createSystemAccess,
    });
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const canCreateAccess = formData.email && formData.permission_profile_id && !hasExistingAccess;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee ? 'Editar Funcionário' : 'Novo Funcionário'}
          </DialogTitle>
          <DialogDescription>
            {employee ? 'Atualize os dados do funcionário' : 'Cadastre um novo funcionário e opcionalmente crie acesso ao sistema'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidade</Label>
              <Select
                value={formData.specialty}
                onValueChange={(value) => setFormData({ ...formData, specialty: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((spec) => (
                    <SelectItem key={spec.value} value={spec.value}>
                      {spec.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hourly_rate">Valor/Hora (R$)</Label>
            <Input
              id="hourly_rate"
              type="number"
              step="0.01"
              min="0"
              value={formData.hourly_rate}
              onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
              placeholder="0,00"
            />
          </div>

          {/* Permission Profile Section */}
          <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary" />
              <Label className="font-medium text-primary">Perfil de Acesso ao Sistema</Label>
            </div>
            <PermissionProfileSelect
              value={formData.permission_profile_id}
              onChange={(value) => setFormData({ ...formData, permission_profile_id: value })}
            />
            <p className="text-xs text-muted-foreground">
              Define quais módulos e ações o funcionário pode acessar quando logado no sistema.
            </p>
          </div>

          {/* System Access Section */}
          {!hasExistingAccess && (
            <div className="space-y-3 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="createSystemAccess"
                  checked={formData.createSystemAccess}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, createSystemAccess: checked === true })
                  }
                  disabled={!canCreateAccess}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="createSystemAccess"
                    className={`text-sm font-medium leading-none cursor-pointer flex items-center gap-2 ${
                      !canCreateAccess ? 'text-muted-foreground' : ''
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    Criar acesso ao sistema
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {!formData.email 
                      ? 'Preencha o email para habilitar esta opção'
                      : !formData.permission_profile_id
                      ? 'Selecione um perfil de acesso para habilitar esta opção'
                      : 'O funcionário receberá um email para definir sua senha'
                    }
                  </p>
                </div>
              </div>

              {formData.createSystemAccess && formData.email && (
                <Alert className="border-blue-500/30 bg-blue-500/10">
                  <Mail className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Um email será enviado para <strong>{formData.email}</strong> com um link para criar a senha de acesso ao sistema.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {hasExistingAccess && (
            <Alert className="border-green-500/30 bg-green-500/10">
              <Shield className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-xs text-green-700">
                Este funcionário já possui acesso ao sistema.
              </AlertDescription>
            </Alert>
          )}

          {/* Commission Section */}
          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="commission_enabled" className="cursor-pointer font-medium">
                Comissão sobre vendas
              </Label>
              <Switch
                id="commission_enabled"
                checked={formData.commission_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, commission_enabled: checked })}
              />
            </div>
            
            {formData.commission_enabled && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="commission_percent">Percentual (%)</Label>
                  <Input
                    id="commission_percent"
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.commission_percent}
                    onChange={(e) => setFormData({ ...formData, commission_percent: parseFloat(e.target.value) || 0 })}
                    placeholder="5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_type">Tipo</Label>
                  <Select
                    value={formData.commission_type}
                    onValueChange={(value) => setFormData({ ...formData, commission_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sobre vendas</SelectItem>
                      <SelectItem value="profit">Sobre lucro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Anotações sobre o funcionário..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active" className="cursor-pointer">Funcionário ativo</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading || !formData.name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
