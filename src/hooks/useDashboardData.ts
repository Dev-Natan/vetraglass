import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardService } from '@/services/dashboardService';
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
      return dashboardService.getFullDashboardData(companyId);
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}
