import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Building2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MunicipioIbgeSearch from "./MunicipioIbgeSearch";

interface EditarDadosFiscaisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditarDadosFiscaisDialog({
  open,
  onOpenChange,
}: EditarDadosFiscaisDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [codigoMunicipioIbge, setCodigoMunicipioIbge] = useState("");
  const [regimeTributario, setRegimeTributario] = useState("simples_nacional");
  const [ambienteFiscal, setAmbienteFiscal] = useState("homologacao");

  const { data: company, isLoading } = useQuery({
    queryKey: ["company-fiscal", companyId],
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
    enabled: !!companyId && open,
  });

  useEffect(() => {
    if (company) {
      setNome(company.name || "");
      setCnpj(company.cnpj || "");
      setEmail(company.email || "");
      setTelefone(company.phone || "");
      setEndereco(company.address || "");
      setInscricaoMunicipal((company as any).inscricao_municipal || "");
      setInscricaoEstadual((company as any).inscricao_estadual || "");
      setCodigoMunicipioIbge((company as any).codigo_municipio_ibge || "");
      setRegimeTributario((company as any).regime_tributario || "simples_nacional");
      setAmbienteFiscal((company as any).ambiente_fiscal || "homologacao");
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não encontrada");

      const { error } = await supabase
        .from("companies")
        .update({
          name: nome,
          cnpj: cnpj,
          email: email,
          phone: telefone,
          address: endereco,
          inscricao_municipal: inscricaoMunicipal || null,
          inscricao_estadual: inscricaoEstadual || null,
          codigo_municipio_ibge: codigoMunicipioIbge || null,
          regime_tributario: regimeTributario,
          ambiente_fiscal: ambienteFiscal,
        } as any)
        .eq("id", companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-fiscal"] });
      toast.success("Dados fiscais atualizados com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Dados Fiscais da Empresa
          </DialogTitle>
          <DialogDescription>
            Configure os dados necessários para emissão de NF-e e NFS-e
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-6">
            {/* Dados Básicos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Dados Básicos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Razão Social *</Label>
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Razão social da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ *</Label>
                    <Input
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(00) 0000-0000"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@empresa.com.br"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Endereço</Label>
                    <Input
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Rua, número, bairro, cidade - UF"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inscrições */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Inscrições Fiscais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Inscrição Municipal (IM)</Label>
                    <Input
                      value={inscricaoMunicipal}
                      onChange={(e) => setInscricaoMunicipal(e.target.value)}
                      placeholder="Número da IM"
                    />
                    <p className="text-xs text-muted-foreground">
                      Obrigatória para emissão de NFS-e
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Inscrição Estadual (IE)</Label>
                    <Input
                      value={inscricaoEstadual}
                      onChange={(e) => setInscricaoEstadual(e.target.value)}
                      placeholder="Número da IE"
                    />
                    <p className="text-xs text-muted-foreground">
                      Obrigatória para emissão de NF-e
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Município e Regime */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Município e Regime Tributário
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <MunicipioIbgeSearch
                      value={codigoMunicipioIbge}
                      onChange={(codigo) => setCodigoMunicipioIbge(codigo)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Regime Tributário</Label>
                    <Select value={regimeTributario} onValueChange={setRegimeTributario}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                        <SelectItem value="mei">MEI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ambiente Fiscal</Label>
                  <Select value={ambienteFiscal} onValueChange={setAmbienteFiscal}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">
                        Homologação (Testes)
                      </SelectItem>
                      <SelectItem value="producao">
                        Produção (Notas Reais)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Use "Homologação" para testes. Mude para "Produção" apenas quando estiver pronto para emitir notas reais.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => updateMutation.mutate()} 
            disabled={updateMutation.isPending || !nome || !cnpj}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
