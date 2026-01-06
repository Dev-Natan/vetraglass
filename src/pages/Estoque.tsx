import { MainLayout } from '@/components/layout/MainLayout';
import { Boxes, TrendingDown, TrendingUp, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Estoque() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Boxes className="w-7 h-7 text-primary" />
              Estoque
            </h1>
            <p className="text-muted-foreground">Controle de entradas e saídas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <TrendingDown className="w-4 h-4" />
              Registrar Saída
            </Button>
            <Button className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Registrar Entrada
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock Alerts */}
          <div className="section-card lg:col-span-1">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-destructive" />
              Estoque Baixo
            </h2>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum alerta de estoque</p>
            </div>
          </div>

          {/* Recent Movements */}
          <div className="section-card lg:col-span-2">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4">Movimentações Recentes</h2>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Boxes className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">Nenhuma movimentação</h3>
              <p className="text-sm text-muted-foreground">
                Registre entradas e saídas para acompanhar o estoque.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
