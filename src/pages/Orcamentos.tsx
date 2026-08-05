import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFinanceRealtime } from '@/hooks/useFinanceRealtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { NovoRecebimentoDialog, type PartialSaleTarget } from '@/components/caixa/NovoRecebimentoDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NovoOrcamentoDialog } from '@/components/orcamentos/NovoOrcamentoDialog';
import { VisualizarOrcamentoDialog } from '@/components/orcamentos/VisualizarOrcamentoDialog';
import { EditarContratoDialog } from '@/components/orcamentos/EditarContratoDialog';
import { AprovarOrcamentoDialog } from '@/components/orcamentos/AprovarOrcamentoDialog';

import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PeriodFilter = 'all' | '7d' | '30d' | 'this_month' | 'last_month';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

import { useQuotes } from '@/hooks/useQuotes';
import { Quote, QuoteStatus, quoteService } from '@/services/quoteService';
import { QuoteCard } from '@/components/orcamentos/QuoteCard';
import { QuotesTableView } from '@/components/orcamentos/QuotesTableView';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ViewMode = 'grid' | 'list';

const statusConfig: Record<QuoteStatus, { label: string; icon: any; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' },
  approved: { label: 'Aprovado', icon: CheckCircle, variant: 'default' },
  converted: { label: 'Convertido', icon: CheckCircle, variant: 'default' },
  rejected: { label: 'Rejeitado', icon: XCircle, variant: 'destructive' },
  expired: { label: 'Expirado', icon: AlertCircle, variant: 'outline' },
};

export default function Orcamentos() {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Ativa sincronização em tempo real para o módulo financeiro e orçamentos
  useFinanceRealtime();

  // Inscrição Realtime específica para orçamentos e vendas na página de listagem
  useEffect(() => {
    if (!currentCompany?.id) return;

    const channel = supabase
      .channel('quotes-list-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes', filter: `company_id=eq.${currentCompany.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['quotes', currentCompany.id] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales', filter: `company_id=eq.${currentCompany.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['quote-sales-financials', currentCompany.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);
  
  useModuleTutorialTrigger('orcamentos');
  
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>(
    () => (searchParams.get('status') as QuoteStatus | 'all') || 'pending'
  );
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(
    () => (searchParams.get('period') as PeriodFilter) || 'all'
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (searchParams.get('view') as ViewMode) || (typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'list')
  );

  // Persist filters in URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    statusFilter && statusFilter !== 'pending' ? next.set('status', statusFilter) : next.delete('status');
    periodFilter && periodFilter !== 'all' ? next.set('period', periodFilter) : next.delete('period');
    searchTerm ? next.set('q', searchTerm) : next.delete('q');
    viewMode ? next.set('view', viewMode) : next.delete('view');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, periodFilter, searchTerm, viewMode]);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [contractItems, setContractItems] = useState<any[]>([]);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [approveQuoteItems, setApproveQuoteItems] = useState<any[]>([]);
  
  const [quoteToCancelApproved, setQuoteToCancelApproved] = useState<Quote | null>(null);
  const [saleForReceipt, setSaleForReceipt] = useState<PartialSaleTarget | null>(null);
  const [novoRecebimentoOpen, setNovoRecebimentoOpen] = useState(false);

  const {
    quotes,
    isLoading,
    deleteQuote,
    updateStatus,
    cancelApproved,
    duplicateQuote
  } = useQuotes(currentCompany?.id);

  // Fetch sales linked to the company's quotes to detect partial payment status
  const { data: quoteSales = [] } = useQuery({
    queryKey: ['quote-sales-financials', currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, sale_number, quote_id, ordem_servico_id, customer_name, total_amount, paid_amount, pending_amount')
        .eq('company_id', currentCompany!.id)
        .or('pending_amount.gt.0.01,payment_status.eq.partial');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const salesByQuoteId = useMemo(() => {
    const map = new Map<string, PartialSaleTarget & { isPartial: boolean }>();
    for (const s of quoteSales) {
      if (!s.quote_id) continue;
      const total = Number(s.total_amount) || 0;
      const paid = Number(s.paid_amount ?? 0);
      const pending = Number(s.pending_amount ?? Math.max(0, total - paid));
      const isPartial = paid > 0 && pending > 0.01;
      // Prefer the record with a partial balance; otherwise keep the latest
      const existing = map.get(s.quote_id);
      if (!existing || (isPartial && !existing.isPartial)) {
        map.set(s.quote_id, {
          id: s.id,
          sale_number: s.sale_number,
          customer_name: s.customer_name,
          total_amount: total,
          paid_amount: paid,
          pending_amount: pending,
          quote_id: s.quote_id,
          ordem_servico_id: s.ordem_servico_id ?? null,
          isPartial,
        });
      }
    }
    return map;
  }, [quoteSales]);

  const handleNewReceipt = (quote: Quote) => {
    const target = salesByQuoteId.get(quote.id);
    if (!target) {
      toast({
        title: 'Sem venda vinculada',
        description: 'Este orçamento ainda não possui uma venda com saldo em aberto.',
        variant: 'destructive',
      });
      return;
    }
    const { isPartial, ...saleTarget } = target;
    setSaleForReceipt(saleTarget);
    setNovoRecebimentoOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('novo') === 'true') {
      setIsNewDialogOpen(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const quoteId = searchParams.get('id');
    if (quoteId && quotes && quotes.length > 0) {
      const foundQuote = quotes.find(q => q.id === quoteId);
      if (foundQuote) {
        setSelectedQuote(foundQuote);
        setIsViewDialogOpen(true);
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, quotes]);

  const handleEdit = (quote: Quote) => {
    if (quote.status === 'approved' || quote.status === 'converted') {
      toast({ 
        title: 'Não é possível editar', 
        description: 'Orçamentos aprovados não podem ser editados. Reabra como pendente primeiro.',
        variant: 'destructive' 
      });
      return;
    }
    setSelectedQuote(quote);
    setIsDuplicating(false);
    setIsNewDialogOpen(true);
  };

  const handleDuplicate = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDuplicating(true);
    setIsNewDialogOpen(true);
  };


  const handleReopen = async (quote: Quote) => {
    await updateStatus({ id: quote.id, status: 'pending' });
  };

  const handleReject = async (quote: Quote) => {
    await updateStatus({ id: quote.id, status: 'rejected' });
  };

  const handleCancelApprovedAction = async (quote: Quote) => {
    await cancelApproved(quote.id);
    setQuoteToCancelApproved(null);
    setStatusFilter('pending');
  };

  const handleApprove = async (quote: Quote) => {
    const items = await quoteService.fetchQuoteItems(quote.id);
    setApproveQuoteItems(items || []);
    setSelectedQuote(quote);
    setIsApproveDialogOpen(true);
  };

  const handleGenerateContract = async (quote: Quote) => {
    const items = await quoteService.fetchQuoteItems(quote.id);
    setContractItems(items || []);
    setSelectedQuote(quote);
    setIsContractDialogOpen(true);
  };

  const getPeriodRange = (p: PeriodFilter): { start: Date | null; end: Date | null } => {
    const now = new Date();
    if (p === 'all') return { start: null, end: null };
    if (p === '7d') {
      const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0,0,0,0);
      return { start: s, end: null };
    }
    if (p === '30d') {
      const s = new Date(now); s.setDate(s.getDate() - 30); s.setHours(0,0,0,0);
      return { start: s, end: null };
    }
    if (p === 'this_month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end: null };
    }
    // last_month
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: s, end: e };
  };

  const { start: periodStart, end: periodEnd } = getPeriodRange(periodFilter);

  const filteredQuotes = quotes?.filter(quote => {
    const matchesSearch = quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number.toString().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    let matchesPeriod = true;
    if (periodStart || periodEnd) {
      const created = quote.created_at ? new Date(quote.created_at) : null;
      if (!created || isNaN(created.getTime())) {
        matchesPeriod = false;
      } else {
        if (periodStart && created < periodStart) matchesPeriod = false;
        if (periodEnd && created >= periodEnd) matchesPeriod = false;
      }
    }
    return matchesSearch && matchesStatus && matchesPeriod;
  }) || [];

  const statusCounts = {
    all: quotes?.length || 0,
    pending: quotes?.filter(q => q.status === 'pending').length || 0,
    approved: quotes?.filter(q => q.status === 'approved').length || 0,
    converted: quotes?.filter(q => q.status === 'converted').length || 0,
    rejected: quotes?.filter(q => q.status === 'rejected').length || 0,
    expired: quotes?.filter(q => q.status === 'expired').length || 0,
  };

  const pagination = usePagination(filteredQuotes, { initialPageSize: 50 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in pb-24">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              Orçamentos
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Gerencie todos os orçamentos da sua vidraçaria.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button onClick={() => { setSelectedQuote(null); setIsNewDialogOpen(true); }} className="gap-2 h-10 sm:h-11 px-4">
              <Plus className="w-4 h-4" />
              <span className="text-sm">Novo Orçamento</span>
            </Button>
          </div>
        </div>

        <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b space-y-3">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as QuoteStatus | 'all')} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
              <TabsTrigger value="all" className="gap-2">Todos <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge></TabsTrigger>
              <TabsTrigger value="pending" className="gap-2"><Clock className="w-3.5 h-3.5" /> Pendentes <Badge variant="secondary" className="ml-1">{statusCounts.pending}</Badge></TabsTrigger>
              <TabsTrigger value="approved" className="gap-2"><CheckCircle className="w-3.5 h-3.5" /> Aprovados <Badge variant="secondary" className="ml-1">{statusCounts.approved}</Badge></TabsTrigger>
              <TabsTrigger value="converted" className="gap-2"><CheckCircle className="w-3.5 h-3.5" /> Convertidos <Badge variant="secondary" className="ml-1">{statusCounts.converted}</Badge></TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2"><XCircle className="w-3.5 h-3.5" /> Rejeitados <Badge variant="secondary" className="ml-1">{statusCounts.rejected}</Badge></TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por cliente ou número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
              <SelectTrigger className="w-full sm:w-[200px] bg-background">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
              </SelectContent>
            </Select>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              className="bg-background border rounded-md p-0.5"
            >
              <ToggleGroupItem value="grid" aria-label="Visualização em grade" className="h-8 w-8 p-0">
                <LayoutGrid className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Visualização em lista" className="h-8 w-8 p-0">
                <List className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>



        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : pagination.paginatedData.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                {pagination.paginatedData.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    statusConfig={statusConfig}
                    formatCurrency={formatCurrency}
                    isPartial={salesByQuoteId.get(quote.id)?.isPartial ?? false}
                    onNewReceipt={handleNewReceipt}
                    onView={(q) => { setSelectedQuote(q); setIsViewDialogOpen(true); }}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onPrint={(q) => { setSelectedQuote(q); setIsViewDialogOpen(true); }}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onReopen={handleReopen}
                    onDelete={(q) => setQuoteToDelete(q)}
                    onGenerateContract={handleGenerateContract}
                    onCancelApproved={(q) => setQuoteToCancelApproved(q)}
                  />
                ))}
              </div>
            ) : (
              <QuotesTableView
                quotes={pagination.paginatedData}
                statusConfig={statusConfig}
                formatCurrency={formatCurrency}
                partialByQuoteId={salesByQuoteId}
                onNewReceipt={handleNewReceipt}
                onView={(q) => { setSelectedQuote(q); setIsViewDialogOpen(true); }}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onPrint={(q) => { setSelectedQuote(q); setIsViewDialogOpen(true); }}
                onApprove={handleApprove}
                onReject={handleReject}
                onReopen={handleReopen}
                onDelete={(q) => setQuoteToDelete(q)}
                onGenerateContract={handleGenerateContract}
                onCancelApproved={(q) => setQuoteToCancelApproved(q)}
              />
            )}
            <PaginationControls 
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
            <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium">Nenhum orçamento encontrado.</p>
          </div>
        )}
      </div>

      <NovoOrcamentoDialog
        open={isNewDialogOpen}
        onOpenChange={(o) => {
          setIsNewDialogOpen(o);
          if (!o) {
            setIsDuplicating(false);
            setSelectedQuote(null);
          }
        }}
        quote={selectedQuote || undefined}
        duplicate={isDuplicating}
      />
      <VisualizarOrcamentoDialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} quote={selectedQuote} />
      <EditarContratoDialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen} quote={selectedQuote} items={contractItems} company={currentCompany} />
      <AprovarOrcamentoDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen} quote={selectedQuote} items={approveQuoteItems} />
      

      <AlertDialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o orçamento #{quoteToDelete?.quote_number}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => quoteToDelete && deleteQuote(quoteToDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!quoteToCancelApproved} onOpenChange={(open) => !open && setQuoteToCancelApproved(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Aprovação</AlertDialogTitle>
            <AlertDialogDescription>
              Ao cancelar a aprovação do orçamento #{quoteToCancelApproved?.quote_number}, todas as vendas, parcelas e ordens de serviço vinculadas serão canceladas. O orçamento voltará ao status "Pendente".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => quoteToCancelApproved && handleCancelApprovedAction(quoteToCancelApproved)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NovoRecebimentoDialog
        open={novoRecebimentoOpen}
        onOpenChange={(open) => {
          setNovoRecebimentoOpen(open);
          if (!open) setSaleForReceipt(null);
        }}
        sale={saleForReceipt}
      />
    </MainLayout>
  );
}
