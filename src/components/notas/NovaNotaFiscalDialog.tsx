import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Send } from "lucide-react";

interface NovaNotaFiscalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "nfe" | "nfse";
  saleId?: string;
  ordemServicoId?: string;
}

interface ItemNota {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
}

export default function NovaNotaFiscalDialog({
  open,
  onOpenChange,
  tipo,
  saleId,
  ordemServicoId,
}: NovaNotaFiscalDialogProps) {
  const { currentCompany, user } = useAuth();
  const companyId = currentCompany?.id;
  const queryClient = useQueryClient();

  // Estados do formulário
  const [destinatarioTipo, setDestinatarioTipo] = useState<"cpf" | "cnpj">("cpf");
  const [destinatarioDocumento, setDestinatarioDocumento] = useState("");
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [destinatarioEmail, setDestinatarioEmail] = useState("");
  const [destinatarioTelefone, setDestinatarioTelefone] = useState("");
  const [destinatarioEndereco, setDestinatarioEndereco] = useState("");
  const [destinatarioCidade, setDestinatarioCidade] = useState("");
  const [destinatarioUf, setDestinatarioUf] = useState("");
  const [destinatarioCep, setDestinatarioCep] = useState("");
  
  const [naturezaOperacao, setNaturezaOperacao] = useState(
    tipo === "nfe" ? "Venda de mercadorias" : "Prestação de serviços"
  );
  const [informacoesComplementares, setInformacoesComplementares] = useState("");
  
  // Para NFS-e
  const [codigoServico, setCodigoServico] = useState("");
  const [discriminacaoServicos, setDiscriminacaoServicos] = useState("");
  const [valorServicos, setValorServicos] = useState(0);
  const [aliquotaIss, setAliquotaIss] = useState(5);

  // Itens para NF-e
  const [itens, setItens] = useState<ItemNota[]>([
    { codigo: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 0 }
  ]);

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const criarNotaMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !company) throw new Error("Empresa não encontrada");

      const valorTotal = tipo === "nfe" 
        ? itens.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0)
        : valorServicos;

      // Criar nota no banco
      const { data: nota, error: notaError } = await supabase
        .from("notas_fiscais")
        .insert({
          company_id: companyId,
          sale_id: saleId,
          ordem_servico_id: ordemServicoId,
          tipo,
          status: "processando",
          emitente_cnpj: company.cnpj,
          emitente_razao_social: company.name,
          destinatario_tipo: destinatarioTipo,
          destinatario_documento: destinatarioDocumento,
          destinatario_nome: destinatarioNome,
          destinatario_email: destinatarioEmail,
          destinatario_telefone: destinatarioTelefone,
          destinatario_endereco: destinatarioEndereco,
          destinatario_cidade: destinatarioCidade,
          destinatario_uf: destinatarioUf,
          destinatario_cep: destinatarioCep,
          natureza_operacao: naturezaOperacao,
          codigo_servico: tipo === "nfse" ? codigoServico : null,
          discriminacao_servicos: tipo === "nfse" ? discriminacaoServicos : null,
          valor_produtos: tipo === "nfe" ? valorTotal : 0,
          valor_servicos: tipo === "nfse" ? valorServicos : 0,
          valor_total: valorTotal,
          informacoes_complementares: informacoesComplementares,
          data_emissao: new Date().toISOString(),
        })
        .select()
        .single();

      if (notaError) throw notaError;

      // Se NF-e, inserir itens
      if (tipo === "nfe" && itens.length > 0) {
        const itensParaInserir = itens.map(item => ({
          nota_fiscal_id: nota.id,
          codigo: item.codigo,
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          valor_total: item.quantidade * item.valorUnitario,
        }));

        const { error: itensError } = await supabase
          .from("nota_fiscal_itens")
          .insert(itensParaInserir);

        if (itensError) throw itensError;
      }

      // Montar payload para Focusnfe
      let payload: Record<string, unknown>;

      if (tipo === "nfe") {
        payload = {
          natureza_operacao: naturezaOperacao,
          forma_pagamento: 0,
          tipo_documento: 1,
          finalidade_emissao: 1,
          cnpj_emitente: company.cnpj.replace(/\D/g, ''),
          nome_destinatario: destinatarioNome,
          ...(destinatarioTipo === "cpf" 
            ? { cpf_destinatario: destinatarioDocumento.replace(/\D/g, '') }
            : { cnpj_destinatario: destinatarioDocumento.replace(/\D/g, '') }
          ),
          email_destinatario: destinatarioEmail,
          logradouro_destinatario: destinatarioEndereco,
          municipio_destinatario: destinatarioCidade,
          uf_destinatario: destinatarioUf,
          cep_destinatario: destinatarioCep.replace(/\D/g, ''),
          items: itens.map((item, index) => ({
            numero_item: index + 1,
            codigo_produto: item.codigo || `PROD${index + 1}`,
            descricao: item.descricao,
            cfop: item.cfop,
            unidade_comercial: item.unidade,
            quantidade_comercial: item.quantidade,
            valor_unitario_comercial: item.valorUnitario,
            valor_bruto: item.quantidade * item.valorUnitario,
            ncm: item.ncm || "94036000", // NCM padrão para móveis
            icms_origem: "0",
            icms_situacao_tributaria: "102", // Simples Nacional
          })),
          informacoes_adicionais_contribuinte: informacoesComplementares,
        };
      } else {
        payload = {
          prestador: {
            cnpj: company.cnpj.replace(/\D/g, ''),
            inscricao_municipal: "", // Precisa ser configurado
            codigo_municipio: "", // Código IBGE
          },
          tomador: {
            ...(destinatarioTipo === "cpf" 
              ? { cpf: destinatarioDocumento.replace(/\D/g, '') }
              : { cnpj: destinatarioDocumento.replace(/\D/g, '') }
            ),
            razao_social: destinatarioNome,
            email: destinatarioEmail,
            telefone: destinatarioTelefone,
            endereco: {
              logradouro: destinatarioEndereco,
              codigo_municipio: "",
              uf: destinatarioUf,
              cep: destinatarioCep.replace(/\D/g, ''),
            },
          },
          servico: {
            aliquota: aliquotaIss,
            discriminacao: discriminacaoServicos,
            codigo_tributario_municipio: codigoServico,
            valor_servicos: valorServicos,
            iss_retido: false,
          },
        };
      }

      // Enviar para Focusnfe
      const { data: focusResult, error: focusError } = await supabase.functions.invoke("focusnfe", {
        body: {
          action: tipo === "nfe" ? "emitir_nfe" : "emitir_nfse",
          nota_id: nota.id,
          tipo,
          payload,
        },
      });

      if (focusError) {
        // Atualizar status para pendente se falhar
        await supabase
          .from("notas_fiscais")
          .update({ status: "pendente", motivo_rejeicao: focusError.message })
          .eq("id", nota.id);
        throw focusError;
      }

      return { nota, focusResult };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais"] });
      toast.success(`${tipo.toUpperCase()} enviada para processamento!`);
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao emitir nota: ${error.message}`);
    },
  });

  const resetForm = () => {
    setDestinatarioTipo("cpf");
    setDestinatarioDocumento("");
    setDestinatarioNome("");
    setDestinatarioEmail("");
    setDestinatarioTelefone("");
    setDestinatarioEndereco("");
    setDestinatarioCidade("");
    setDestinatarioUf("");
    setDestinatarioCep("");
    setNaturezaOperacao(tipo === "nfe" ? "Venda de mercadorias" : "Prestação de serviços");
    setInformacoesComplementares("");
    setCodigoServico("");
    setDiscriminacaoServicos("");
    setValorServicos(0);
    setAliquotaIss(5);
    setItens([{ codigo: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 0 }]);
  };

  const addItem = () => {
    setItens([...itens, { codigo: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 0 }]);
  };

  const removeItem = (index: number) => {
    if (itens.length > 1) {
      setItens(itens.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ItemNota, value: string | number) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    setItens(newItens);
  };

  const totalItens = itens.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tipo === "nfe" ? "Nova Nota Fiscal Eletrônica (NF-e)" : "Nova Nota Fiscal de Serviços (NFS-e)"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para emitir a nota fiscal via Focusnfe
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="destinatario" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="destinatario">Destinatário</TabsTrigger>
            <TabsTrigger value="itens">{tipo === "nfe" ? "Produtos" : "Serviço"}</TabsTrigger>
            <TabsTrigger value="adicionais">Informações Adicionais</TabsTrigger>
          </TabsList>

          <TabsContent value="destinatario" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={destinatarioTipo} onValueChange={(v) => setDestinatarioTipo(v as "cpf" | "cnpj")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                    <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{destinatarioTipo.toUpperCase()}</Label>
                <Input
                  value={destinatarioDocumento}
                  onChange={(e) => setDestinatarioDocumento(e.target.value)}
                  placeholder={destinatarioTipo === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome / Razão Social *</Label>
              <Input
                value={destinatarioNome}
                onChange={(e) => setDestinatarioNome(e.target.value)}
                placeholder="Nome completo ou razão social"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={destinatarioEmail}
                  onChange={(e) => setDestinatarioEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={destinatarioTelefone}
                  onChange={(e) => setDestinatarioTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={destinatarioEndereco}
                onChange={(e) => setDestinatarioEndereco(e.target.value)}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={destinatarioCidade}
                  onChange={(e) => setDestinatarioCidade(e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input
                  value={destinatarioUf}
                  onChange={(e) => setDestinatarioUf(e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={destinatarioCep}
                  onChange={(e) => setDestinatarioCep(e.target.value)}
                  placeholder="00000-000"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="itens" className="space-y-4 mt-4">
            {tipo === "nfe" ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Produtos da Nota</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {itens.map((item, index) => (
                    <Card key={index}>
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm">Item {index + 1}</CardTitle>
                          {itens.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="py-2 space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Código</Label>
                            <Input
                              value={item.codigo}
                              onChange={(e) => updateItem(index, "codigo", e.target.value)}
                              placeholder="SKU"
                            />
                          </div>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Descrição *</Label>
                            <Input
                              value={item.descricao}
                              onChange={(e) => updateItem(index, "descricao", e.target.value)}
                              placeholder="Descrição do produto"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">NCM</Label>
                            <Input
                              value={item.ncm}
                              onChange={(e) => updateItem(index, "ncm", e.target.value)}
                              placeholder="94036000"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CFOP</Label>
                            <Input
                              value={item.cfop}
                              onChange={(e) => updateItem(index, "cfop", e.target.value)}
                              placeholder="5102"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unidade</Label>
                            <Input
                              value={item.unidade}
                              onChange={(e) => updateItem(index, "unidade", e.target.value)}
                              placeholder="UN"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Quantidade</Label>
                            <Input
                              type="number"
                              value={item.quantidade}
                              onChange={(e) => updateItem(index, "quantidade", parseFloat(e.target.value) || 0)}
                              min={0}
                              step={0.01}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Valor Unit.</Label>
                            <Input
                              type="number"
                              value={item.valorUnitario}
                              onChange={(e) => updateItem(index, "valorUnitario", parseFloat(e.target.value) || 0)}
                              min={0}
                              step={0.01}
                            />
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          Subtotal: {(item.quantidade * item.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="text-right text-lg font-semibold border-t pt-4">
                  Total: {totalItens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código do Serviço (LC 116)</Label>
                    <Input
                      value={codigoServico}
                      onChange={(e) => setCodigoServico(e.target.value)}
                      placeholder="Ex: 14.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alíquota ISS (%)</Label>
                    <Input
                      type="number"
                      value={aliquotaIss}
                      onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                      step={0.01}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Discriminação dos Serviços *</Label>
                  <Textarea
                    value={discriminacaoServicos}
                    onChange={(e) => setDiscriminacaoServicos(e.target.value)}
                    placeholder="Descreva detalhadamente os serviços prestados..."
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Valor dos Serviços (R$) *</Label>
                  <Input
                    type="number"
                    value={valorServicos}
                    onChange={(e) => setValorServicos(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                  />
                </div>

                <div className="text-right text-lg font-semibold border-t pt-4">
                  ISS Estimado: {((valorServicos * aliquotaIss) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="adicionais" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Natureza da Operação</Label>
              <Input
                value={naturezaOperacao}
                onChange={(e) => setNaturezaOperacao(e.target.value)}
                placeholder={tipo === "nfe" ? "Venda de mercadorias" : "Prestação de serviços"}
              />
            </div>

            <div className="space-y-2">
              <Label>Informações Complementares</Label>
              <Textarea
                value={informacoesComplementares}
                onChange={(e) => setInformacoesComplementares(e.target.value)}
                placeholder="Informações adicionais que aparecerão na nota..."
                rows={4}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => criarNotaMutation.mutate()}
            disabled={criarNotaMutation.isPending || !destinatarioNome}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {criarNotaMutation.isPending ? "Enviando..." : "Emitir Nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
