import { MainLayout } from '@/components/layout/MainLayout';
import { UserCog, Plus, Search, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const employees = [
  { id: '1', name: 'Carlos Mendes', role: 'Vidraceiro', phone: '(11) 99999-1111', email: 'carlos@vidracaria.com', status: 'ativo' },
  { id: '2', name: 'Roberto Lima', role: 'Instalador', phone: '(11) 99999-2222', email: 'roberto@vidracaria.com', status: 'ativo' },
  { id: '3', name: 'Fernando Souza', role: 'Vidraceiro', phone: '(11) 99999-3333', email: 'fernando@vidracaria.com', status: 'ativo' },
  { id: '4', name: 'Luciana Alves', role: 'Atendente', phone: '(11) 99999-4444', email: 'luciana@vidracaria.com', status: 'ativo' },
  { id: '5', name: 'Marcos Silva', role: 'Entregador', phone: '(11) 99999-5555', email: 'marcos@vidracaria.com', status: 'inativo' },
];

export default function Funcionarios() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <UserCog className="w-7 h-7 text-primary" />
              Funcionários
            </h1>
            <p className="text-muted-foreground">Gerencie sua equipe</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Funcionário
          </Button>
        </div>

        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar funcionários..." className="pl-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => (
              <div key={employee.id} className="menu-card flex-col items-start gap-3">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="font-display font-semibold text-primary">
                      {employee.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{employee.name}</h3>
                    <p className="text-sm text-muted-foreground">{employee.role}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    employee.status === 'ativo' 
                      ? 'bg-action-green/20 text-action-green' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {employee.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="w-full pt-3 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {employee.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {employee.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
