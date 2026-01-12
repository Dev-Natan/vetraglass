import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Download, 
  RefreshCw, 
  XCircle, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FileText,
  User,
  Building2,
  Copy
} from "lucide-react";

interface DetalhesNotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nota: {
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
    destinatario_email?: string | null;
    destinatario_telefone?: string | null;
    destinatario_endereco?: string | null;
    destinatario_cidade?: string | null;
    destinatario_uf?: string | null;
    destinatario_cep?: string | null;
    valor_produtos?: number;
    valor_servicos?: number;
    valor_total: number;
    natureza_operacao?: string;
    data_emissao: string | null;
    data_autorizacao: string | null;
    data_cancelamento?: string | null;
    pdf_url: string | null;
    xml_nota?: string | null;
    created_at: string;
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  pendente: { label: "Pendente", variant: "outline", icon: Clock },
  processando: { label: "Processando", variant: "secondary", icon: RefreshCw },
  autorizada: { label: "Autorizada", variant: "default", icon: CheckCircle },
  rejeitada: { label: "Rejeitada", variant: "destructive", icon: AlertCircle },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle },
};

export default function DetalhesNotaDialog({
  open,
  onOpenChange,
  nota,
}: DetalhesNotaDialogProps) {
  const queryClient = useQueryClient();

  // Buscar itens da nota
  const { data: itens } = useQuery({
    queryKey: ["nota-fiscal-itens", nota.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nota_fiscal_itens")
        .select("*")
        .eq("nota_fiscal_id", nota.id)
        .order("created_at");
      
      if (error) throw error;
      return data;
    },
    enabled: open && nota.tipo === "nfe",
  });

  const consultarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("focusnfe", {
        body: { action: "consultar", nota_id: nota.id },
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

  const cancelarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("focusnfe", {
        body: { 
          action: "cancelar", 
          nota_id: nota.id,
          payload: { justificativa: "Cancelamento solicitado pelo emissor" }
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais"] });
      toast.success("Nota cancelada com sucesso");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao cancelar nota: " + error.message);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const statusInfo = statusConfig[nota.status] || statusConfig.pendente;
  const StatusIcon = statusInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${nota.tipo === 'nfe' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>
                {nota.tipo.toUpperCase()} {nota.numero ? `#${nota.numero}` : '(Pendente)'}
                {nota.serie && <span className="text-muted-foreground ml-2">Série {nota.serie}</span>}
              </DialogTitle>
              <DialogDescription>
                Criada em {format(new Date(nota.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Badge variant={statusInfo.variant} className="gap-1 text-sm py-1 px-3">
                <StatusIcon className="h-4 w-4" />
                {statusInfo.label}
              </Badge>
              {nota.focusnfe_status && nota.focusnfe_status !== nota.status && (
                <span className="text-sm text-muted-foreground">
                  (Focusnfe: {nota.focusnfe_status})
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {(nota.status === 'processando' || nota.status === 'pendente') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => consultarMutation.mutate()}
                  disabled={consultarMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${consultarMutation.isPending ? 'animate-spin' : ''}`} />
                  Atualizar Status
                </Button>
              )}
            </div>
          </div>

          {/* Motivo de Rejeição */}
          {nota.motivo_rejeicao && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                <AlertCircle className="h-4 w-4" />
                Motivo da Rejeição
              </div>
              <p className="text-sm text-destructive/80">{nota.motivo_rejeicao}</p>
            </div>
          )}

          {/* Chave de Acesso */}
          {nota.chave_acesso && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Chave de Acesso</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                  {nota.chave_acesso}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(nota.chave_acesso!)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Destinatário */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Destinatário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{nota.destinatario_nome}</span>
              </div>
              {nota.destinatario_documento && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documento</span>
                  <span>{nota.destinatario_documento}</span>
                </div>
              )}
              {nota.destinatario_email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail</span>
                  <span>{nota.destinatario_email}</span>
                </div>
              )}
              {nota.destinatario_telefone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone</span>
                  <span>{nota.destinatario_telefone}</span>
                </div>
              )}
              {nota.destinatario_endereco && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Endereço</span>
                  <span>
                    {nota.destinatario_endereco}
                    {nota.destinatario_cidade && `, ${nota.destinatario_cidade}`}
                    {nota.destinatario_uf && ` - ${nota.destinatario_uf}`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Itens (para NF-e) */}
          {nota.tipo === "nfe" && itens && itens.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {itens.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantidade} {item.unidade} x {Number(item.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                      <span className="font-medium">
                        {Number(item.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Valores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Valores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {nota.tipo === "nfe" && nota.valor_produtos !== undefined && nota.valor_produtos > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor dos Produtos</span>
                  <span>{Number(nota.valor_produtos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
              {nota.tipo === "nfse" && nota.valor_servicos !== undefined && nota.valor_servicos > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor dos Serviços</span>
                  <span>{Number(nota.valor_servicos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{nota.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            {nota.data_emissao && (
              <div>
                <span className="text-muted-foreground block">Data de Emissão</span>
                <span className="font-medium">
                  {format(new Date(nota.data_emissao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
            {nota.data_autorizacao && (
              <div>
                <span className="text-muted-foreground block">Data de Autorização</span>
                <span className="font-medium">
                  {format(new Date(nota.data_autorizacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
            {nota.data_cancelamento && (
              <div>
                <span className="text-muted-foreground block">Data de Cancelamento</span>
                <span className="font-medium text-destructive">
                  {format(new Date(nota.data_cancelamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {nota.status === "autorizada" && (
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Tem certeza que deseja cancelar esta nota fiscal?")) {
                  cancelarMutation.mutate();
                }
              }}
              disabled={cancelarMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {cancelarMutation.isPending ? "Cancelando..." : "Cancelar Nota"}
            </Button>
          )}
          
          {nota.pdf_url && (
            <Button variant="outline" onClick={() => window.open(nota.pdf_url!, '_blank')}>
              <Download className="h-4 w-4 mr-1" />
              Baixar DANFE
            </Button>
          )}
          
          {nota.xml_nota && (
            <Button variant="outline" onClick={() => window.open(nota.xml_nota!, '_blank')}>
              <FileText className="h-4 w-4 mr-1" />
              Baixar XML
            </Button>
          )}

          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
