import { MainLayout } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';
import { DayOverviewCards } from '@/components/dashboard/DayOverviewCards';
import { TodaySchedule } from '@/components/dashboard/TodaySchedule';
import { TodayReceivables } from '@/components/dashboard/TodayReceivables';
import { TodayExpenses } from '@/components/dashboard/TodayExpenses';
import { OSAttentionList } from '@/components/dashboard/OSAttentionList';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskReminders } from '@/hooks/useTaskReminders';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export default function Index() {
  const { currentCompany } = useAuth();
  
  // Ativa lembretes de tarefas próximas (15 min antes)
  useTaskReminders();

  // Hook agregador - todas as queries do dashboard em paralelo
  const { data: dashboardData, isLoading } = useDashboardData();

  const today = new Date();
  const formattedDate = format(today, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header com data */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight capitalize">
              {formattedDate}
            </h1>
            <p className="text-muted-foreground text-base mt-1">
              Bem-vindo ao seu painel de controle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-success/10 text-success text-xs font-bold rounded-full flex items-center gap-2 border border-success/20">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              SISTEMA ONLINE
            </div>
          </div>
        </header>

        {/* Onboarding - só aparece para novos usuários */}
        {currentCompany && <OnboardingChecklist />}

        {currentCompany && (
          <>
            {isLoading ? (
              <DashboardSkeleton />
            ) : (
              <>
                {/* Cards de Resumo do Dia */}
                <section className="animate-fade-in">
                  <DayOverviewCards data={dashboardData?.dayOverview} />
                </section>

                {/* Agenda do Dia */}
                <section className="animate-fade-in">
                  <TodaySchedule items={dashboardData?.todaySchedule} />
                </section>

                {/* Cobranças e Despesas lado a lado */}
                <section className="animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TodayReceivables items={dashboardData?.todayReceivables} />
                    <TodayExpenses items={dashboardData?.todayExpenses} />
                  </div>
                </section>

                {/* OS que precisam de atenção */}
                <section className="animate-fade-in">
                  <OSAttentionList items={dashboardData?.osAttention} />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
