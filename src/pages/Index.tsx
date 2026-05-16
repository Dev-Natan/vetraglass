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
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-slide-up p-8 bg-card rounded-[2.5rem] border border-border/40 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-150" />
          <div className="relative">
            <h1 className="text-4xl font-black text-foreground tracking-tighter capitalize sm:text-5xl">
              {formattedDate}
            </h1>
            <p className="text-muted-foreground text-lg mt-2 font-medium">
              Bom trabalho hoje, <span className="text-primary font-black uppercase tracking-widest text-sm">Vetra System</span>.
            </p>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="px-4 py-2 bg-success/10 text-success text-[10px] font-black tracking-widest rounded-2xl flex items-center gap-2.5 border-2 border-success/20 shadow-lg shadow-success/5 uppercase transition-all hover:bg-success/20">
              <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_hsl(var(--success))]" />
              Conexão Ativa
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
