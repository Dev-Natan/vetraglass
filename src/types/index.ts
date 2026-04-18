export interface Company {
  id: string;
  name: string;
  logo?: string;
  cnpj?: string | null;
}

export interface Order {
  id: string;
  number: string;
  client: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total: number;
  createdAt: Date;
  deliveryDate?: Date;
}

export interface DashboardMetrics {
  totalOrders: number;
  pendingOrders: number;
  monthlyRevenue: number;
  completedThisMonth: number;
}

export * from './financeiro';
export * from './clientes';
export * from './estoque';

