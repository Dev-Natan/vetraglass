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
  User, 
  MapPin,
  Phone,
  Calendar, 
  DollarSign,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Copy,
  Package,
  FileSignature,
  Printer,
  PlayCircle,
  CreditCard,
  Settings,
  MoreVertical,
  RotateCcw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { FormasPagamentoDialog } from '@/components/orcamentos/FormasPagamentoDialog';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { queryKeys } from '@/lib/queryConfig';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

type QuoteStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'converted';

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  customer_document?: string | null;
  customer_document_type?: string | null;
  customer_profession?: string | null;
  customer_marital_status?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  status: QuoteStatus;
  total_amount: number;
  discount_percent?: number | null;
  discount_amount?: number | null;
  final_amount: number;
  valid_until: string | null;
  show_measures_column?: boolean | null;
  show_m2_column?: boolean | null;
  created_at: string;
}

const statusConfig: Record<QuoteStatus, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
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
  
  // Module tutorial trigger
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
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [quoteToCancelApproved, setQuoteToCancelApproved] = useState<Quote | null>(null);

  // Open new dialog if ?novo=true in URL
  useEffect(() => {
    if (searchParams.get('novo') === 'true') {
      setIsNewDialogOpen(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);


  // Fetch quotes with optimized query (only needed fields)
  const { data: quotes, isLoading } = useQuery({
    queryKey: queryKeys.quotes.all(currentCompany?.id || ''),
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_name, customer_phone, customer_email, customer_address, customer_document, customer_document_type, customer_profession, customer_marital_status, payment_terms, notes, status, total_amount, discount_percent, discount_amount, final_amount, valid_until, show_measures_column, show_m2_column, created_at')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!currentCompany?.id,
    // Zero cache - sempre dados frescos
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      
      setQuoteToDelete(null);
    },
    onError: () => {
      toast({ title: 'Erro ao excluir orçamento', variant: 'destructive' });
    }
  });

  // Reject mutation (for pending quotes - simple status change)
  const rejectMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'rejected' })
        .eq('id', quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento rejeitado' });
    },
    onError: () => {
      toast({ title: 'Erro ao rejeitar orçamento', variant: 'destructive' });
    }
  });

  // Cancel approved/converted quote mutation (cancels all financial data)
  const cancelApprovedMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.rpc('cancel_approved_quote', { _quote_id: quoteId });
      if (error) throw error;
      const result = data as any;
      if (result && !result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['ordens'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_receivable'] });
      const details: string[] = [];
      if (data?.cancelled_os > 0) details.push(`${data.cancelled_os} OS`);
      if (data?.cancelled_sales > 0) details.push(`${data.cancelled_sales} venda(s)`);
      if (data?.cancelled_receivables > 0) details.push(`${data.cancelled_receivables} parcela(s)`);
      if (data?.cancelled_deposits > 0) details.push(`${data.cancelled_deposits} depósito(s)`);
      toast({ 
        title: 'Orçamento cancelado com sucesso',
        description: details.length > 0 ? `Cancelados: ${details.join(', ')}` : undefined
      });
      setQuoteToCancelApproved(null);
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao cancelar orçamento', description: err.message, variant: 'destructive' });
    }
  });

  // Reopen mutation (back to pending)
  const reopenMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'pending' })
        .eq('id', quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento reaberto como pendente' });
    },
    onError: () => {
      toast({ title: 'Erro ao reabrir orçamento', variant: 'destructive' });
    }
  });

  const filteredQuotes = quotes?.filter(quote => {
    const matchesSearch = quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number.toString().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Count by status
  const statusCounts = {
    all: quotes?.length || 0,
    pending: quotes?.filter(q => q.status === 'pending').length || 0,
    approved: quotes?.filter(q => q.status === 'approved').length || 0,
    converted: quotes?.filter(q => q.status === 'converted').length || 0,
    rejected: quotes?.filter(q => q.status === 'rejected').length || 0,
    expired: quotes?.filter(q => q.status === 'expired').length || 0,
  };

  // Pagination
  const pagination = usePagination(filteredQuotes, { initialPageSize: 50 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleView = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsViewDialogOpen(true);
  };

  // Auto-open quote if ?id=<quoteId> in URL
  useEffect(() => {
    const quoteId = searchParams.get('id');
    if (quoteId && quotes && quotes.length > 0) {
      const foundQuote = quotes.find(q => q.id === quoteId);
      if (foundQuote) {
        handleView(foundQuote);
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, quotes]);

  const handleEdit = (quote: Quote) => {
    // Orçamentos aprovados ou convertidos não podem ser editados
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

  const handleGenerateContract = async (quote: Quote) => {
    // Fetch quote items
    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id);

    const itemsForContract = (items || []).map(item => ({
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      has_glass: item.has_glass,
      glass_color: item.glass_color,
      glass_thickness: item.glass_thickness,
      aluminum_color: item.aluminum_color,
    }));

    setContractItems(itemsForContract);
    setSelectedQuote(quote);
    setIsContractDialogOpen(true);
  };

  const handlePrint = (quote: Quote) => {
    handleView(quote);
    // Print will be triggered from the view dialog
  };

  const handleApprove = async (quote: Quote) => {
    // Fetch quote items
    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id);

    setApproveQuoteItems(items || []);
    setSelectedQuote(quote);
    setIsApproveDialogOpen(true);
  };

  const handleDuplicate = async (quote: Quote) => {
    if (!currentCompany?.id) return;

    // Fetch quote items
    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id);

    // Create new quote
    const { data: newQuote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        company_id: currentCompany.id,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone,
        customer_email: quote.customer_email,
        customer_address: quote.customer_address,
        customer_document: quote.customer_document,
        customer_document_type: quote.customer_document_type,
        customer_profession: quote.customer_profession,
        customer_marital_status: quote.customer_marital_status,
        payment_terms: quote.payment_terms,
        notes: quote.notes,
        total_amount: quote.total_amount,
        discount_percent: quote.discount_percent,
        discount_amount: quote.discount_amount,
        final_amount: quote.final_amount,
        status: 'pending',
        show_measures_column: quote.show_measures_column,
        show_m2_column: quote.show_m2_column,
      })
      .select()
      .single();

    if (quoteError) {
      toast({ title: 'Erro ao duplicar orçamento', variant: 'destructive' });
      return;
    }

    // Duplicate items
    if (items && items.length > 0 && newQuote) {
      await supabase
        .from('quote_items')
        .insert(items.map(item => ({
          quote_id: newQuote.id,
          company_product_id: item.company_product_id,
          product_template_id: item.product_template_id,
          company_item_id: item.company_item_id,
          description: item.description,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          has_glass: item.has_glass,
          glass_color: item.glass_color,
          glass_thickness: item.glass_thickness,
          aluminum_color: item.aluminum_color,
        })));
    }

    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    toast({ title: 'Orçamento duplicado com sucesso!' });
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-slide-up pb-32">
        {/* Header Profissional */}
        <div data-tutorial="orcamentos-header" className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 p-5 sm:p-8 bg-card rounded-[1.5rem] sm:rounded-[2.5rem] border border-border/40 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-150" />
          <div className="relative">
            <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter flex items-center gap-4 sm:text-5xl">
              <div className="p-3 bg-primary/10 rounded-2xl shadow-inner border border-primary/20">
                <FileText className="w-10 h-10 text-primary" />
              </div>
              Orçamentos
            </h1>
            <p className="text-muted-foreground text-lg mt-3 font-medium">
              Gestão de propostas e <span className="text-primary font-black uppercase tracking-widest text-xs">Fluxo Comercial</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative">
            <Button 
              variant="outline" 
              onClick={() => setIsPaymentDialogOpen(true)}
              className="h-14 rounded-2xl border-2 font-black uppercase tracking-tighter text-xs"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </Button>
            <Button 
              size="lg" 
              onClick={() => {
                setSelectedQuote(null);
                setIsNewDialogOpen(true);
              }}
              className="h-14 rounded-2xl font-black uppercase tracking-tighter text-xs shadow-xl shadow-primary/20 group"
            >
              <Plus className="w-5 h-5 mr-2 transition-transform group-hover:rotate-90" />
              Nova Proposta
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Status Tabs Modernas */}
          <Tabs data-tutorial="orcamentos-tabs" value={statusFilter} onValueChange={(v) => setStatusFilter(v as QuoteStatus | 'all')} className="w-full">
            <TabsList className="w-full h-auto p-1 bg-muted/30 border border-border/40 rounded-[1.5rem] justify-start overflow-x-auto flex-nowrap scrollbar-none">
              <TabsTrigger value="all" className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">
                Todos
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{statusCounts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">
                Pendentes
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{statusCounts.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="approved" className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">
                Aprovados
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{statusCounts.approved}</Badge>
              </TabsTrigger>
              <TabsTrigger value="converted" className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">
                Convertidos
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{statusCounts.converted}</Badge>
              </TabsTrigger>
              <TabsTrigger value="rejected" className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-card data-[state=active]:shadow-lg transition-all">
                Rejeitados
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{statusCounts.rejected}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Profissional */}
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
            <Input
              type="text"
              placeholder="Pesquisar por cliente, número ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 h-16 bg-card border-border/40 rounded-2xl shadow-sm text-lg font-medium focus-visible:ring-primary/10 transition-all duration-300"
            />
            {searchTerm && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 hover:bg-transparent"
              >
                <XCircle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
              </Button>
            )}
          </div>
        </div>

        {/* Quotes Grid */}
        {isLoading ? (
          <div className="section-card p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="section-card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              {quotes?.length === 0 ? 'Nenhum orçamento ainda' : 'Nenhum resultado encontrado'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {quotes?.length === 0 
                ? 'Comece criando seu primeiro orçamento.'
                : 'Tente ajustar os filtros de busca.'}
            </p>
            {quotes?.length === 0 && (
              <Button className="gap-2" onClick={() => setIsNewDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                Criar Primeiro Orçamento
              </Button>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagination.paginatedData.map((quote) => {
              const status = statusConfig[quote.status];
              const StatusIcon = status.icon;
              
              return (
                  <div 
                    key={quote.id} 
                    className="group bg-card rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-border/40 overflow-hidden hover:border-primary/40 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col relative"
                  >
                    {/* Header do Card */}
                    <div className="p-5 sm:p-8">
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="space-y-1">
                          <h3 className="text-xl font-black text-foreground tracking-tighter leading-tight group-hover:text-primary transition-colors">
                            {quote.customer_name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                              ORÇAMENTO #{String(quote.quote_number).padStart(4, '0')}
                            </span>
                          </div>
                        </div>
                        <Badge variant={status.variant} className="px-3 py-1 font-black shrink-0">
                          {status.label.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Informações de Contato */}
                      <div className="space-y-3 mb-8">
                        {quote.customer_address && (
                          <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                            <div className="p-2 bg-muted rounded-xl">
                              <MapPin className="w-4 h-4 text-primary" />
                            </div>
                            <span className="line-clamp-1">{quote.customer_address}</span>
                          </div>
                        )}
                        {quote.customer_phone && (
                          <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                            <div className="p-2 bg-muted rounded-xl">
                              <Phone className="w-4 h-4 text-primary" />
                            </div>
                            <span>{quote.customer_phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Valor e Data */}
                      <div className="flex items-end justify-between pt-6 border-t border-border/40">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Investimento Total</p>
                          <span className="text-2xl font-black text-foreground tracking-tighter group-hover:text-primary transition-colors">
                            {formatCurrency(quote.final_amount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Emitido em</p>
                          <span className="text-xs font-bold text-muted-foreground/60">
                            {format(new Date(quote.created_at), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>

                  {/* Quick Actions */}
                  <div className="px-4 py-3 bg-muted/30 border-t">
                    <div className="flex items-center justify-center gap-4 mb-3">
                      <button
                        onClick={() => handleDuplicate(quote)}
                        className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg border bg-background flex items-center justify-center hover:bg-muted transition-colors">
                          <Copy className="w-5 h-5" />
                        </div>
                        <span className="text-xs">Copiar</span>
                      </button>
                      <button
                        onClick={() => handleGenerateContract(quote)}
                        className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg border bg-background flex items-center justify-center hover:bg-muted transition-colors">
                          <FileSignature className="w-5 h-5" />
                        </div>
                        <span className="text-xs">Contrato</span>
                      </button>
                      <button
                        onClick={() => handlePrint(quote)}
                        className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg border bg-background flex items-center justify-center hover:bg-muted transition-colors">
                          <Printer className="w-5 h-5" />
                        </div>
                        <span className="text-xs">Imprimir</span>
                      </button>
                      
                      {/* Status Action Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`flex flex-col items-center gap-1 transition-colors ${
                              quote.status === 'pending' 
                                ? 'text-amber-600 hover:text-amber-700' 
                                : quote.status === 'approved' || quote.status === 'converted'
                                  ? 'text-green-600 hover:text-green-700'
                                  : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                              quote.status === 'pending'
                                ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                                : quote.status === 'approved' || quote.status === 'converted'
                                  ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                  : 'bg-background hover:bg-muted'
                            }`}>
                              {quote.status === 'pending' ? (
                                <Clock className="w-5 h-5" />
                              ) : quote.status === 'approved' || quote.status === 'converted' ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : quote.status === 'rejected' ? (
                                <XCircle className="w-5 h-5" />
                              ) : (
                                <AlertCircle className="w-5 h-5" />
                              )}
                            </div>
                            <span className="text-xs font-medium">Status</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-48">
                          {quote.status === 'pending' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleApprove(quote)}
                                className="gap-2 text-green-600 focus:text-green-600"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Aprovar Orçamento
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => rejectMutation.mutate(quote.id)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <XCircle className="w-4 h-4" />
                                Rejeitar Orçamento
                              </DropdownMenuItem>
                            </>
                          )}
                          {(quote.status === 'rejected' || quote.status === 'expired') && (
                            <DropdownMenuItem 
                              onClick={() => reopenMutation.mutate(quote.id)}
                              className="gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Reabrir como Pendente
                            </DropdownMenuItem>
                          )}
                          {quote.status === 'approved' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleView(quote)}
                                className="gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => reopenMutation.mutate(quote.id)}
                                className="gap-2 text-amber-600 focus:text-amber-600"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Voltar p/ Pendente
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setQuoteToCancelApproved(quote)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <XCircle className="w-4 h-4" />
                                Cancelar Orçamento
                              </DropdownMenuItem>
                            </>
                          )}
                          {quote.status === 'converted' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleView(quote)}
                                className="gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setQuoteToCancelApproved(quote)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <XCircle className="w-4 h-4" />
                                Cancelar Orçamento
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleView(quote)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar
                      </Button>
                      {quote.status === 'approved' || quote.status === 'converted' ? (
                        <Button 
                          variant="outline"
                          className="flex-1"
                          disabled
                          title="Reabra como pendente para editar"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Bloqueado
                        </Button>
                      ) : (
                        <Button 
                          className="flex-1"
                          onClick={() => handleEdit(quote)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="mt-6">
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            </div>
          )}
          </>
        )}

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-background border-t shadow-lg z-40">
          <div className="max-w-screen-xl mx-auto px-4">
            <div className="flex items-center justify-around py-3">
              <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <PlayCircle className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs">Assistir tutorial</span>
              </button>
              <button 
                className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => document.querySelector('input')?.focus()}
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <span className="text-xs">Buscar</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Settings className="w-6 h-6" />
                </div>
                <span className="text-xs">Configurar contrato</span>
              </button>
              <button 
                className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setIsPaymentDialogOpen(true)}
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="text-xs">Formas de pagamento</span>
              </button>
              <button 
                className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => { setSelectedQuote(null); setIsNewDialogOpen(true); }}
              >
                <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs">Novo orçamento</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <NovoOrcamentoDialog 
        open={isNewDialogOpen} 
        onOpenChange={(open) => {
          setIsNewDialogOpen(open);
          if (!open) setSelectedQuote(null);
        }}
        quote={selectedQuote}
      />

      <VisualizarOrcamentoDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        quote={selectedQuote}
      />

      <EditarContratoDialog
        open={isContractDialogOpen}
        onOpenChange={setIsContractDialogOpen}
        quote={selectedQuote}
        items={contractItems}
        company={currentCompany ? {
          name: currentCompany.name,
          cnpj: currentCompany.cnpj,
          phone: currentCompany.phone,
          email: currentCompany.email,
          address: currentCompany.address,
        } : null}
      />

      <AlertDialog open={!!quoteToDelete} onOpenChange={() => setQuoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O orçamento #{quoteToDelete?.quote_number.toString().padStart(4, '0')} será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => quoteToDelete && deleteMutation.mutate(quoteToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aprovar Orçamento Dialog */}
      <AprovarOrcamentoDialog
        open={isApproveDialogOpen}
        onOpenChange={setIsApproveDialogOpen}
        quote={selectedQuote}
        items={approveQuoteItems}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
          setIsApproveDialogOpen(false);
        }}
      />

      {/* Formas de Pagamento Dialog */}
      <FormasPagamentoDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
      />
      {/* Cancel Approved Quote Confirmation */}
      <AlertDialog open={!!quoteToCancelApproved} onOpenChange={() => setQuoteToCancelApproved(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar orçamento aprovado?</AlertDialogTitle>
            <AlertDialogDescription>
              O orçamento #{quoteToCancelApproved?.quote_number.toString().padStart(4, '0')} será cancelado junto com <strong>todos os dados financeiros vinculados</strong>: ordens de serviço, vendas, parcelas a receber e depósitos serão cancelados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => quoteToCancelApproved && cancelApprovedMutation.mutate(quoteToCancelApproved.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Orçamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
