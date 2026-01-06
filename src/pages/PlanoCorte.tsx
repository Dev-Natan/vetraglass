import { MainLayout } from '@/components/layout/MainLayout';
import { Scissors, Plus, FileDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlanoCorte() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Scissors className="w-7 h-7 text-primary" />
              Plano de Corte
            </h1>
            <p className="text-muted-foreground">Otimização de corte de chapas</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Plano
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-purple/20 flex items-center justify-center">
              <Layers className="w-6 h-6 text-action-purple" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Planos este mês</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-green/20 flex items-center justify-center">
              <Scissors className="w-6 h-6 text-action-green" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">0%</p>
              <p className="text-sm text-muted-foreground">Aproveitamento médio</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileDown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">R$ 0</p>
              <p className="text-sm text-muted-foreground">Economia em sobras</p>
            </div>
          </div>
        </div>

        {/* Cutting Plans */}
        <div className="section-card">
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">Planos Recentes</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Scissors className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Nenhum plano de corte</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie planos de corte para otimizar o uso de chapas.
            </p>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Primeiro Plano
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
