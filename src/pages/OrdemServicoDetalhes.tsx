import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Package, Scissors, Layers, FileText, User, Phone, MapPin, Calendar, DollarSign, RefreshCw, Loader2, Download, Camera, ExternalLink, CalendarDays, Wallet } from 'lucide-react';
import { OSMaterialsList } from '@/components/ordens-servico/OSMaterialsList';
import { OSCuttingPlan } from '@/components/ordens-servico/OSCuttingPlan';
import { OSGlassProject } from '@/components/ordens-servico/OSGlassProject';
import { OSPhotosGallery } from '@/components/ordens-servico/OSPhotosGallery';
import { OSSalesFlowTimeline } from '@/components/ordens-servico/OSSalesFlowTimeline';
import { OSFinancialDashboard } from '@/components/ordens-servico/OSFinancialDashboard';
import { OSProductionProgress } from '@/components/ordens-servico/OSProductionProgress';
import { OSMaterialsStatus } from '@/components/ordens-servico/OSMaterialsStatus';
import { OSConsumptionStatus } from '@/components/ordens-servico/OSConsumptionStatus';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { regenerateOSDocuments } from '@/utils/generateOSDocuments';
import { generateCuttingPlanPdf } from '@/utils/generateCuttingPlanPdf';
import { generateMaterialsListPdf } from '@/utils/generateMaterialsListPdf';
import { generateGlassProductionPdf } from '@/utils/generateGlassProductionPdf';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  in_progress: { label: 'Em Andamento', variant: 'default' },
  completed: { label: 'Concluído', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export default function OrdemServicoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();

  const { data: ordem, isLoading } = useQuery({
    queryKey: ['ordem-servico', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não fornecido');
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch related quote with more details
  const { data: relatedQuote } = useQuery({
    queryKey: ['quote-for-os', ordem?.quote_id],
    queryFn: async () => {
      if (!ordem?.quote_id) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_name, created_at, deposit_status, deposit_amount, status')
        .eq('id', ordem.quote_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ordem?.quote_id,
  });

  // Fetch deposit info
  const { data: depositInfo } = useQuery({
    queryKey: ['quote-deposit-for-os', ordem?.quote_id],
    queryFn: async () => {
      if (!ordem?.quote_id) return null;
      const { data, error } = await supabase
        .from('quote_deposits')
        .select('*')
        .eq('quote_id', ordem.quote_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ordem?.quote_id,
  });

  // Check for overdue payments
  const { data: overduePayments } = useQuery({
    queryKey: ['os-overdue-payments', id],
    queryFn: async () => {
      if (!id) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('id')
        .eq('ordem_servico_id', id)
        .eq('status', 'pending')
        .lt('due_date', today);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch related appointments
  const { data: relatedAppointments } = useQuery({
    queryKey: ['appointments-for-os', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('service_appointments')
        .select('id, title, scheduled_date, appointment_type')
        .eq('ordem_servico_id', id)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch materials for PDF
  const { data: materials } = useQuery({
    queryKey: ['os-materials', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('os_materials')
        .select('*')
        .eq('ordem_servico_id', id)
        .order('item_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch cutting plans for PDF
  const { data: cuttingPlans } = useQuery({
    queryKey: ['os-cutting-plan', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('os_cutting_plan')
        .select('*')
        .eq('ordem_servico_id', id)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch glass projects for PDF
  const { data: glassProjects } = useQuery({
    queryKey: ['os-glass-projects', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('os_glass_projects')
        .select('*')
        .eq('ordem_servico_id', id)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!ordem) throw new Error('OS não encontrada');
      return regenerateOSDocuments(ordem.id, ordem.quote_id);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Documentos regenerados com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['os-materials', id] });
        queryClient.invalidateQueries({ queryKey: ['os-cutting-plan', id] });
        queryClient.invalidateQueries({ queryKey: ['os-glass-projects', id] });
      } else {
        toast.error('Erro ao regenerar documentos: ' + result.error);
      }
    },
    onError: (error: Error) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const getOsInfo = () => ({
    os_number: ordem?.os_number || 0,
    customer_name: ordem?.customer_name || '',
    customer_address: ordem?.customer_address,
    estimated_end: ordem?.estimated_end,
  });

  const getCompanyInfo = () => currentCompany ? {
    name: currentCompany.name,
    cnpj: currentCompany.cnpj,
    phone: currentCompany.phone,
  } : null;

  const handleDownloadMaterialsPdf = () => {
    if (!materials || materials.length === 0) {
      toast.error('Nenhum material disponível para gerar PDF');
      return;
    }
    toast.info('Gerando PDF...');
    generateMaterialsListPdf(materials, getOsInfo(), getCompanyInfo());
    toast.success('PDF gerado com sucesso!');
  };

  const handleDownloadCuttingPlanPdf = () => {
    if (!cuttingPlans || cuttingPlans.length === 0) {
      toast.error('Nenhum plano de corte disponível para gerar PDF');
      return;
    }
    toast.info('Gerando PDF...');
    generateCuttingPlanPdf(cuttingPlans as any, getOsInfo(), getCompanyInfo());
    toast.success('PDF gerado com sucesso!');
  };

  const handleDownloadGlassPdf = () => {
    if (!glassProjects || glassProjects.length === 0) {
      toast.error('Nenhum projeto de vidro disponível para gerar PDF');
      return;
    }
    toast.info('Gerando PDF...');
    generateGlassProductionPdf(glassProjects as any, getOsInfo(), getCompanyInfo());
    toast.success('PDF gerado com sucesso!');
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!ordem) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Ordem de serviço não encontrada.</p>
          <Button variant="outline" onClick={() => navigate('/ordens-servico')} className="mt-4">
            Voltar
          </Button>
        </div>
      </MainLayout>
    );
  }

  const status = statusConfig[ordem.status] || statusConfig.pending;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ordens-servico')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">OS #{ordem.os_number.toString().padStart(4, '0')}</h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="text-muted-foreground">{ordem.customer_name}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="gap-2"
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Recalcular
          </Button>
        </div>

        {/* Sales Flow Timeline */}
        <Card>
          <CardContent className="pt-4 pb-2">
            <OSSalesFlowTimeline
              quoteCreatedAt={relatedQuote?.created_at}
              quoteApprovedAt={ordem.created_at}
              entryValue={depositInfo?.amount || relatedQuote?.deposit_amount || 0}
              entryPaid={depositInfo?.status === 'paid' || depositInfo?.status === 'billed'}
              osStatus={ordem.status}
              osCompletedAt={ordem.status === 'completed' ? ordem.updated_at : undefined}
              totalAmount={ordem.total_amount}
              paidAmount={ordem.paid_amount || 0}
              pendingAmount={ordem.pending_amount || 0}
              hasOverduePayments={(overduePayments?.length || 0) > 0}
            />
          </CardContent>
        </Card>

        {/* Production Progress Card */}
        <OSProductionProgress ordemServicoId={ordem.id} />

        {/* Material Consumption Status - NEW */}
        <OSConsumptionStatus ordemServicoId={ordem.id} />

        {/* Materials Status */}
        <OSMaterialsStatus ordemServicoId={ordem.id} />

        {/* Summary Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Cliente</div>
                  <div className="font-medium">{ordem.customer_name}</div>
                </div>
              </div>
              {ordem.customer_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">Telefone</div>
                    <div className="font-medium">{ordem.customer_phone}</div>
                  </div>
                </div>
              )}
              {ordem.estimated_end && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">Previsão</div>
                    <div className="font-medium">
                      {format(new Date(ordem.estimated_end), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="font-medium">{formatCurrency(ordem.total_amount)}</div>
                  {ordem.pending_amount > 0 && (
                    <div className="text-xs text-destructive">
                      Pendente: {formatCurrency(ordem.pending_amount)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Related Links */}
        {(relatedQuote || (relatedAppointments && relatedAppointments.length > 0)) && (
          <Card>
            <CardContent className="pt-6">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Entidades Relacionadas
              </h4>
              <div className="flex flex-wrap gap-3">
                {relatedQuote && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate(`/orcamentos?id=${relatedQuote.id}`)}
                  >
                    <FileText className="w-4 h-4" />
                    Orçamento #{relatedQuote.quote_number?.toString().padStart(4, '0')}
                  </Button>
                )}
                {relatedAppointments && relatedAppointments.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate('/agenda')}
                  >
                    <CalendarDays className="w-4 h-4" />
                    {relatedAppointments.length} Agendamento{relatedAppointments.length > 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="financial" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="materials" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Materiais</span>
            </TabsTrigger>
            <TabsTrigger value="cutting" className="flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              <span className="hidden sm:inline">Corte</span>
            </TabsTrigger>
            <TabsTrigger value="glass" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Vidros</span>
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Fotos</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Detalhes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="mt-4">
            <OSFinancialDashboard
              ordemServicoId={ordem.id}
              quoteId={ordem.quote_id}
              totalAmount={ordem.total_amount}
              paidAmount={ordem.paid_amount || 0}
              pendingAmount={ordem.pending_amount || 0}
            />
          </TabsContent>

          <TabsContent value="materials" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleDownloadMaterialsPdf} className="gap-2">
                <Download className="w-4 h-4" />
                Baixar PDF
              </Button>
            </div>
            <OSMaterialsList ordemServicoId={ordem.id} />
          </TabsContent>

          <TabsContent value="cutting" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleDownloadCuttingPlanPdf} className="gap-2">
                <Download className="w-4 h-4" />
                Baixar PDF
              </Button>
            </div>
            <OSCuttingPlan ordemServicoId={ordem.id} />
          </TabsContent>

          <TabsContent value="glass" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleDownloadGlassPdf} className="gap-2">
                <Download className="w-4 h-4" />
                Baixar PDF
              </Button>
            </div>
            <OSGlassProject ordemServicoId={ordem.id} />
          </TabsContent>
          
          <TabsContent value="photos" className="mt-4">
            <OSPhotosGallery ordemServicoId={ordem.id} />
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações da OS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ordem.customer_address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm text-muted-foreground">Endereço</div>
                      <div>{ordem.customer_address}</div>
                    </div>
                  </div>
                )}
                {ordem.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Observações</div>
                    <div className="p-3 bg-muted/50 rounded-lg">{ordem.notes}</div>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Criada em: {format(new Date(ordem.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
