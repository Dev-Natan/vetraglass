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
  Settings
} from 'lucide-react';
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
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { CACHE_TIMES, queryKeys } from '@/lib/queryConfig';

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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [contractItems, setContractItems] = useState<any[]>([]);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [approveQuoteItems, setApproveQuoteItems] = useState<any[]>([]);

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
        .select('id, quote_number, customer_name, customer_phone, customer_email, customer_address, customer_document, customer_document_type, customer_profession, customer_marital_status, payment_terms, notes, status, total_amount, discount_percent, discount_amount, final_amount, valid_until, created_at')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.SEMI_STATIC,
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
      toast({ title: 'Orçamento excluído com sucesso' });
      setQuoteToDelete(null);
    },
    onError: () => {
      toast({ title: 'Erro ao excluir orçamento', variant: 'destructive' });
    }
  });

  // Filter quotes
  const filteredQuotes = quotes?.filter(quote => {
    const matchesSearch = quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number.toString().includes(searchTerm);
    return matchesSearch;
  }) || [];

  // Pagination
  const pagination = usePagination(filteredQuotes, { initialPageSize: 50 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleView = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (quote: Quote) => {
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
          description: item.description,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          has_glass: item.has_glass,
          glass_color: item.glass_color,
          glass_thickness: item.glass_thickness,
        })));
    }

    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    toast({ title: 'Orçamento duplicado com sucesso!' });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Orçamentos
            </h1>
            <p className="text-muted-foreground">Gerencie todos os orçamentos da sua vidraçaria.</p>
          </div>
        </div>

        {/* Search */}
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
                  className="bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Card Header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-foreground">
                        ORÇAMENTO {quote.quote_number}
                      </h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-destructive gap-1 h-8 px-2"
                        onClick={() => setQuoteToDelete(quote)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </Button>
                    </div>

                    {/* Customer Info */}
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{quote.customer_name}</span>
                      </div>
                      {quote.customer_address && (
                        <div className="flex items-start gap-2 text-primary">
                          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{quote.customer_address}</span>
                        </div>
                      )}
                      {quote.customer_phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4 shrink-0" />
                          <span>{quote.customer_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Price and Date */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(quote.final_amount)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(quote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="px-4 py-3 bg-muted/30 border-t">
                    <div className="flex items-center justify-center gap-6 mb-3">
                      <button
                        onClick={() => handleDuplicate(quote)}
                        className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg border bg-background flex items-center justify-center hover:bg-muted transition-colors">
                          <Copy className="w-5 h-5" />
                        </div>
                        <span className="text-xs">Fazer cópia</span>
                      </button>
                      <button
                        onClick={() => handleView(quote)}
                        className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg border bg-background flex items-center justify-center hover:bg-muted transition-colors">
                          <Package className="w-5 h-5" />
                        </div>
                        <span className="text-xs">Materiais</span>
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
                      {quote.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(quote)}
                          className="flex flex-col items-center gap-1 text-green-600 hover:text-green-700 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg border border-green-200 bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-medium">Aprovar</span>
                        </button>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleView(quote)}
                      >
                        Fechar orçamento
                      </Button>
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleEdit(quote)}
                      >
                        Editar
                      </Button>
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
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-40">
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
              <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="text-xs">Formas de pagamento</span>
              </button>
            </div>
          </div>
          
          {/* Floating Add Button */}
          <Button
            onClick={() => { setSelectedQuote(null); setIsNewDialogOpen(true); }}
            className="absolute -top-7 right-6 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg p-0"
          >
            <Plus className="w-7 h-7" />
          </Button>
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
    </MainLayout>
  );
}
