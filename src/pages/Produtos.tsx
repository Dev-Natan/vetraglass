import { MainLayout } from '@/components/layout/MainLayout';
import { Package, Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const mockProducts = [
  { id: '1', name: 'Vidro Temperado 8mm', category: 'Temperado', price: 180.00, stock: 45, unit: 'm²' },
  { id: '2', name: 'Vidro Laminado 6mm', category: 'Laminado', price: 220.00, stock: 32, unit: 'm²' },
  { id: '3', name: 'Espelho Cristal 4mm', category: 'Espelho', price: 150.00, stock: 28, unit: 'm²' },
  { id: '4', name: 'Box Frontal', category: 'Box', price: 850.00, stock: 12, unit: 'un' },
  { id: '5', name: 'Porta de Vidro 10mm', category: 'Porta', price: 1200.00, stock: 8, unit: 'un' },
];

export default function Produtos() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Package className="w-7 h-7 text-primary" />
              Produtos
            </h1>
            <p className="text-muted-foreground">Gerencie seu catálogo de produtos</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Produto
          </Button>
        </div>

        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar produtos..." className="pl-10" />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Produto</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Categoria</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Preço</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Estoque</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {mockProducts.map((product) => (
                  <tr key={product.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-medium text-foreground">{product.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {product.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      R$ {product.price.toFixed(2)}/{product.unit}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-medium ${product.stock < 15 ? 'text-destructive' : 'text-foreground'}`}>
                        {product.stock} {product.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm">Editar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
