import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import type { ScheduleItem } from '@/components/dashboard/TodaySchedule';
import type { ReceivableItem } from '@/components/dashboard/TodayReceivables';
import type { ExpenseItem } from '@/components/dashboard/TodayExpenses';
import type { OSAttentionItem } from '@/components/dashboard/OSAttentionList';

// Types for dashboard data - simplified for daily focus
export interface DayOverviewData {
  appointmentsCount: number;
  receivablesTotal: number;
  receivablesCount: number;
  expensesTotal: number;
  expensesCount: number;
  osAttentionCount: number;
}

export interface DashboardData {
  dayOverview: DayOverviewData;
  todaySchedule: ScheduleItem[];
  todayReceivables: ReceivableItem[];
  todayExpenses: ExpenseItem[];
  osAttention: OSAttentionItem[];
}

// Legacy types - kept for compatibility with other components
export interface OSStats {
  total: number;
  inProgress: number;
  overdue: number;
}

export interface MaterialsStats {
  pending: number;
  urgentOrders: number;
}

export interface ReceivablesStats {
  total: number;
  count: number;
}

export interface FinancialOSData {
  received: number;
  toReceive: number;
  productionCosts: number;
  realProfit: number;
  completedCount: number;
}

export interface BlockedOS {
  id: string;
  os_number: number;
  customer_name: string;
  pendingMaterials: number;
}

export interface PurchaseSummary {
  pending: number;
  ordered: number;
  partial: number;
  totalItems: number;
  oldestOrder: string | null;
  urgentOrders: number;
}

export interface FinancialAlertsData {
  expensesDueToday: { count: number; total: number; items: any[] };
  overdueReceivables: { count: number; total: number; items: any[] };
  receivablesDueToday: { count: number; total: number };
}

export interface OSItem {
  id: string;
  os_number: number;
  customer_name: string;
  status: string;
  estimated_end: string;
  daysOverdue: number;
  current_stage: string | null;
}

export interface TodayTask {
  id: string;
  type: 'os' | 'appointment';
  title: string;
  subtitle: string;
  time?: string;
  status: string;
  priority?: string;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  abertas?: number;
  finalizadas?: number;
  receita?: number;
  custo?: number;
}

export interface ActivityItem {
  id: string;
  type: 'sale' | 'quote' | 'order';
  title: string;
  subtitle: string;
  status: string;
  value: number;
  timestamp: string;
}

// Fetch today's appointments
async function fetchTodayAppointments(companyId: string): Promise<ScheduleItem[]> {
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

  // Sort by time
  return scheduleItems.sort((a, b) => {
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  });
}

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

// Fetch today's receivables (due today or overdue)
async function fetchTodayReceivables(companyId: string): Promise<ReceivableItem[]> {
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
}

// Fetch today's expenses (due today or overdue)
async function fetchTodayExpenses(companyId: string): Promise<ExpenseItem[]> {
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
}

// Fetch OS that need attention (overdue or due today)
async function fetchOSAttention(companyId: string): Promise<OSAttentionItem[]> {
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
}

// Main hook
export function useDashboardData() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['dashboard-daily-data', companyId],
    queryFn: async (): Promise<DashboardData> => {
      if (!companyId) {
        throw new Error('No company selected');
      }

      // Execute ALL queries in parallel
      const [
        todaySchedule,
        todayReceivables,
        todayExpenses,
        osAttention,
      ] = await Promise.all([
        fetchTodayAppointments(companyId),
        fetchTodayReceivables(companyId),
        fetchTodayExpenses(companyId),
        fetchOSAttention(companyId),
      ]);

      // Calculate day overview totals
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
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}
