import { MainLayout } from '@/components/layout/MainLayout';
import { Scissors, Plus, Play, FileDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

const cuttingPlans = [
  { id: '1', name: 'Plano #045', glass: 'Temperado 8mm', sheet: '2200x3300mm', pieces: 12, efficiency: 92, status: 'pronto' },
  { id: '2', name: 'Plano #044', glass: 'Laminado 6mm', sheet: '2000x3000mm', pieces: 8, efficiency: 88, status: 'cortando' },
  { id: '3', name: 'Plano #043', glass: 'Temperado 10mm', sheet: '2200x3300mm', pieces: 6, efficiency: 85, status: 'concluido' },
  { id: '4', name: 'Plano #042', glass: 'Espelho 4mm', sheet: '1800x2400mm', pieces: 15, efficiency: 94, status: 'concluido' },
];

const statusConfig = {
  pronto: { label: 'Pronto', className: 'bg-action-orange/20 text-action-orange' },
  cortando: { label: 'Cortando', className: 'bg-action-blue/20 text-action-blue' },
  concluido: { label: 'Concluído', className: 'bg-action-green/20 text-action-green' },
};

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
              <p className="text-2xl font-display font-bold text-foreground">45</p>
              <p className="text-sm text-muted-foreground">Planos este mês</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-green/20 flex items-center justify-center">
              <Scissors className="w-6 h-6 text-action-green" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">89%</p>
              <p className="text-sm text-muted-foreground">Aproveitamento médio</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileDown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">R$ 2.400</p>
              <p className="text-sm text-muted-foreground">Economia em sobras</p>
            </div>
          </div>
        </div>

        {/* Cutting Plans */}
        <div className="section-card">
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">Planos Recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Plano</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vidro</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Chapa</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Peças</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Aproveitamento</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cuttingPlans.map((plan) => {
                  const status = statusConfig[plan.status as keyof typeof statusConfig];
                  return (
                    <tr key={plan.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-primary">{plan.name}</td>
                      <td className="py-3 px-4 text-foreground">{plan.glass}</td>
                      <td className="py-3 px-4 text-muted-foreground">{plan.sheet}</td>
                      <td className="py-3 px-4 text-foreground">{plan.pieces}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                            <div 
                              className="h-full bg-action-green rounded-full"
                              style={{ width: `${plan.efficiency}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-foreground">{plan.efficiency}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Play className="w-3 h-3" />
                            Ver
                          </Button>
                          <Button variant="ghost" size="sm">
                            <FileDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
