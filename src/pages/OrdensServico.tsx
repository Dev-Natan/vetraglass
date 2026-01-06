import { MainLayout } from '@/components/layout/MainLayout';
import { ClipboardList, Plus, Search, Filter, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function OrdensServico() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />
              Ordens de Serviço
            </h1>
            <p className="text-muted-foreground">Acompanhe suas ordens de serviço</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova OS
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-orange/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-action-orange" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-blue/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-action-blue" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-green/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-action-green" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Concluídas (mês)</p>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar OS..." className="pl-10" />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Nenhuma ordem de serviço</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie sua primeira ordem de serviço para começar.
            </p>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Primeira OS
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
