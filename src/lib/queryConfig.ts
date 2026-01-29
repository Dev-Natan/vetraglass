import { QueryClient } from '@tanstack/react-query';

// Optimized cache configuration for scalability
export const CACHE_TIMES = {
  // Data that rarely changes (5 minutes stale, 10 minutes cache)
  STATIC: {
    staleTime: 5 * 60 * 1000,      // 5 minutes
    gcTime: 10 * 60 * 1000,         // 10 minutes (garbage collection)
  },
  
  // Data that changes occasionally (2 minutes stale, 5 minutes cache)
  SEMI_STATIC: {
    staleTime: 2 * 60 * 1000,      // 2 minutes
    gcTime: 5 * 60 * 1000,          // 5 minutes
  },
  
  // Data that changes frequently (30 seconds stale, 2 minutes cache)
  DYNAMIC: {
    staleTime: 30 * 1000,          // 30 seconds
    gcTime: 2 * 60 * 1000,          // 2 minutes
  },
  
  // Real-time data (no stale time, short cache)
  REALTIME: {
    staleTime: 0,
    gcTime: 60 * 1000,              // 1 minute
  },
} as const;

// Query key factories for consistent cache management
export const queryKeys = {
  // Clients
  clients: {
    all: (companyId: string) => ['clients', companyId] as const,
    list: (companyId: string, filters?: Record<string, unknown>) => 
      ['clients', companyId, 'list', filters] as const,
    detail: (clientId: string) => ['clients', 'detail', clientId] as const,
  },
  
  // Quotes
  quotes: {
    all: (companyId: string) => ['quotes', companyId] as const,
    list: (companyId: string, filters?: Record<string, unknown>) => 
      ['quotes', companyId, 'list', filters] as const,
    detail: (quoteId: string) => ['quotes', 'detail', quoteId] as const,
    items: (quoteId: string) => ['quotes', 'items', quoteId] as const,
  },
  
  // Sales
  sales: {
    all: (companyId: string) => ['sales', companyId] as const,
    list: (companyId: string, cashRegisterId?: string) => 
      ['sales', companyId, 'list', cashRegisterId] as const,
    detail: (saleId: string) => ['sales', 'detail', saleId] as const,
    summary: (companyId: string, dateRange?: { start: Date; end: Date }) =>
      ['sales', companyId, 'summary', dateRange] as const,
  },
  
  // Stock
  stock: {
    all: (companyId: string) => ['stock', companyId] as const,
    item: (stockId: string) => ['stock', 'item', stockId] as const,
  },
  
  // Item Templates (global, shared across companies)
  itemTemplates: {
    all: () => ['item-templates'] as const,
    byLinha: (linha: string) => ['item-templates', 'linha', linha] as const,
    byType: (type: string) => ['item-templates', 'type', type] as const,
  },
  
  // Product Templates
  productTemplates: {
    all: () => ['product-templates'] as const,
    byLinha: (linha: string) => ['product-templates', 'linha', linha] as const,
    detail: (templateId: string) => ['product-templates', 'detail', templateId] as const,
  },
  
  // Company Products
  companyProducts: {
    all: (companyId: string) => ['company-products', companyId] as const,
    prices: (companyId: string) => ['company-products', companyId, 'prices'] as const,
  },
  
  // Service Orders
  serviceOrders: {
    all: (companyId: string) => ['service-orders', companyId] as const,
    detail: (orderId: string) => ['service-orders', 'detail', orderId] as const,
  },
  
  // Appointments
  appointments: {
    all: (companyId: string) => ['appointments', companyId] as const,
    byDate: (companyId: string, date: string) => 
      ['appointments', companyId, 'date', date] as const,
  },
  
  // Dashboard/Analytics
  dashboard: {
    summary: (companyId: string) => ['dashboard', companyId, 'summary'] as const,
    financial: (companyId: string, period?: string) => 
      ['dashboard', companyId, 'financial', period] as const,
  },
  
  // Cash Register
  cashRegister: {
    current: (companyId: string) => ['cash-register', companyId, 'current'] as const,
    history: (companyId: string) => ['cash-register', companyId, 'history'] as const,
  },
};

// Create QueryClient with ZERO CACHE - dados sempre frescos do servidor
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // ZERO CACHE: dados sempre considerados desatualizados
        staleTime: 0,
        // ZERO CACHE: sem garbage collection cache
        gcTime: 0,
        // Retry configuration
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // ZERO CACHE: sempre recarregar dados
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}
