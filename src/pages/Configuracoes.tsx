import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Building2, Users, Bell, Shield, Database, FileText, CheckCircle, AlertCircle, Upload, ImageIcon, Trash2, KeyRound, Calendar, Clock, Receipt } from 'lucide-react';
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

const settingsGroups = [
  {
    icon: Users,
    title: 'Usuários e Permissões',
    description: 'Controle o acesso dos funcionários ao sistema.',
  },
  {
    icon: Bell,
    title: 'Notificações',
    description: 'Configure alertas por email e notificações do sistema.',
  },
  {
    icon: Shield,
    title: 'Segurança',
    description: 'Configurações de senha, autenticação e backups.',
  },
  {
    icon: Database,
    title: 'Dados e Exportação',
    description: 'Exporte dados e gerencie backups do sistema.',
  },
];

export default function Configuracoes() {
  const { currentCompany } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [certificateValidity, setCertificateValidity] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      
      setUploadingLogo(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/logo.${fileExt}`;
      
      // Delete old logo if exists
      if (company?.logo_url) {
        const oldPath = company.logo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('company-logos').remove([oldPath]);
      }
      
      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);
      
      // Update company with logo URL
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', currentCompany.id);
      
      if (updateError) throw updateError;
      
      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast.success("Logo atualizado com sucesso!");
      setUploadingLogo(false);
    },
    onError: (error) => {
      toast.error(`Erro ao fazer upload: ${error.message}`);
      setUploadingLogo(false);
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !company?.logo_url) return;
      
      // Remove from storage
      const oldPath = company.logo_url.split('/').slice(-2).join('/');
      await supabase.storage.from('company-logos').remove([oldPath]);
      
      // Update company
      const { error } = await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', currentCompany.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast.success("Logo removido com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao remover logo: ${error.message}`);
    },
  });

  // Certificate upload mutation
  const uploadCertificateMutation = useMutation({
    mutationFn: async ({ file, password, validUntil }: { file: File; password: string; validUntil: Date }) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      
      setUploadingCertificate(true);
      
      // Create file path
      const fileName = `${currentCompany.id}/certificate.pfx`;
      
      // Delete old certificate if exists
      if ((company as any)?.certificado_digital_url) {
        await supabase.storage.from('company-certificates').remove([fileName]);
      }
      
      // Upload new certificate
      const { error: uploadError } = await supabase.storage
        .from('company-certificates')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get signed URL for private bucket
      const { data: signedData } = await supabase.storage
        .from('company-certificates')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year
      
      // Update company with certificate info
      const { error: updateError } = await supabase
        .from('companies')
        .update({ 
          certificado_digital_url: signedData?.signedUrl || fileName,
          certificado_digital_validade: validUntil.toISOString(),
          certificado_digital_nome: file.name
        })
        .eq('id', currentCompany.id);
      
      if (updateError) throw updateError;
      
      return fileName;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      toast.success("Certificado digital enviado com sucesso!");
      setUploadingCertificate(false);
      setCertificateDialogOpen(false);
      setCertificateFile(null);
      setCertificatePassword("");
    },
    onError: (error) => {
      toast.error(`Erro ao fazer upload do certificado: ${error.message}`);
      setUploadingCertificate(false);
    },
  });

  const removeCertificateMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) return;
      
      // Remove from storage
      const fileName = `${currentCompany.id}/certificate.pfx`;
      await supabase.storage.from('company-certificates').remove([fileName]);
      
      // Update company
      const { error } = await supabase
        .from('companies')
        .update({ 
          certificado_digital_url: null,
          certificado_digital_validade: null,
          certificado_digital_nome: null
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem válida.");
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }
    
    uploadLogoMutation.mutate(file);
  };

  const handleCertificateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file extension
    const validExtensions = ['.pfx', '.p12'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      toast.error("Por favor, selecione um arquivo .pfx ou .p12");
      return;
    }
    
    // Validate file size (max 10KB typically for certificates)
    if (file.size > 50 * 1024) {
      toast.error("O arquivo do certificado deve ter no máximo 50KB.");
      return;
    }
    
    setCertificateFile(file);
    setCertificateDialogOpen(true);
  };

  const handleCertificateUpload = () => {
    if (!certificateFile || !certificatePassword || !certificateValidity) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    
    const validUntil = new Date(certificateValidity);
    
    uploadCertificateMutation.mutate({
      file: certificateFile,
      password: certificatePassword,
      validUntil
    });
  };

  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Personalize o sistema de acordo com suas necessidades.</p>
        </div>

        {/* Company Info & Fiscal Data */}
        <div className="glass-card rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold text-foreground">Dados da Empresa</h2>
                <p className="text-sm text-muted-foreground">Informações fiscais e identidade visual para PDFs</p>
              </div>
            </div>
            <Button onClick={() => setEditDialogOpen(true)}>
              Editar Dados
            </Button>
          </div>

          {/* Logo Section */}
          <div className="flex items-start gap-6 mb-6 pb-6 border-b border-border">
            <div className="flex-shrink-0">
              {company?.logo_url ? (
                <div className="relative group">
                  <img 
                    src={company.logo_url} 
                    alt="Logo da empresa" 
                    className="w-24 h-24 object-contain rounded-xl border border-border bg-background"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                      onClick={() => removeLogoMutation.mutate()}
                      disabled={removeLogoMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingLogo ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                  ) : (
                    <>
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Adicionar</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-medium text-foreground mb-1">Logo da Empresa</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Este logo será exibido nos orçamentos e contratos em PDF.
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PNG, JPG, WEBP. Tamanho máximo: 2MB.
                </p>
              </div>
              
              {/* Logo Size Slider */}
              {company?.logo_url && (
                <div className="pt-2">
                  <label className="text-sm font-medium text-muted-foreground block mb-2">
                    Tamanho do logo no PDF: {(company as any)?.logo_size || 40}mm
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    value={(company as any)?.logo_size || 40}
                    onChange={async (e) => {
                      const newSize = parseInt(e.target.value);
                      await supabase
                        .from('companies')
                        .update({ logo_size: newSize })
                        .eq('id', currentCompany?.id);
                      queryClient.invalidateQueries({ queryKey: ["company-config"] });
                    }}
                    className="w-full max-w-xs h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground max-w-xs mt-1">
                    <span>Pequeno (20mm)</span>
                    <span>Grande (80mm)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Razão Social</label>
              <p className="text-foreground mt-1">{company?.name || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">CNPJ</label>
              <p className="text-foreground mt-1">{company?.cnpj || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">E-mail</label>
              <p className="text-foreground mt-1">{company?.email || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Telefone</label>
              <p className="text-foreground mt-1">{company?.phone || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Endereço</label>
              <p className="text-foreground mt-1">{company?.address || "-"}</p>
            </div>
          </div>

          {/* Modo Fiscal Toggle */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
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
              <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ Modo fiscal ativo. Os campos fiscais serão exibidos na edição de produtos e itens.
                </p>
              </div>
            )}
          </div>

          {/* Fiscal Info */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Dados Fiscais</h3>
              <Badge variant={isProducao ? "default" : "secondary"}>
                {isProducao ? "Produção" : "Homologação"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-start gap-2">
                {hasInscricaoMunicipal ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Inscrição Municipal</label>
                  <p className="text-foreground text-sm">
                    {(company as any)?.inscricao_municipal || "Não configurada"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                {hasInscricaoEstadual ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Inscrição Estadual</label>
                  <p className="text-foreground text-sm">
                    {(company as any)?.inscricao_estadual || "Não configurada"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                {hasCodigoIbge ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Código IBGE</label>
                  <p className="text-foreground text-sm">
                    {(company as any)?.codigo_municipio_ibge || "Não configurado"}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Regime Tributário</label>
                <p className="text-foreground text-sm capitalize">
                  {((company as any)?.regime_tributario || "simples_nacional").replace("_", " ")}
                </p>
              </div>
            </div>

            {(!hasInscricaoMunicipal || !hasCodigoIbge) && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ Configure a Inscrição Municipal e o Código IBGE para emitir NFS-e.
                </p>
              </div>
            )}

            {/* Digital Certificate Section */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Certificado Digital A1</h3>
                  {hasCertificate && (
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
                  )}
                </div>
                {hasCertificate && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => removeCertificateMutation.mutate()}
                    disabled={removeCertificateMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>

              {hasCertificate ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Arquivo</label>
                      <p className="text-foreground text-sm">
                        {(company as any)?.certificado_digital_nome || "certificate.pfx"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Validade</label>
                      <p className={`text-sm ${isCertificateExpired ? 'text-destructive' : 'text-foreground'}`}>
                        {certificateExpiration 
                          ? format(certificateExpiration, "dd/MM/yyyy", { locale: ptBR })
                          : "Não informada"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className={`text-sm ${isCertificateExpired ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                        {isCertificateExpired 
                          ? "Certificado expirado - Renove para emitir notas"
                          : "Pronto para emitir notas fiscais"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      O certificado digital A1 é necessário para emitir notas fiscais eletrônicas (NF-e/NFS-e).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos aceitos: .pfx ou .p12
                    </p>
                  </div>
                  <Button onClick={() => certInputRef.current?.click()} disabled={uploadingCertificate}>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Certificado
                  </Button>
                  <input
                    ref={certInputRef}
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleCertificateFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {isCertificateExpired && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    ⚠️ Seu certificado digital expirou. Faça o upload de um novo certificado para continuar emitindo notas fiscais.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Other Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 animate-slide-up">
          {settingsGroups.map((group, index) => (
            <button
              key={group.title}
              className="glass-card rounded-2xl p-6 text-left hover-lift group"
              style={{ animationDelay: `${(index + 1) * 50}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <group.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">{group.title}</h3>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </button>
          ))}
        </div>
      </div>

      <EditarDadosFiscaisDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />

      {/* Certificate Password Dialog */}
      <Dialog open={certificateDialogOpen} onOpenChange={setCertificateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Certificado Digital</DialogTitle>
            <DialogDescription>
              Informe a senha do certificado e a data de validade para continuar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cert-file">Arquivo</Label>
              <p className="text-sm text-muted-foreground">{certificateFile?.name}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cert-password">Senha do Certificado *</Label>
              <Input
                id="cert-password"
                type="password"
                value={certificatePassword}
                onChange={(e) => setCertificatePassword(e.target.value)}
                placeholder="Digite a senha do certificado"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cert-validity">Data de Validade *</Label>
              <Input
                id="cert-validity"
                type="date"
                value={certificateValidity}
                onChange={(e) => setCertificateValidity(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                Informe a data de vencimento do certificado (geralmente 1 ano após a emissão)
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCertificateDialogOpen(false);
              setCertificateFile(null);
              setCertificatePassword("");
              setCertificateValidity("");
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCertificateUpload}
              disabled={!certificatePassword || !certificateValidity || uploadingCertificate}
            >
              {uploadingCertificate ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                  Enviando...
                </>
              ) : (
                "Salvar Certificado"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
