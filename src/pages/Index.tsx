import { MainLayout } from '@/components/layout/MainLayout';
import { 
  Plus, 
  ShoppingCart, 
  ClipboardList, 
  FileText,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { FinancialAlerts } from '@/components/dashboard/FinancialAlerts';
import { SalesGoalCard } from '@/components/dashboard/SalesGoalCard';
import { SystemReminders } from '@/components/dashboard/SystemReminders';
import { TodayTasksWidget } from '@/components/dashboard/TodayTasksWidget';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Ações rápidas principais
const quickActions = [
  { 
    icon: ShoppingCart, 
    label: 'Nova Venda', 
    path: '/caixa-vendas?novo=true',
    description: 'Registrar venda no caixa',
    primary: true
  },
  { 
    icon: FileText, 
    label: 'Novo Orçamento', 
    path: '/orcamentos?novo=true',
    description: 'Criar proposta comercial'
  },
  { 
    icon: ClipboardList, 
    label: 'Nova OS', 
    path: '/ordens-servico?novo=true',
    description: 'Abrir ordem de serviço'
  },
];

export default function Index() {
  const { currentCompany } = useAuth();

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Onboarding - só aparece para novos usuários */}
        {currentCompany && <OnboardingChecklist />}

        {/* Ações Rápidas - Seção Principal */}
        <section className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.path}
                className="group"
              >
                <Card className={`h-full transition-all duration-200 hover:shadow-md ${
                  action.primary 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'hover:border-primary/50'
                }`}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                      action.primary 
                        ? 'bg-primary-foreground/20' 
                        : 'bg-primary/10'
                    }`}>
                      <action.icon className={`w-6 h-6 ${
                        action.primary ? 'text-primary-foreground' : 'text-primary'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold ${
                        action.primary ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                        {action.label}
                      </h3>
                      <p className={`text-sm truncate ${
                        action.primary ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}>
                        {action.description}
                      </p>
                    </div>
                    <Plus className={`w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity ${
                      action.primary ? 'text-primary-foreground' : 'text-primary'
                    }`} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* KPIs e Alertas */}
        {currentCompany && (
          <section className="space-y-4 animate-fade-in">
            <DashboardKPIs />
            
            {/* Tarefas e Meta lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TodayTasksWidget />
              <SalesGoalCard />
            </div>

            {/* Lembretes do Sistema */}
            <SystemReminders />
            
            {/* Alertas Financeiros */}
            <FinancialAlerts />
          </section>
        )}

        {/* Gráficos e Atividades */}
        {currentCompany && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
            <SalesChart />
            <RecentActivity />
          </section>
        )}

        {/* Links Rápidos */}
        <section className="animate-slide-up">
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground font-medium">
                  Acesso rápido:
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/clientes" className="gap-1">
                      Clientes <ArrowRight className="w-3 h-3" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/produtos" className="gap-1">
                      Produtos <ArrowRight className="w-3 h-3" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/estoque" className="gap-1">
                      Estoque <ArrowRight className="w-3 h-3" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/financeiro" className="gap-1">
                      Financeiro <ArrowRight className="w-3 h-3" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/relatorios" className="gap-1">
                      Relatórios <ArrowRight className="w-3 h-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}
