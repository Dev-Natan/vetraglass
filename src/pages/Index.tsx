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
  Zap,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { QuickFlowCard } from '@/components/dashboard/QuickFlowCard';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

// Ações secundárias (exceto Nova Venda que é hero)
const secondaryActions = [
  { 
    icon: Plus, 
    label: 'Novo Orçamento', 
    path: '/orcamentos?novo=true',
    colorClass: 'action-card-green'
  },
  { 
    icon: ClipboardList, 
    label: 'Nova OS', 
    path: '/ordens-servico',
    colorClass: 'action-card-purple'
  },
  { 
    icon: Users, 
    label: 'Novo Cliente', 
    path: '/clientes?novo=true',
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
    path: '/caixa-vendas'
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
      <div className="space-y-6">
        {/* Onboarding Checklist - Shows for new users */}
        {currentCompany && <OnboardingChecklist />}

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
          
          {/* Hero Card - Nova Venda */}
          <Link
            to="/caixa-vendas?novo=true"
            className="action-card-hero group mb-4"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">Nova Venda</span>
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Mais usado
                    </Badge>
                  </div>
                  <p className="text-sm text-white/80 mt-0.5">
                    Registrar venda rapidamente no balcão
                  </p>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Link>

          {/* Secondary Actions Grid */}
          <div className="grid grid-cols-3 gap-3">
            {secondaryActions.map((action) => (
              <Link
                key={action.label}
                to={action.path}
                className={action.colorClass}
              >
                <action.icon className="w-5 h-5" />
                <span className="font-medium text-xs sm:text-sm text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Quick Flow Card - Educational */}
        {currentCompany && <QuickFlowCard />}

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
