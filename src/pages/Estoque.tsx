import { MainLayout } from '@/components/layout/MainLayout';
import { Boxes, Plus, TrendingDown, TrendingUp, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stockMovements = [
  { id: '1', product: 'Vidro Temperado 8mm', type: 'entrada', quantity: 20, date: '2024-01-15', unit: 'm²' },
  { id: '2', product: 'Espelho Cristal 4mm', type: 'saida', quantity: 5, date: '2024-01-15', unit: 'm²' },
  { id: '3', product: 'Box Frontal', type: 'saida', quantity: 2, date: '2024-01-14', unit: 'un' },
  { id: '4', product: 'Vidro Laminado 6mm', type: 'entrada', quantity: 15, date: '2024-01-14', unit: 'm²' },
];

const lowStockItems = [
  { name: 'Porta de Vidro 10mm', current: 8, minimum: 10 },
  { name: 'Box Frontal', current: 12, minimum: 15 },
  { name: 'Ferragem Inox', current: 25, minimum: 30 },
];

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
            <div className="space-y-3">
              {lowStockItems.map((item, index) => (
                <div key={index} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="font-medium text-foreground text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Atual: <span className="text-destructive font-medium">{item.current}</span> / Mínimo: {item.minimum}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Movements */}
          <div className="section-card lg:col-span-2">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4">Movimentações Recentes</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Produto</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Quantidade</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMovements.map((movement) => (
                    <tr key={movement.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{movement.product}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          movement.type === 'entrada' 
                            ? 'bg-action-green/20 text-action-green' 
                            : 'bg-destructive/20 text-destructive'
                        }`}>
                          {movement.type === 'entrada' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {movement.type === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground">{movement.quantity} {movement.unit}</td>
                      <td className="py-3 px-4 text-muted-foreground">{movement.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
