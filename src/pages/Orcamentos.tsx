import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter } from 'lucide-react';

export default function Orcamentos() {
  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-display font-bold text-foreground">Orçamentos</h1>
            <p className="text-muted-foreground mt-1">Gerencie todos os orçamentos da sua vidraçaria.</p>
          </div>
          <Button variant="accent" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Orçamento
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar orçamentos..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>

        {/* Empty State */}
        <div className="glass-card rounded-2xl p-12 text-center animate-slide-up [animation-delay:100ms]">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">
            Nenhum orçamento ainda
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Comece criando seu primeiro orçamento. Você poderá gerenciar todos os orçamentos da sua vidraçaria aqui.
          </p>
          <Button variant="accent" className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Primeiro Orçamento
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
