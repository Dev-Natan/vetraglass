import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';

// Types for dashboard data
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

export interface DashboardData {
  osStats: OSStats;
  materialsStats: MaterialsStats;
  receivablesStats: ReceivablesStats;
  financialOSData: FinancialOSData;
  blockedOrders: BlockedOS[];
  purchaseSummary: PurchaseSummary;
  financialAlerts: FinancialAlertsData;
  osDueToday: OSItem[];
  todayTasks: TodayTask[];
  productionFlow: ChartDataPoint[];
  revenueVsCost: ChartDataPoint[];
  recentActivity: ActivityItem[];
}

// Fetch functions
async function fetchOSStats(companyId: string): Promise<OSStats> {
  const hoje = new Date().toISOString().split('T')[0];
  
  const [totalResult, inProgressResult, overdueResult] = await Promise.all([
    supabase
      .from('ordens_servico')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['pending', 'in_progress']),
    supabase
      .from('ordens_servico')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'in_progress'),
    supabase
      .from('ordens_servico')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['pending', 'in_progress'])
      .not('estimated_end', 'is', null)
      .lt('estimated_end', hoje),
  ]);

  return {
    total: totalResult.count || 0,
    inProgress: inProgressResult.count || 0,
    overdue: overdueResult.count || 0,
  };
}

async function fetchMaterialsStats(companyId: string): Promise<MaterialsStats> {
  const { data: pendingPOs } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('company_id', companyId)
    .in('status', ['pending', 'ordered', 'partial']);

  if (!pendingPOs || pendingPOs.length === 0) {
    return { pending: 0, urgentOrders: 0 };
  }

  const poIds = pendingPOs.map(po => po.id);
  const { count } = await supabase
    .from('purchase_order_items')
    .select('*', { count: 'exact', head: true })
    .in('purchase_order_id', poIds)
    .eq('status', 'pending');

  const urgentOrders = pendingPOs.filter(po => po.status === 'pending').length;

  return { pending: count || 0, urgentOrders };
}

async function fetchReceivablesStats(companyId: string): Promise<ReceivablesStats> {
  const { data } = await supabase
    .from('accounts_receivable')
    .select('total_amount, paid_amount')
    .eq('company_id', companyId)
    .not('ordem_servico_id', 'is', null)
    .in('status', ['pending', 'partial']);

  const total = data?.reduce(
    (acc, ar) => acc + ((ar.total_amount || 0) - (ar.paid_amount || 0)),
    0
  ) || 0;

  return { total, count: data?.length || 0 };
}

async function fetchFinancialOSData(companyId: string): Promise<FinancialOSData> {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [depositsResult, receivablesResult, pendingReceivablesResult, expensesResult, completedOSResult] = await Promise.all([
    supabase
      .from('quote_deposits')
      .select('amount')
      .eq('company_id', companyId)
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString()),
    supabase
      .from('accounts_receivable')
      .select('paid_amount')
      .eq('company_id', companyId)
      .not('ordem_servico_id', 'is', null)
      .gte('paid_date', format(monthStart, 'yyyy-MM-dd'))
      .lte('paid_date', format(monthEnd, 'yyyy-MM-dd')),
    supabase
      .from('accounts_receivable')
      .select('total_amount, paid_amount')
      .eq('company_id', companyId)
      .not('ordem_servico_id', 'is', null)
      .in('status', ['pending', 'partial']),
    supabase
      .from('expenses')
      .select('amount')
      .eq('company_id', companyId)
      .eq('status', 'paid')
      .gte('paid_date', format(monthStart, 'yyyy-MM-dd'))
      .lte('paid_date', format(monthEnd, 'yyyy-MM-dd')),
    supabase
      .from('ordens_servico')
      .select('id, total_amount')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('updated_at', monthStart.toISOString())
      .lte('updated_at', monthEnd.toISOString()),
  ]);

  const receivedFromDeposits = (depositsResult.data || []).reduce((sum, d) => sum + (d.amount || 0), 0);
  const receivedFromPayments = (receivablesResult.data || []).reduce((sum, r) => sum + (r.paid_amount || 0), 0);
  const totalReceived = receivedFromDeposits + receivedFromPayments;

  const toReceive = (pendingReceivablesResult.data || []).reduce((sum, r) => {
    return sum + ((r.total_amount || 0) - (r.paid_amount || 0));
  }, 0);

  const totalExpenses = (expensesResult.data || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const completedRevenue = (completedOSResult.data || []).reduce((sum, os) => sum + (os.total_amount || 0), 0);
  const estimatedCosts = completedRevenue * 0.5;
  const realProfit = completedRevenue - estimatedCosts;

  return {
    received: totalReceived,
    toReceive,
    productionCosts: totalExpenses,
    realProfit,
    completedCount: completedOSResult.data?.length || 0,
  };
}

async function fetchBlockedOrders(companyId: string): Promise<BlockedOS[]> {
  const { data: pendingPOs } = await supabase
    .from('purchase_orders')
    .select('id, ordem_servico_id, status')
    .eq('company_id', companyId)
    .not('ordem_servico_id', 'is', null)
    .in('status', ['pending', 'ordered', 'partial']);

  if (!pendingPOs || pendingPOs.length === 0) return [];

  const osMap = new Map<string, number>();
  
  for (const po of pendingPOs) {
    if (po.ordem_servico_id) {
      const { count } = await supabase
        .from('purchase_order_items')
        .select('*', { count: 'exact', head: true })
        .eq('purchase_order_id', po.id)
        .eq('status', 'pending');
      
      const current = osMap.get(po.ordem_servico_id) || 0;
      osMap.set(po.ordem_servico_id, current + (count || 0));
    }
  }

  if (osMap.size === 0) return [];

  const osIds = Array.from(osMap.keys());
  const { data: orders } = await supabase
    .from('ordens_servico')
    .select('id, os_number, customer_name')
    .in('id', osIds)
    .in('status', ['pending', 'in_progress']);

  return (orders || [])
    .filter(os => (osMap.get(os.id) || 0) > 0)
    .map(os => ({
      id: os.id,
      os_number: os.os_number,
      customer_name: os.customer_name,
      pendingMaterials: osMap.get(os.id) || 0,
    }));
}

async function fetchPurchaseSummary(companyId: string): Promise<PurchaseSummary> {
  const { data: orders } = await supabase
    .from('purchase_orders')
    .select('id, status, created_at, expected_delivery')
    .eq('company_id', companyId)
    .in('status', ['pending', 'ordered', 'partial']);

  const pending = orders?.filter(o => o.status === 'pending').length || 0;
  const ordered = orders?.filter(o => o.status === 'ordered').length || 0;
  const partial = orders?.filter(o => o.status === 'partial').length || 0;

  const oldestOrder = orders?.length 
    ? orders.reduce((oldest, current) => 
        new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest
      ).created_at
    : null;

  const today = new Date().toISOString().split('T')[0];
  const urgentOrders = orders?.filter(o => 
    o.expected_delivery && o.expected_delivery <= today && o.status !== 'received'
  ).length || 0;

  const orderIds = orders?.map(o => o.id) || [];
  let totalItems = 0;
  
  if (orderIds.length > 0) {
    const { count } = await supabase
      .from('purchase_order_items')
      .select('*', { count: 'exact', head: true })
      .in('purchase_order_id', orderIds)
      .eq('status', 'pending');
    
    totalItems = count || 0;
  }

  return { pending, ordered, partial, totalItems, oldestOrder, urgentOrders };
}

async function fetchFinancialAlerts(companyId: string): Promise<FinancialAlertsData> {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const [expensesResult, overdueResult, receivablesTodayResult] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, description, amount, due_date, category')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .eq('due_date', todayStr)
      .order('amount', { ascending: false }),
    supabase
      .from('accounts_receivable')
      .select('id, customer_name, description, total_amount, due_date, status')
      .eq('company_id', companyId)
      .in('status', ['pending', 'partial'])
      .lt('due_date', todayStr)
      .order('due_date', { ascending: true }),
    supabase
      .from('accounts_receivable')
      .select('id, total_amount')
      .eq('company_id', companyId)
      .in('status', ['pending', 'partial'])
      .eq('due_date', todayStr),
  ]);

  const expensesTotal = (expensesResult.data || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const overdueTotal = (overdueResult.data || []).reduce((sum, rec) => sum + (rec.total_amount || 0), 0);
  const receivablesTodayTotal = (receivablesTodayResult.data || []).reduce((sum, rec) => sum + (rec.total_amount || 0), 0);

  return {
    expensesDueToday: { count: expensesResult.data?.length || 0, total: expensesTotal, items: expensesResult.data || [] },
    overdueReceivables: { count: overdueResult.data?.length || 0, total: overdueTotal, items: overdueResult.data || [] },
    receivablesDueToday: { count: receivablesTodayResult.data?.length || 0, total: receivablesTodayTotal },
  };
}

async function fetchOSDueToday(companyId: string): Promise<OSItem[]> {
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
    ...os,
    daysOverdue: differenceInDays(new Date(), new Date(os.estimated_end)),
  }));
}

async function fetchTodayTasks(companyId: string): Promise<TodayTask[]> {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [osResult, appointmentsResult] = await Promise.all([
    supabase
      .from('ordens_servico')
      .select('id, os_number, customer_name, status, priority, estimated_end, current_stage')
      .eq('company_id', companyId)
      .in('status', ['pending', 'in_progress'])
      .eq('estimated_end', today)
      .order('priority', { ascending: true })
      .limit(10),
    supabase
      .from('service_appointments')
      .select('id, title, customer_name, appointment_type, status, scheduled_time_start, scheduled_time_end, customer_address')
      .eq('company_id', companyId)
      .eq('scheduled_date', today)
      .neq('status', 'cancelled')
      .order('scheduled_time_start', { ascending: true })
      .limit(10),
  ]);

  const tasks: TodayTask[] = [
    ...(appointmentsResult.data || []).map((apt) => ({
      id: apt.id,
      type: 'appointment' as const,
      title: apt.title || apt.customer_name || 'Agendamento',
      subtitle: apt.appointment_type === 'delivery' 
        ? `Entrega - ${apt.customer_address || 'Endereço não informado'}`
        : apt.appointment_type === 'measurement'
          ? `Medição - ${apt.customer_name || ''}`
          : apt.customer_name || '',
      time: apt.scheduled_time_start 
        ? format(new Date(`2000-01-01T${apt.scheduled_time_start}`), 'HH:mm')
        : undefined,
      status: apt.status,
    })),
    ...(osResult.data || []).map((os) => ({
      id: os.id,
      type: 'os' as const,
      title: `OS #${os.os_number}`,
      subtitle: os.customer_name || 'Cliente não informado',
      status: os.status,
      priority: os.priority,
    })),
  ];

  tasks.sort((a, b) => {
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  });

  return tasks;
}

async function fetchProductionFlow(companyId: string): Promise<ChartDataPoint[]> {
  const today = new Date();
  const days: ChartDataPoint[] = [];
  
  // Batch all queries in parallel using Promise.all
  const dayQueries = [];
  for (let i = 6; i >= 0; i--) {
    const day = subDays(today, i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    
    dayQueries.push({
      day,
      openedQuery: supabase
        .from('ordens_servico')
        .select('id')
        .eq('company_id', companyId)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString()),
      completedQuery: supabase
        .from('ordens_servico')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('updated_at', dayStart.toISOString())
        .lte('updated_at', dayEnd.toISOString()),
    });
  }
  
  const results = await Promise.all(
    dayQueries.flatMap(q => [q.openedQuery, q.completedQuery])
  );
  
  const { ptBR } = await import('date-fns/locale/pt-BR');
  
  for (let i = 0; i < dayQueries.length; i++) {
    const day = dayQueries[i].day;
    const opened = results[i * 2].data;
    const completed = results[i * 2 + 1].data;
    
    days.push({
      date: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEE', { locale: ptBR }),
      abertas: opened?.length || 0,
      finalizadas: completed?.length || 0,
    });
  }

  return days;
}

async function fetchRevenueVsCost(companyId: string): Promise<ChartDataPoint[]> {
  const today = new Date();
  const days: ChartDataPoint[] = [];
  
  // Batch all queries in parallel
  const dayQueries = [];
  for (let i = 6; i >= 0; i--) {
    const day = subDays(today, i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    
    dayQueries.push({
      day,
      query: supabase
        .from('cash_movements')
        .select('amount, type')
        .eq('company_id', companyId)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString()),
    });
  }
  
  const results = await Promise.all(dayQueries.map(q => q.query));
  const { ptBR } = await import('date-fns/locale/pt-BR');
  
  for (let i = 0; i < dayQueries.length; i++) {
    const day = dayQueries[i].day;
    const movements = results[i].data || [];
    
    const receita = movements
      .filter(m => m.type === 'entrada')
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    
    const custo = movements
      .filter(m => m.type === 'saida')
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    
    days.push({
      date: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEE', { locale: ptBR }),
      receita,
      custo,
    });
  }

  return days;
}

async function fetchRecentActivity(companyId: string): Promise<ActivityItem[]> {
  const [salesResult, quotesResult, ordersResult] = await Promise.all([
    supabase
      .from('sales')
      .select('id, sale_number, customer_name, total_amount, payment_status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('quotes')
      .select('id, quote_number, customer_name, final_amount, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('ordens_servico')
      .select('id, os_number, customer_name, total_amount, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const items: ActivityItem[] = [
    ...(salesResult.data || []).map(s => ({
      id: s.id,
      type: 'sale' as const,
      title: `Venda #${String(s.sale_number).padStart(4, '0')}`,
      subtitle: s.customer_name || 'Cliente não informado',
      status: s.payment_status,
      value: s.total_amount,
      timestamp: s.created_at,
    })),
    ...(quotesResult.data || []).map(q => ({
      id: q.id,
      type: 'quote' as const,
      title: `Orçamento #${String(q.quote_number).padStart(4, '0')}`,
      subtitle: q.customer_name,
      status: q.status,
      value: q.final_amount,
      timestamp: q.created_at,
    })),
    ...(ordersResult.data || []).map(o => ({
      id: o.id,
      type: 'order' as const,
      title: `OS #${String(o.os_number).padStart(4, '0')}`,
      subtitle: o.customer_name,
      status: o.status,
      value: o.total_amount,
      timestamp: o.created_at,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);
}

// Main hook
export function useDashboardData() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['dashboard-all-data', companyId],
    queryFn: async (): Promise<DashboardData> => {
      if (!companyId) {
        throw new Error('No company selected');
      }

      // Execute ALL queries in parallel
      const [
        osStats,
        materialsStats,
        receivablesStats,
        financialOSData,
        blockedOrders,
        purchaseSummary,
        financialAlerts,
        osDueToday,
        todayTasks,
        productionFlow,
        revenueVsCost,
        recentActivity,
      ] = await Promise.all([
        fetchOSStats(companyId),
        fetchMaterialsStats(companyId),
        fetchReceivablesStats(companyId),
        fetchFinancialOSData(companyId),
        fetchBlockedOrders(companyId),
        fetchPurchaseSummary(companyId),
        fetchFinancialAlerts(companyId),
        fetchOSDueToday(companyId),
        fetchTodayTasks(companyId),
        fetchProductionFlow(companyId),
        fetchRevenueVsCost(companyId),
        fetchRecentActivity(companyId),
      ]);

      return {
        osStats,
        materialsStats,
        receivablesStats,
        financialOSData,
        blockedOrders,
        purchaseSummary,
        financialAlerts,
        osDueToday,
        todayTasks,
        productionFlow,
        revenueVsCost,
        recentActivity,
      };
    },
    enabled: !!companyId,
    staleTime: 0,
    gcTime: 0,
  });
}
