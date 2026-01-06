import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Users } from 'lucide-react';

export default function Clientes() {
  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-display font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">Gerencie sua base de clientes.</p>
          </div>
          <Button variant="accent" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>

        {/* Empty State */}
        <div className="section-card flex flex-col items-center justify-center py-12 text-center animate-slide-up">
          <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-1">Nenhum cliente cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comece cadastrando seus clientes para gerenciar sua base.
          </p>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Cadastrar Primeiro Cliente
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
