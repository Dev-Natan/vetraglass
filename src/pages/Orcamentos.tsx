import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  User, 
  Calendar, 
  DollarSign,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);

  // Fetch quotes
  const { data: quotes, isLoading } = useQuery({
    queryKey: ['quotes', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!currentCompany?.id
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
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Stats
  const totalQuotes = quotes?.length || 0;
  const pendingQuotes = quotes?.filter(q => q.status === 'pending').length || 0;
  const approvedQuotes = quotes?.filter(q => q.status === 'approved' || q.status === 'converted').length || 0;
  const totalValue = quotes?.reduce((sum, q) => sum + Number(q.final_amount), 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleView = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsViewDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Orçamentos
            </h1>
            <p className="text-muted-foreground">Gerencie todos os orçamentos da sua vidraçaria.</p>
          </div>
          <Button className="gap-2" onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Novo Orçamento
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="section-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">{totalQuotes}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-action-orange/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-action-orange" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">{pendingQuotes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-action-green/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-action-green" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">{approvedQuotes}</p>
              <p className="text-xs text-muted-foreground">Aprovados</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-action-blue/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-action-blue" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">{formatCurrency(totalValue)}</p>
              <p className="text-xs text-muted-foreground">Valor total</p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {statusFilter === 'all' ? 'Todos' : statusConfig[statusFilter].label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                Todos
              </DropdownMenuItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <DropdownMenuItem key={key} onClick={() => setStatusFilter(key as QuoteStatus)}>
                  <config.icon className="w-4 h-4 mr-2" />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quotes List */}
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
          <div className="space-y-3">
            {filteredQuotes.map((quote) => {
              const status = statusConfig[quote.status];
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={quote.id}
                  className="section-card p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleView(quote)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-muted-foreground">
                            #{quote.quote_number.toString().padStart(4, '0')}
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {quote.customer_name}
                          </span>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {quote.valid_until && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Válido até {format(new Date(quote.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          {formatCurrency(quote.final_amount)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(quote); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedQuote(quote); setIsNewDialogOpen(true); }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setQuoteToDelete(quote); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    </MainLayout>
  );
}
