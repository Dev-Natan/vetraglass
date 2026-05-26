import { useState, useEffect } from 'react';
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
  Settings
} from 'lucide-react';
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
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

import { useQuotes } from '@/hooks/useQuotes';
import { Quote, QuoteStatus, quoteService } from '@/services/quoteService';
import { QuoteCard } from '@/components/orcamentos/QuoteCard';

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
  const [searchParams, setSearchParams] = useSearchParams();
  
  useModuleTutorialTrigger('orcamentos');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('pending');
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [contractItems, setContractItems] = useState<any[]>([]);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [approveQuoteItems, setApproveQuoteItems] = useState<any[]>([]);
  
  const [quoteToCancelApproved, setQuoteToCancelApproved] = useState<Quote | null>(null);

  const {
    quotes,
    isLoading,
    deleteQuote,
    updateStatus,
    cancelApproved,
    duplicateQuote
  } = useQuotes(currentCompany?.id);

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
    setIsNewDialogOpen(true);
  };

  const handleDuplicate = async (quote: Quote) => {
    const items = await quoteService.fetchQuoteItems(quote.id);
    await duplicateQuote({ quote, items });
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

  const filteredQuotes = quotes?.filter(quote => {
    const matchesSearch = quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number.toString().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
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

        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as QuoteStatus | 'all')} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="all" className="gap-2">Todos <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge></TabsTrigger>
            <TabsTrigger value="pending" className="gap-2"><Clock className="w-3.5 h-3.5" /> Pendentes <Badge variant="secondary" className="ml-1">{statusCounts.pending}</Badge></TabsTrigger>
            <TabsTrigger value="approved" className="gap-2"><CheckCircle className="w-3.5 h-3.5" /> Aprovados <Badge variant="secondary" className="ml-1">{statusCounts.approved}</Badge></TabsTrigger>
            <TabsTrigger value="converted" className="gap-2"><CheckCircle className="w-3.5 h-3.5" /> Convertidos <Badge variant="secondary" className="ml-1">{statusCounts.converted}</Badge></TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2"><XCircle className="w-3.5 h-3.5" /> Rejeitados <Badge variant="secondary" className="ml-1">{statusCounts.rejected}</Badge></TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por cliente ou número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : pagination.paginatedData.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {pagination.paginatedData.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  statusConfig={statusConfig}
                  formatCurrency={formatCurrency}
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

      <NovoOrcamentoDialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen} quote={selectedQuote || undefined} />
      <VisualizarOrcamentoDialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} quote={selectedQuote} />
      <EditarContratoDialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen} quote={selectedQuote} items={contractItems} company={currentCompany} />
      <AprovarOrcamentoDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen} quote={selectedQuote} items={approveQuoteItems} />
      <FormasPagamentoDialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen} />

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
    </MainLayout>
  );
}
