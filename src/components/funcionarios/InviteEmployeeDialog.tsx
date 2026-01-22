import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEmployeeInvites } from '@/hooks/useEmployeeInvites';
import { Employee } from '@/hooks/useEmployees';
import { usePermissionProfiles, PROFILE_TYPE_LABELS, PROFILE_TYPE_DESCRIPTIONS } from '@/hooks/usePermissionProfiles';
import { Mail, Loader2, Shield, Crown, Briefcase, ShoppingCart, Wallet, Package, Factory, Wrench, PiggyBank, Settings } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

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

export function InviteEmployeeDialog({
  open,
  onOpenChange,
  employee,
}: InviteEmployeeDialogProps) {
  const [email, setEmail] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const { createInvite } = useEmployeeInvites();
  const { profiles } = usePermissionProfiles();

  // Reset form when opening
  useEffect(() => {
    if (open && employee) {
      setEmail(employee.email || '');
      // Pre-select employee's current profile if available
      if (employee.permission_profile_id) {
        setSelectedProfileId(employee.permission_profile_id);
      } else {
        // Default to first non-admin profile
        const defaultProfile = profiles.find(p => p.profile_type !== 'admin');
        setSelectedProfileId(defaultProfile?.id || '');
      }
    }
  }, [open, employee, profiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    // Find the selected profile to get its role mapping
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    
    // Map profile_type to app_role
    const roleMapping: Record<string, 'admin' | 'manager' | 'employee'> = {
      admin: 'admin',
      gerente: 'manager',
      vendedor: 'employee',
      caixa: 'employee',
      almoxarifado: 'employee',
      producao: 'employee',
      instalador: 'employee',
      financeiro: 'employee',
      custom: 'employee',
    };

    const role = roleMapping[selectedProfile?.profile_type || 'employee'] || 'employee';

    await createInvite.mutateAsync({
      employeeId: employee.id,
      email,
      role,
      permissionProfileId: selectedProfileId || undefined,
    });

    onOpenChange(false);
    setEmail('');
    setSelectedProfileId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convidar para o Sistema
          </DialogTitle>
          <DialogDescription>
            Envie um convite para <strong>{employee?.name}</strong> acessar o sistema.
            Escolha o perfil de acesso que define quais módulos e ações ele poderá utilizar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do Funcionário</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <Label className="font-medium">Perfil de Acesso</Label>
            </div>
            
            <RadioGroup
              value={selectedProfileId}
              onValueChange={setSelectedProfileId}
              className="grid gap-2"
            >
              {profiles.map((profile) => {
                const Icon = PROFILE_TYPE_ICONS[profile.profile_type] || Settings;
                return (
                  <label
                    key={profile.id}
                    htmlFor={`profile-${profile.id}`}
                    className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedProfileId === profile.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={profile.id} id={`profile-${profile.id}`} />
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        selectedProfileId === profile.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">
                          {profile.name}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {profile.description || PROFILE_TYPE_DESCRIPTIONS[profile.profile_type]}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createInvite.isPending || !selectedProfileId}>
              {createInvite.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar Convite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
