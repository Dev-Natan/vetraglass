import { MainLayout } from '@/components/layout/MainLayout';
import { 
  Plus, 
  ShoppingCart, 
  ClipboardList, 
  Users,
  FileText,
  TrendingUp,
  Package,
  Boxes,
  DollarSign,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useAuth } from '@/contexts/AuthContext';

const quickActions = [
  { 
    icon: Plus, 
    label: 'Novo Orçamento', 
    path: '/orcamentos/novo',
    colorClass: 'action-card-green'
  },
  { 
    icon: ShoppingCart, 
    label: 'Nova Venda', 
    path: '/vendas/nova',
    colorClass: 'action-card-blue'
  },
  { 
    icon: ClipboardList, 
    label: 'Nova OS', 
    path: '/ordens-servico/nova',
    colorClass: 'action-card-purple'
  },
  { 
    icon: Users, 
    label: 'Novo Cliente', 
    path: '/clientes/novo',
    colorClass: 'action-card-orange'
  },
];

const salesMenuItems = [
  { 
    icon: FileText, 
    label: 'Orçamentos', 
    description: 'Crie e gerencie orçamentos',
    path: '/orcamentos'
  },
  { 
    icon: ShoppingCart, 
    label: 'Vendas', 
    description: 'Finalize vendas e emita notas',
    path: '/vendas'
  },
  { 
    icon: Users, 
    label: 'Clientes', 
    description: 'Gerencie sua carteira de clientes',
    path: '/clientes'
  },
];

const operationsMenuItems = [
  { 
    icon: ClipboardList, 
    label: 'Ordens de Serviço', 
    description: 'Acompanhe as OS em andamento',
    path: '/ordens-servico'
  },
  { 
    icon: Package, 
    label: 'Produtos', 
    description: 'Cadastre e edite produtos',
    path: '/produtos'
  },
  { 
    icon: Boxes, 
    label: 'Estoque', 
    description: 'Controle entradas e saídas',
    path: '/estoque'
  },
];

const financeMenuItems = [
  { 
    icon: DollarSign, 
    label: 'Financeiro', 
    description: 'Contas a pagar e receber',
    path: '/financeiro'
  },
  { 
    icon: TrendingUp, 
    label: 'Relatórios', 
    description: 'Análises e estatísticas',
    path: '/relatorios'
  },
];

export default function Index() {
  const { currentCompany } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* KPIs Section */}
        {currentCompany && (
          <section className="animate-fade-in">
            <DashboardKPIs />
          </section>
        )}

        {/* Quick Actions */}
        <section className="section-card bg-amber-50/50 border-amber-200/50 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg text-foreground">Ações Rápidas</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.path}
                className={action.colorClass}
              >
                <action.icon className="w-6 h-6" />
                <span className="font-medium text-sm">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Charts and Activity Row */}
        {currentCompany && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
            <SalesChart />
            <RecentActivity />
          </section>
        )}

        {/* Sales & Service Section */}
        <section className="animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-display font-semibold text-lg text-foreground">Vendas & Atendimento</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {salesMenuItems.map((item) => (
              <Link key={item.label} to={item.path} className="menu-card">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{item.label}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Operations Section */}
        <section className="animate-slide-up [animation-delay:100ms]">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-display font-semibold text-lg text-foreground">Operações</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {operationsMenuItems.map((item) => (
              <Link key={item.label} to={item.path} className="menu-card">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{item.label}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Finance Section */}
        <section className="animate-slide-up [animation-delay:200ms]">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-display font-semibold text-lg text-foreground">Financeiro</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {financeMenuItems.map((item) => (
              <Link key={item.label} to={item.path} className="menu-card">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{item.label}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
