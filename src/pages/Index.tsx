import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { OrdersTable } from '@/components/dashboard/OrdersTable';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { FileText, Clock, DollarSign, CheckCircle, TrendingUp } from 'lucide-react';
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
  {
    id: '6',
    number: '006',
    client: 'Lucia Ferreira',
    description: 'Janela blindex 4 folhas',
    status: 'cancelled',
    total: 2100.00,
    createdAt: new Date('2024-01-08'),
  },
];

export default function Index() {
  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Bem-vindo de volta! Aqui está o resumo da sua vidraçaria.</p>
          </div>
          <QuickActions />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <MetricCard
            title="Total de Pedidos"
            value={156}
            icon={FileText}
            trend={{ value: 12, isPositive: true }}
            variant="default"
            className="animate-slide-up"
          />
          <MetricCard
            title="Pedidos Pendentes"
            value={23}
            icon={Clock}
            variant="warning"
            className="animate-slide-up [animation-delay:100ms]"
          />
          <MetricCard
            title="Faturamento Mensal"
            value="R$ 45.890"
            icon={DollarSign}
            trend={{ value: 8, isPositive: true }}
            variant="success"
            className="animate-slide-up [animation-delay:200ms]"
          />
          <MetricCard
            title="Concluídos no Mês"
            value={42}
            icon={CheckCircle}
            trend={{ value: 5, isPositive: true }}
            variant="accent"
            className="animate-slide-up [animation-delay:300ms]"
          />
        </div>

        {/* Recent Orders */}
        <div className="animate-slide-up [animation-delay:400ms]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-foreground">Pedidos Recentes</h2>
            <button className="text-sm text-accent hover:text-accent/80 font-medium flex items-center gap-1 transition-colors">
              Ver todos <TrendingUp className="w-4 h-4" />
            </button>
          </div>
          <OrdersTable orders={mockOrders} />
        </div>
      </div>
    </MainLayout>
  );
}
