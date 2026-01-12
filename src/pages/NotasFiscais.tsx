import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Plus, 
  Search, 
  RefreshCw, 
  Download, 
  XCircle, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  Wrench
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovaNotaFiscalDialog from "@/components/notas/NovaNotaFiscalDialog";
import DetalhesNotaDialog from "@/components/notas/DetalhesNotaDialog";

type NotaFiscal = {
  id: string;
  tipo: 'nfe' | 'nfse';
  numero: number | null;
  serie: string | null;
  chave_acesso: string | null;
  status: string;
  focusnfe_status: string | null;
  motivo_rejeicao: string | null;
  destinatario_nome: string;
  destinatario_documento: string | null;
  valor_total: number;
  data_emissao: string | null;
  data_autorizacao: string | null;
  pdf_url: string | null;
  created_at: string;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  pendente: { label: "Pendente", variant: "outline", icon: Clock },
  processando: { label: "Processando", variant: "secondary", icon: RefreshCw },
  autorizada: { label: "Autorizada", variant: "default", icon: CheckCircle },
  rejeitada: { label: "Rejeitada", variant: "destructive", icon: AlertCircle },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle },
};

export default function NotasFiscais() {
  const { companies } = useAuth();
  const companyId = companies[0]?.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"todas" | "nfe" | "nfse">("todas");
  const [showNovaNotaDialog, setShowNovaNotaDialog] = useState(false);
  const [tipoNovaNota, setTipoNovaNota] = useState<"nfe" | "nfse">("nfe");
  const [selectedNota, setSelectedNota] = useState<NotaFiscal | null>(null);

  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas-fiscais", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as NotaFiscal[];
    },
    enabled: !!companyId,
  });

  const consultarMutation = useMutation({
    mutationFn: async (notaId: string) => {
      const { data, error } = await supabase.functions.invoke("focusnfe", {
        body: { action: "consultar", nota_id: notaId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais"] });
      toast.success("Status atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao consultar nota: " + error.message);
    },
  });

  const filteredNotas = notas?.filter((nota) => {
    const matchesSearch = 
      nota.destinatario_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nota.numero?.toString().includes(searchTerm) ||
      nota.chave_acesso?.includes(searchTerm);
    
    const matchesTab = activeTab === "todas" || nota.tipo === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const stats = {
    total: notas?.length || 0,
    autorizadas: notas?.filter(n => n.status === "autorizada").length || 0,
    pendentes: notas?.filter(n => n.status === "pendente" || n.status === "processando").length || 0,
    rejeitadas: notas?.filter(n => n.status === "rejeitada").length || 0,
  };

  const handleNovaNotaNFe = () => {
    setTipoNovaNota("nfe");
    setShowNovaNotaDialog(true);
  };

  const handleNovaNotaNFSe = () => {
    setTipoNovaNota("nfse");
    setShowNovaNotaDialog(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notas Fiscais</h1>
            <p className="text-muted-foreground">
              Emissão e gerenciamento de NF-e e NFS-e via Focusnfe
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleNovaNotaNFe} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Nova NF-e
            </Button>
            <Button onClick={handleNovaNotaNFSe} variant="outline" className="gap-2">
              <Wrench className="h-4 w-4" />
              Nova NFS-e
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Notas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Autorizadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.autorizadas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejeitadas}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Notas Emitidas</CardTitle>
                <CardDescription>
                  Histórico de notas fiscais emitidas
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, número ou chave..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[300px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="todas">Todas</TabsTrigger>
                <TabsTrigger value="nfe">NF-e</TabsTrigger>
                <TabsTrigger value="nfse">NFS-e</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredNotas?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Nenhuma nota fiscal encontrada</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Clique em "Nova NF-e" ou "Nova NFS-e" para emitir uma nota fiscal
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotas?.map((nota) => {
                      const statusInfo = statusConfig[nota.status] || statusConfig.pendente;
                      const StatusIcon = statusInfo.icon;
                      
                      return (
                        <div
                          key={nota.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedNota(nota)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${nota.tipo === 'nfe' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                              {nota.tipo === 'nfe' ? <FileSpreadsheet className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {nota.tipo.toUpperCase()} {nota.numero ? `#${nota.numero}` : '(Pendente)'}
                                </span>
                                <Badge variant={statusInfo.variant} className="gap-1">
                                  <StatusIcon className="h-3 w-3" />
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {nota.destinatario_nome}
                                {nota.destinatario_documento && ` • ${nota.destinatario_documento}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(nota.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold">
                                {nota.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {nota.status === 'processando' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    consultarMutation.mutate(nota.id);
                                  }}
                                  disabled={consultarMutation.isPending}
                                >
                                  <RefreshCw className={`h-4 w-4 ${consultarMutation.isPending ? 'animate-spin' : ''}`} />
                                </Button>
                              )}
                              {nota.pdf_url && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(nota.pdf_url!, '_blank');
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <NovaNotaFiscalDialog
        open={showNovaNotaDialog}
        onOpenChange={setShowNovaNotaDialog}
        tipo={tipoNovaNota}
      />

      {selectedNota && (
        <DetalhesNotaDialog
          open={!!selectedNota}
          onOpenChange={(open) => !open && setSelectedNota(null)}
          nota={selectedNota}
        />
      )}
    </MainLayout>
  );
}
