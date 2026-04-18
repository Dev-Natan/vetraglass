import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import type { ScheduleItem } from '@/components/dashboard/TodaySchedule';
import type { ReceivableItem } from '@/components/dashboard/TodayReceivables';
import type { ExpenseItem } from '@/components/dashboard/TodayExpenses';
import type { OSAttentionItem } from '@/components/dashboard/OSAttentionList';
import type { DayOverviewData, DashboardData } from '@/hooks/useDashboardData';

function getAppointmentTitle(type: string): string {
  const titles: Record<string, string> = {
    measurement: 'Medição',
    installation: 'Instalação',
    delivery: 'Entrega',
    visit: 'Visita',
    maintenance: 'Manutenção',
    other: 'Compromisso',
  };
  return titles[type] || 'Compromisso';
}

export const dashboardService = {
  async fetchTodayAppointments(companyId: string): Promise<ScheduleItem[]> {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: appointments } = await supabase
      .from('service_appointments')
      .select('id, title, customer_name, appointment_type, status, scheduled_time_start, customer_address, ordem_servico_id')
      .eq('company_id', companyId)
      .eq('scheduled_date', today)
      .neq('status', 'cancelled')
      .order('scheduled_time_start', { ascending: true });

    // Also fetch OS with delivery today
    const { data: osDeliveries } = await supabase
      .from('ordens_servico')
      .select('id, os_number, customer_name, status, estimated_end')
      .eq('company_id', companyId)
      .eq('estimated_end', today)
      .in('status', ['pending', 'in_progress']);

    const scheduleItems: ScheduleItem[] = [
      ...(appointments || []).map(apt => ({
        id: apt.id,
        type: 'appointment' as const,
        appointmentType: apt.appointment_type,
        title: apt.title || getAppointmentTitle(apt.appointment_type),
        subtitle: apt.customer_name || apt.customer_address || '',
        time: apt.scheduled_time_start 
          ? format(new Date(`2000-01-01T${apt.scheduled_time_start}`), 'HH:mm')
          : undefined,
        status: apt.status,
        link: apt.ordem_servico_id 
          ? `/ordens-servico/${apt.ordem_servico_id}`
          : '/ordens-servico?tab=calendario',
      })),
      ...(osDeliveries || []).map(os => ({
        id: os.id,
        type: 'os_delivery' as const,
        appointmentType: 'delivery',
        title: `Entrega OS #${String(os.os_number).padStart(4, '0')}`,
        subtitle: os.customer_name || '',
        time: '18:00', // Default delivery time
        status: os.status,
        osNumber: os.os_number,
        link: `/ordens-servico/${os.id}`,
      })),
    ];

    return scheduleItems.sort((a, b) => {
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });
  },

  async fetchTodayReceivables(companyId: string): Promise<ReceivableItem[]> {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('accounts_receivable')
      .select('id, customer_name, description, total_amount, paid_amount, due_date, status')
      .eq('company_id', companyId)
      .in('status', ['pending', 'partial'])
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(20);

    return (data || []).map(item => ({
      id: item.id,
      customer_name: item.customer_name,
      description: item.description,
      total_amount: item.total_amount,
      paid_amount: item.paid_amount || 0,
      due_date: item.due_date,
      status: item.status,
    }));
  },

  async fetchTodayExpenses(companyId: string): Promise<ExpenseItem[]> {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('expenses')
      .select('id, description, category, amount, due_date, status')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(20);

    return (data || []).map(item => ({
      id: item.id,
      description: item.description,
      category: item.category || 'outros',
      amount: item.amount,
      due_date: item.due_date || today,
      status: item.status,
    }));
  },

  async fetchOSAttention(companyId: string): Promise<OSAttentionItem[]> {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('ordens_servico')
      .select('id, os_number, customer_name, status, estimated_end, current_stage')
      .eq('company_id', companyId)
      .in('status', ['pending', 'in_progress'])
      .not('estimated_end', 'is', null)
      .lte('estimated_end', today)
      .order('estimated_end', { ascending: true })
      .limit(10);

    return (data || []).map(os => ({
      id: os.id,
      os_number: os.os_number,
      customer_name: os.customer_name,
      status: os.status,
      estimated_end: os.estimated_end,
      daysOverdue: differenceInDays(new Date(), new Date(os.estimated_end)),
      current_stage: os.current_stage,
    }));
  },

  async getFullDashboardData(companyId: string): Promise<DashboardData> {
    const [
      todaySchedule,
      todayReceivables,
      todayExpenses,
      osAttention,
    ] = await Promise.all([
      this.fetchTodayAppointments(companyId),
      this.fetchTodayReceivables(companyId),
      this.fetchTodayExpenses(companyId),
      this.fetchOSAttention(companyId),
    ]);

    const receivablesTotal = todayReceivables.reduce(
      (sum, r) => sum + ((r.total_amount || 0) - (r.paid_amount || 0)), 0
    );
    const expensesTotal = todayExpenses.reduce(
      (sum, e) => sum + (e.amount || 0), 0
    );

    const dayOverview: DayOverviewData = {
      appointmentsCount: todaySchedule.length,
      receivablesTotal,
      receivablesCount: todayReceivables.length,
      expensesTotal,
      expensesCount: todayExpenses.length,
      osAttentionCount: osAttention.length,
    };

    return {
      dayOverview,
      todaySchedule,
      todayReceivables,
      todayExpenses,
      osAttention,
    };
  }
};
