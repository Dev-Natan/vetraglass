import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  KeyRound, 
  Calendar, 
  Clock, 
  Trash2, 
  Building2,
  Settings,
  RefreshCw,
  Award
} from "lucide-react";
import EditarDadosFiscaisDialog from "@/components/configuracoes/EditarDadosFiscaisDialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CertificateValidationResult {
  valid: boolean;
  passwordCorrect: boolean;
  expired: boolean;
  cnpj: string | null;
  cnpjMatch: boolean;
  subject: {
    commonName: string | null;
    organizationName: string | null;
  };
  issuer: {
    commonName: string | null;
    organizationName: string | null;
  };
  validFrom: string | null;
  validUntil: string | null;
  daysUntilExpiration: number | null;
  serialNumber: string | null;
  error?: string;
}

export function CertificadoEmpresaTab() {
  const { currentCompany } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<CertificateValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const certInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ["company-config", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", currentCompany.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const hasInscricaoMunicipal = !!(company as any)?.inscricao_municipal;
  const hasInscricaoEstadual = !!(company as any)?.inscricao_estadual;
  const hasCodigoIbge = !!(company as any)?.codigo_municipio_ibge;
  const isProducao = (company as any)?.ambiente_fiscal === "producao";
  const hasCertificate = !!(company as any)?.certificado_digital_url;
  const modoFiscalAtivo = !!(company as any)?.modo_fiscal_ativo;
  const certificateExpiration = (company as any)?.certificado_digital_validade 
    ? new Date((company as any).certificado_digital_validade) 
    : null;
  const isCertificateExpired = certificateExpiration ? isPast(certificateExpiration) : false;
  const daysUntilExpiration = certificateExpiration 
    ? differenceInDays(certificateExpiration, new Date()) 
    : null;

  const toggleModoFiscalMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      
      const { error } = await supabase
        .from('companies')
        .update({ modo_fiscal_ativo: enabled })
        .eq('id', currentCompany.id);
      
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast.success(enabled ? "Modo fiscal ativado!" : "Modo fiscal desativado!");
    },
    onError: (error) => {
      toast.error("Erro ao alterar modo fiscal: " + error.message);
    },
  });

  const uploadCertificateMutation = useMutation({
    mutationFn: async ({ file, password, validationData }: { 
      file: File; 
      password: string; 
      validationData: CertificateValidationResult;
    }) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      
      setUploadingCertificate(true);
      
      const fileName = `${currentCompany.id}/certificate.pfx`;
      
      if ((company as any)?.certificado_digital_url) {
        await supabase.storage.from('company-certificates').remove([fileName]);
      }
      
      const { error: uploadError } = await supabase.storage
        .from('company-certificates')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: signedData } = await supabase.storage
        .from('company-certificates')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);
      
      let certStatus: string = 'valido';
      if (validationData.expired) {
        certStatus = 'expirado';
      } else if (validationData.daysUntilExpiration !== null && validationData.daysUntilExpiration < 30) {
        certStatus = 'expirando';
      }
      
      const { error: updateError } = await supabase
        .from('companies')
        .update({ 
          certificado_digital_url: signedData?.signedUrl || fileName,
          certificado_digital_validade: validationData.validUntil,
          certificado_digital_nome: file.name,
          certificado_cnpj: validationData.cnpj,
          certificado_emissor: validationData.issuer?.commonName || validationData.issuer?.organizationName,
          certificado_serial: validationData.serialNumber,
          certificado_status: certStatus,
          certificado_ultima_verificacao: new Date().toISOString()
        })
        .eq('id', currentCompany.id);
      
      if (updateError) throw updateError;
      
      return fileName;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast.success("Certificado digital validado e enviado com sucesso!");
      setUploadingCertificate(false);
      setCertificateDialogOpen(false);
      setCertificateFile(null);
      setCertificatePassword("");
      setValidationResult(null);
    },
    onError: (error) => {
      toast.error(`Erro ao fazer upload do certificado: ${error.message}`);
      setUploadingCertificate(false);
    },
  });

  const removeCertificateMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) return;
      
      const fileName = `${currentCompany.id}/certificate.pfx`;
      await supabase.storage.from('company-certificates').remove([fileName]);
      
      const { error } = await supabase
        .from('companies')
        .update({ 
          certificado_digital_url: null,
          certificado_digital_validade: null,
          certificado_digital_nome: null,
          certificado_cnpj: null,
          certificado_emissor: null,
          certificado_serial: null,
          certificado_status: null,
          certificado_ultima_verificacao: null
        })
        .eq('id', currentCompany.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast.success("Certificado removido com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao remover certificado: ${error.message}`);
    },
  });

  const handleCertificateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validExtensions = ['.pfx', '.p12'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      toast.error("Por favor, selecione um arquivo .pfx ou .p12");
      return;
    }
    
    if (file.size > 50 * 1024) {
      toast.error("O arquivo do certificado deve ter no máximo 50KB.");
      return;
    }
    
    setCertificateFile(file);
    setValidationResult(null);
    setCertificateDialogOpen(true);
  };

  const validateCertificate = async () => {
    if (!certificateFile || !certificatePassword) {
      toast.error("Informe o arquivo e a senha do certificado.");
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const arrayBuffer = await certificateFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      bytes.forEach(byte => binary += String.fromCharCode(byte));
      const pfxBase64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke('validate-certificate', {
        body: {
          pfxBase64,
          password: certificatePassword,
          companyCnpj: currentCompany?.cnpj
        }
      });

      if (error) throw error;

      setValidationResult(data as CertificateValidationResult);

      if (data.error) {
        toast.error(data.error);
      } else if (!data.passwordCorrect) {
        toast.error("Senha do certificado incorreta");
      } else if (data.expired) {
        toast.warning("Certificado expirado! Você ainda pode fazer o upload, mas não poderá emitir notas fiscais.");
      } else if (!data.cnpjMatch) {
        toast.warning("O CNPJ do certificado não corresponde ao CNPJ da empresa.");
      } else {
        toast.success("Certificado validado com sucesso!");
      }
    } catch (error: any) {
      console.error("Error validating certificate:", error);
      toast.error(`Erro ao validar certificado: ${error.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleCertificateUpload = () => {
    if (!certificateFile || !certificatePassword || !validationResult) {
      toast.error("Valide o certificado antes de salvar.");
      return;
    }

    if (!validationResult.passwordCorrect) {
      toast.error("Corrija a senha do certificado.");
      return;
    }
    
    uploadCertificateMutation.mutate({
      file: certificateFile,
      password: certificatePassword,
      validationData: validationResult
    });
  };

  const verifyCertificate = async () => {
    if (!currentCompany?.id || !hasCertificate) return;

    setVerifying(true);
    try {
      const now = new Date();
      const expiration = certificateExpiration;
      
      let newStatus: string = 'valido';
      let daysLeft = daysUntilExpiration;
      
      if (expiration && isPast(expiration)) {
        newStatus = 'expirado';
      } else if (daysLeft !== null && daysLeft < 30) {
        newStatus = 'expirando';
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({ 
          certificado_status: newStatus,
          certificado_ultima_verificacao: new Date().toISOString()
        })
        .eq('id', currentCompany.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast.success("Status do certificado atualizado!");
    } catch (error: any) {
      console.error("Error verifying certificate:", error);
      toast.error(`Erro ao verificar certificado: ${error.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const fiscalChecks = [
    { label: "Inscrição Municipal", ok: hasInscricaoMunicipal },
    { label: "Inscrição Estadual", ok: hasInscricaoEstadual },
    { label: "Código IBGE", ok: hasCodigoIbge },
    { label: "Certificado Digital", ok: hasCertificate && !isCertificateExpired },
  ];
  const readyCount = fiscalChecks.filter(c => c.ok).length;

  return (
    <div className="space-y-6">
      {/* Fiscal Readiness Overview */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Status Fiscal
              </CardTitle>
              <CardDescription>
                Verifique se sua empresa está pronta para emitir notas fiscais
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">{readyCount}/{fiscalChecks.length}</div>
              <Badge variant={readyCount === fiscalChecks.length ? "default" : "secondary"}>
                {readyCount === fiscalChecks.length ? "Pronto" : "Pendente"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {fiscalChecks.map((check, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg border ${check.ok ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {check.ok ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className={`text-sm font-medium ${check.ok ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {check.ok ? "OK" : "Pendente"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{check.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modo Fiscal Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Modo Fiscal</h3>
                <p className="text-sm text-muted-foreground">
                  Ative para exibir campos fiscais (NCM, CFOP, etc.) nos produtos e itens
                </p>
              </div>
            </div>
            <Switch
              checked={modoFiscalAtivo}
              onCheckedChange={(checked) => toggleModoFiscalMutation.mutate(checked)}
              disabled={toggleModoFiscalMutation.isPending}
            />
          </div>
          {modoFiscalAtivo && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Modo fiscal ativo. Os campos fiscais serão exibidos na edição de produtos e itens.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Fiscal Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Dados Fiscais da Empresa
              </CardTitle>
              <CardDescription>
                Informações necessárias para emissão de notas fiscais
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isProducao ? "default" : "secondary"}>
                {isProducao ? "Produção" : "Homologação"}
              </Badge>
              <Button onClick={() => setEditDialogOpen(true)}>
                Editar Dados
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {hasInscricaoMunicipal ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <label className="text-sm font-medium text-muted-foreground">Inscrição Municipal</label>
              </div>
              <p className="text-foreground font-medium">
                {(company as any)?.inscricao_municipal || "Não configurada"}
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {hasInscricaoEstadual ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <label className="text-sm font-medium text-muted-foreground">Inscrição Estadual</label>
              </div>
              <p className="text-foreground font-medium">
                {(company as any)?.inscricao_estadual || "Não configurada"}
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {hasCodigoIbge ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <label className="text-sm font-medium text-muted-foreground">Código IBGE</label>
              </div>
              <p className="text-foreground font-medium">
                {(company as any)?.codigo_municipio_ibge || "Não configurado"}
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Regime Tributário</label>
              <p className="text-foreground font-medium capitalize">
                {((company as any)?.regime_tributario || "simples_nacional").replace("_", " ")}
              </p>
            </div>
          </div>

          {(!hasInscricaoMunicipal || !hasCodigoIbge) && (
            <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ Configure a Inscrição Municipal e o Código IBGE para emitir NFS-e.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Digital Certificate */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Certificado Digital A1
              </CardTitle>
              <CardDescription>
                Necessário para assinar digitalmente as notas fiscais eletrônicas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasCertificate && (
                <>
                  <Badge 
                    variant={isCertificateExpired ? "destructive" : daysUntilExpiration !== null && daysUntilExpiration < 30 ? "secondary" : "default"}
                  >
                    {isCertificateExpired 
                      ? "Expirado" 
                      : daysUntilExpiration !== null && daysUntilExpiration < 30 
                        ? `Expira em ${daysUntilExpiration} dias` 
                        : "Válido"
                    }
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={verifyCertificate}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Verificar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => removeCertificateMutation.mutate()}
                    disabled={removeCertificateMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasCertificate ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Arquivo</label>
                    <p className="text-foreground font-medium">
                      {(company as any)?.certificado_digital_nome || "certificate.pfx"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Validade</label>
                    <p className={`font-medium ${isCertificateExpired ? 'text-destructive' : 'text-foreground'}`}>
                      {certificateExpiration 
                        ? format(certificateExpiration, "dd/MM/yyyy", { locale: ptBR })
                        : "Não informada"
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <p className={`font-medium ${isCertificateExpired ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                      {isCertificateExpired 
                        ? "Certificado expirado"
                        : "Pronto para emitir"
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Award className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Emissor</label>
                    <p className="text-foreground font-medium text-sm">
                      {(company as any)?.certificado_emissor || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {((company as any)?.certificado_cnpj || (company as any)?.certificado_serial) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">CNPJ do Certificado</label>
                      <p className="text-foreground font-medium">
                        {(company as any)?.certificado_cnpj || "N/A"}
                      </p>
                      {(company as any)?.certificado_cnpj && currentCompany?.cnpj && (
                        <span className={`text-xs ${(company as any).certificado_cnpj.replace(/\D/g, '') === currentCompany.cnpj.replace(/\D/g, '') ? 'text-green-600' : 'text-amber-600'}`}>
                          {(company as any).certificado_cnpj.replace(/\D/g, '') === currentCompany.cnpj.replace(/\D/g, '') 
                            ? '✓ Corresponde à empresa' 
                            : '⚠ Não corresponde'
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <KeyRound className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Serial</label>
                      <p className="text-foreground font-medium text-xs font-mono">
                        {(company as any)?.certificado_serial ? 
                          (company as any).certificado_serial.substring(0, 16) + '...' : 
                          "N/A"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => certInputRef.current?.click()}
                  disabled={uploadingCertificate}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Atualizar Certificado
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <KeyRound className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-2">Nenhum certificado configurado</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Faça upload do seu certificado digital A1 (.pfx ou .p12) para poder assinar e emitir notas fiscais eletrônicas.
              </p>
              <Button onClick={() => certInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Enviar Certificado
              </Button>
            </div>
          )}

          <input
            ref={certInputRef}
            type="file"
            accept=".pfx,.p12"
            onChange={handleCertificateFileChange}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Certificate Upload Dialog */}
      <Dialog open={certificateDialogOpen} onOpenChange={setCertificateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Validar Certificado Digital</DialogTitle>
            <DialogDescription>
              Informe a senha do certificado para validá-lo antes de fazer o upload.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{certificateFile?.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tamanho: {certificateFile ? Math.round(certificateFile.size / 1024) : 0} KB
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cert-password">Senha do Certificado</Label>
              <Input
                id="cert-password"
                type="password"
                placeholder="Digite a senha do certificado"
                value={certificatePassword}
                onChange={(e) => setCertificatePassword(e.target.value)}
              />
            </div>

            {validationResult && (
              <div className={`p-4 rounded-lg border ${validationResult.passwordCorrect && !validationResult.expired ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'}`}>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  {validationResult.passwordCorrect && !validationResult.expired ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  Resultado da Validação
                </h4>
                <div className="text-sm space-y-1">
                  <p><strong>Titular:</strong> {validationResult.subject?.commonName || validationResult.subject?.organizationName || 'N/A'}</p>
                  <p><strong>CNPJ:</strong> {validationResult.cnpj || 'N/A'}</p>
                  <p><strong>Validade:</strong> {validationResult.validUntil ? format(new Date(validationResult.validUntil), 'dd/MM/yyyy') : 'N/A'}</p>
                  {validationResult.expired && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription>Certificado expirado!</AlertDescription>
                    </Alert>
                  )}
                  {!validationResult.cnpjMatch && validationResult.cnpj && (
                    <Alert className="mt-2">
                      <AlertDescription>O CNPJ do certificado não corresponde ao da empresa.</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCertificateDialogOpen(false)}>
              Cancelar
            </Button>
            {!validationResult?.passwordCorrect ? (
              <Button onClick={validateCertificate} disabled={validating || !certificatePassword}>
                {validating && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Validar
              </Button>
            ) : (
              <Button onClick={handleCertificateUpload} disabled={uploadingCertificate}>
                {uploadingCertificate && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Certificado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fiscal Data Dialog */}
      <EditarDadosFiscaisDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />
    </div>
  );
}