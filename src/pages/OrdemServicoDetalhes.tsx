import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Package, Scissors, Layers, FileText, User, Phone, MapPin, Calendar, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { OSMaterialsList } from '@/components/ordens-servico/OSMaterialsList';
import { OSCuttingPlan } from '@/components/ordens-servico/OSCuttingPlan';
import { OSGlassProject } from '@/components/ordens-servico/OSGlassProject';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { regenerateOSDocuments } from '@/utils/generateOSDocuments';
import { toast } from 'sonner';

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

        {/* Tabs */}
        <Tabs defaultValue="materials" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="materials" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Materiais</span>
            </TabsTrigger>
            <TabsTrigger value="cutting" className="flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              <span className="hidden sm:inline">Plano de Corte</span>
            </TabsTrigger>
            <TabsTrigger value="glass" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Vidros</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Detalhes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="mt-4">
            <OSMaterialsList ordemServicoId={ordem.id} />
          </TabsContent>

          <TabsContent value="cutting" className="mt-4">
            <OSCuttingPlan ordemServicoId={ordem.id} />
          </TabsContent>

          <TabsContent value="glass" className="mt-4">
            <OSGlassProject ordemServicoId={ordem.id} />
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
