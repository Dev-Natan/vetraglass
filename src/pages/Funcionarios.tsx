import { MainLayout } from '@/components/layout/MainLayout';
import { UserCog, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserCog className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Nenhum funcionário cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cadastre os membros da sua equipe para gerenciar melhor.
            </p>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Cadastrar Primeiro Funcionário
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
