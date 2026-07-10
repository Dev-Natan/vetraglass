import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, UserPlus, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { PermissionProfileSelect } from './PermissionProfileSelect';
import { EmployeePhotoUpload } from './EmployeePhotoUpload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

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
  username?: string | null;
  photo_url?: string | null;
  admission_date?: string | null;
  salary_payment_day?: number | null;
}

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSave: (data: Omit<Employee, 'id'> & { createSystemAccess?: boolean; password?: string }) => Promise<void>;
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
  const { currentCompany } = useAuth();
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
    photo_url: null as string | null,
    admission_date: '' as string,
    salary_payment_day: 5 as number,
    createSystemAccess: false,
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [copiedLogin, setCopiedLogin] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const isNewEmployee = !employee;
  const hasExistingAccess = !!employee?.user_id;
  
  // Get company login token
  const companyToken = (currentCompany as any)?.login_token || '';
  
  // Generate login automatically from first name + company token
  const generatedLogin = useMemo(() => {
    if (!formData.name.trim() || !companyToken) return '';
    const firstName = formData.name.split(' ')[0]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z]/g, ''); // apenas letras
    return `${firstName}${companyToken}`;
  }, [formData.name, companyToken]);

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
        photo_url: employee.photo_url || null,
        admission_date: employee.admission_date || '',
        salary_payment_day: employee.salary_payment_day ?? 5,
        createSystemAccess: false,
        password: '',
        confirmPassword: '',
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
        photo_url: null,
        admission_date: '',
        salary_payment_day: 5,
        createSystemAccess: false,
        password: '',
        confirmPassword: '',
      });
    }
    setPasswordError('');
    setShowPassword(false);
    setCopiedLogin(false);
    setFieldErrors({});
    setTouched({});
  }, [employee, open]);

  const validateFieldValue = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Nome é obrigatório';
        if (value.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres';
        return undefined;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'E-mail inválido (ex: nome@email.com)';
        return undefined;
      case 'phone':
        if (value) {
          const digits = value.replace(/\D/g, '');
          if (digits.length > 0 && digits.length < 10) return 'Telefone deve ter 10 ou 11 dígitos';
        }
        return undefined;
      default:
        return undefined;
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = (formData as any)[field] as string || '';
    const error = validateFieldValue(field, value);
    setFieldErrors(prev => ({ ...prev, [field]: error || '' }));
  };

  const validatePassword = () => {
    if (formData.createSystemAccess) {
      if (!generatedLogin) {
        setPasswordError('Digite o nome do funcionário para gerar o login');
        return false;
      }
      if (!companyToken) {
        setPasswordError('Configure o token de login da empresa nas configurações');
        return false;
      }
      if (!formData.password) {
        setPasswordError('Senha é obrigatória');
        return false;
      }
      if (formData.password.length < 10) {
        setPasswordError('Senha deve ter pelo menos 10 caracteres');
        return false;
      }
      if (!/[A-Z]/.test(formData.password)) {
        setPasswordError('Senha deve conter pelo menos uma letra maiúscula');
        return false;
      }
      if (!/[a-z]/.test(formData.password)) {
        setPasswordError('Senha deve conter pelo menos uma letra minúscula');
        return false;
      }
      if (!/[0-9]/.test(formData.password)) {
        setPasswordError('Senha deve conter pelo menos um número');
        return false;
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        setPasswordError('Senha deve conter pelo menos um caractere especial (!@#$%^&*)');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setPasswordError('As senhas não conferem');
        return false;
      }
    }
    setPasswordError('');
    return true;
  };

  const validateAllFields = (): boolean => {
    const nameError = validateFieldValue('name', formData.name);
    const emailError = validateFieldValue('email', formData.email);
    const phoneError = validateFieldValue('phone', formData.phone);
    const newErrors: Record<string, string> = {};
    if (nameError) newErrors.name = nameError;
    if (emailError) newErrors.email = emailError;
    if (phoneError) newErrors.phone = phoneError;
    setFieldErrors(newErrors);
    setTouched({ name: true, email: true, phone: true });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAllFields()) return;
    if (!validatePassword()) return;

    // Validação: se tem salário, admission_date é obrigatório e payment_day é 1-31
    if (formData.hourly_rate > 0) {
      if (!formData.admission_date) {
        setFieldErrors((prev) => ({ ...prev, admission_date: 'Informe a data de admissão' }));
        return;
      }
      if (!formData.salary_payment_day || formData.salary_payment_day < 1 || formData.salary_payment_day > 31) {
        setFieldErrors((prev) => ({ ...prev, salary_payment_day: 'Dia deve estar entre 1 e 31' }));
        return;
      }
    }

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
      photo_url: formData.photo_url,
      admission_date: formData.hourly_rate > 0 ? (formData.admission_date || null) : (formData.admission_date || null),
      salary_payment_day: formData.hourly_rate > 0 ? formData.salary_payment_day : null,
      createSystemAccess: formData.createSystemAccess,
      username: generatedLogin || null, // Login gerado automaticamente
      password: formData.createSystemAccess ? formData.password : undefined,
    });
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const copyLogin = () => {
    if (generatedLogin) {
      navigator.clipboard.writeText(generatedLogin);
      setCopiedLogin(true);
      setTimeout(() => setCopiedLogin(false), 2000);
    }
  };

  const canCreateAccess = generatedLogin && formData.password && formData.permission_profile_id && !hasExistingAccess && companyToken;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee ? 'Editar Funcionário' : 'Novo Funcionário'}
          </DialogTitle>
          <DialogDescription>
            {employee ? 'Atualize os dados do funcionário' : 'Cadastre um novo funcionário e crie acesso ao sistema'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload Section */}
          <EmployeePhotoUpload
            photoUrl={formData.photo_url}
            employeeName={formData.name}
            employeeId={employee?.id}
            companyId={currentCompany?.id}
            onPhotoChange={(url) => setFormData({ ...formData, photo_url: url })}
            disabled={isLoading}
          />

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (touched.name) {
                  const err = validateFieldValue('name', e.target.value);
                  setFieldErrors(prev => ({ ...prev, name: err || '' }));
                }
              }}
              onBlur={() => handleFieldBlur('name')}
              placeholder="Nome completo"
              className={fieldErrors.name && touched.name ? 'border-destructive' : ''}
              maxLength={100}
            />
            {touched.name && fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (touched.email) {
                    const err = validateFieldValue('email', e.target.value);
                    setFieldErrors(prev => ({ ...prev, email: err || '' }));
                  }
                }}
                onBlur={() => handleFieldBlur('email')}
                placeholder="email@exemplo.com"
                className={fieldErrors.email && touched.email ? 'border-destructive' : ''}
              />
              {touched.email && fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setFormData({ ...formData, phone: formatted });
                  if (touched.phone) {
                    const err = validateFieldValue('phone', formatted);
                    setFieldErrors(prev => ({ ...prev, phone: err || '' }));
                  }
                }}
                onBlur={() => handleFieldBlur('phone')}
                placeholder="(00) 00000-0000"
                maxLength={15}
                className={fieldErrors.phone && touched.phone ? 'border-destructive' : ''}
              />
              {touched.phone && fieldErrors.phone && (
                <p className="text-sm text-destructive">{fieldErrors.phone}</p>
              )}
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

          {/* System Access Section - Auto Generated Login + Password */}
          {!hasExistingAccess && (
            <div className="space-y-3 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="createSystemAccess"
                  checked={formData.createSystemAccess}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, createSystemAccess: checked === true })
                  }
                  disabled={!formData.permission_profile_id || !companyToken}
                />
                <div className="space-y-1">
                  <label
                    htmlFor="createSystemAccess"
                    className={`text-sm font-medium leading-none cursor-pointer flex items-center gap-2 ${
                      !formData.permission_profile_id || !companyToken ? 'text-muted-foreground' : ''
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    Gerar acesso ao sistema
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {!formData.permission_profile_id
                      ? 'Selecione um perfil de acesso para habilitar esta opção'
                      : !companyToken
                      ? 'Configure o token da empresa em Configurações'
                      : 'O login será gerado automaticamente'
                    }
                  </p>
                </div>
              </div>

              {formData.createSystemAccess && (
                <div className="space-y-3 pt-2 border-t border-blue-500/20">
                  {/* Generated Login Display */}
                  <div className="space-y-2">
                    <Label>Login (gerado automaticamente)</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm font-mono">
                        {generatedLogin || 'Digite o nome acima...'}
                      </div>
                      {generatedLogin && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={copyLogin}
                          className="shrink-0"
                        >
                          {copiedLogin ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Formato: {formData.name.split(' ')[0]?.toLowerCase() || 'nome'}{companyToken || 'TOKEN'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Mínimo 10 caracteres"
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Deve conter 10+ caracteres, letra maiúscula, minúscula, número e símbolo.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                  </div>

                  {passwordError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertDescription className="text-xs">{passwordError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}


          {hasExistingAccess && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <Shield className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-400">
                Este funcionário já possui acesso ao sistema{employee?.username ? ` (usuário: ${employee.username})` : ''}.
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
