import { MainLayout } from '@/components/layout/MainLayout';
import { OrdersTable } from '@/components/dashboard/OrdersTable';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter } from 'lucide-react';
import { Order } from '@/types';

const mockOrders: Order[] = [
  {
    id: '1',
    number: '001',
    client: 'João Silva',
    description: 'Box de vidro temperado para banheiro 8mm',
    status: 'completed',
    total: 2450.00,
    createdAt: new Date('2024-01-10'),
  },
  {
    id: '2',
    number: '002',
    client: 'Maria Santos',
    description: 'Espelho bisotado para sala 150x100cm',
    status: 'in_progress',
    total: 890.00,
    createdAt: new Date('2024-01-12'),
  },
  {
    id: '3',
    number: '003',
    client: 'Pedro Oliveira',
    description: 'Porta de correr em vidro laminado',
    status: 'pending',
    total: 3200.00,
    createdAt: new Date('2024-01-14'),
  },
  {
    id: '4',
    number: '004',
    client: 'Ana Costa',
    description: 'Guarda-corpo em vidro temperado 10mm',
    status: 'in_progress',
    total: 4800.00,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '5',
    number: '005',
    client: 'Carlos Mendes',
    description: 'Prateleiras de vidro para cozinha',
    status: 'pending',
    total: 650.00,
    createdAt: new Date('2024-01-16'),
  },
];

export default function Pedidos() {
  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-display font-bold text-foreground">Pedidos</h1>
            <p className="text-muted-foreground mt-1">Acompanhe todos os pedidos em andamento.</p>
          </div>
          <Button variant="accent" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Pedido
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar pedidos..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>

        {/* Orders Table */}
        <div className="animate-slide-up [animation-delay:100ms]">
          <OrdersTable orders={mockOrders} />
        </div>
      </div>
    </MainLayout>
  );
}
