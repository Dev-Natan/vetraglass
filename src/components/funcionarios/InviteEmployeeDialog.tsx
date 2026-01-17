import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEmployeeInvites } from '@/hooks/useEmployeeInvites';
import { Employee } from '@/hooks/useEmployees';
import { Mail, Loader2 } from 'lucide-react';

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

const roleLabels = {
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Funcionário',
};

const roleDescriptions = {
  admin: 'Acesso total ao sistema',
  manager: 'Pode gerenciar maioria dos recursos',
  employee: 'Acesso limitado conforme permissões',
};

export function InviteEmployeeDialog({
  open,
  onOpenChange,
  employee,
}: InviteEmployeeDialogProps) {
  const [email, setEmail] = useState(employee?.email || '');
  const [role, setRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const { createInvite } = useEmployeeInvites();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    await createInvite.mutateAsync({
      employeeId: employee.id,
      email,
      role,
    });

    onOpenChange(false);
    setEmail('');
    setRole('employee');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convidar para o Sistema
          </DialogTitle>
          <DialogDescription>
            Envie um convite para <strong>{employee?.name}</strong> acessar o sistema.
            Ele receberá um email com instruções para criar sua conta.
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

          <div className="space-y-2">
            <Label htmlFor="role">Nível de Acesso</Label>
            <Select value={role} onValueChange={(v: 'admin' | 'manager' | 'employee') => setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex flex-col">
                      <span>{label}</span>
                      <span className="text-xs text-muted-foreground">
                        {roleDescriptions[value as keyof typeof roleDescriptions]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createInvite.isPending}>
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
