import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Users, Bell, Shield, Database, Upload, ImageIcon, Trash2, KeyRound, Save, Loader2, CreditCard } from 'lucide-react';
import EditarDadosFiscaisDialog from "@/components/configuracoes/EditarDadosFiscaisDialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const settingsGroups = [
  {
    icon: Users,
    title: 'Usuários e Permissões',
    description: 'Controle o acesso dos funcionários ao sistema.',
    path: '/configuracoes/usuarios',
  },
  {
    icon: CreditCard,
    title: 'Formas de Pagamento',
    description: 'Configure formas e condições de pagamento, descontos e juros.',
    path: '/configuracoes/pagamento',
  },
  {
    icon: Bell,
    title: 'Notificações',
    description: 'Configure alertas por email e notificações do sistema.',
    path: '/configuracoes/notificacoes',
  },
  {
    icon: Shield,
    title: 'Segurança',
    description: 'Configurações de senha, autenticação e backups.',
    path: '/configuracoes/seguranca',
  },
  {
    icon: Database,
    title: 'Dados e Exportação',
    description: 'Exporte dados e gerencie backups do sistema.',
    path: '/configuracoes/dados',
  },
];

export default function Configuracoes() {
  const { currentCompany, setCurrentCompany } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loginToken, setLoginToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      // Set login token when data loads
      if (data?.login_token && !loginToken) {
        setLoginToken(data.login_token);
      }
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const modoFiscalAtivo = !!(company as any)?.modo_fiscal_ativo;
  const hasCertificate = !!(company as any)?.certificado_digital_url;

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      
      setUploadingLogo(true);
      
      // Process image to have white background
      const processedFile = await processFileWithWhiteBackground(file);
      const fileName = `${currentCompany.id}/logo.png`;
      
      if (company?.logo_url) {
        const oldPath = company.logo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('company-logos').remove([oldPath]);
      }
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, processedFile, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);
      
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
      
      const oldPath = company.logo_url.split('/').slice(-2).join('/');
      await supabase.storage.from('company-logos').remove([oldPath]);
      
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem válida.");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }
    
    uploadLogoMutation.mutate(file);
  };

  const handleSaveLoginToken = async () => {
    if (!currentCompany?.id) return;
    
    const cleanToken = loginToken.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (cleanToken.length < 3) {
      toast.error("O token deve ter pelo menos 3 caracteres.");
      return;
    }

    setSavingToken(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ login_token: cleanToken })
        .eq('id', currentCompany.id);

      if (error) throw error;

      setLoginToken(cleanToken);
      queryClient.invalidateQueries({ queryKey: ["company-config"] });
      
      // Update currentCompany in context
      if (currentCompany) {
        setCurrentCompany({ ...currentCompany, login_token: cleanToken } as any);
      }
      
      toast.success("Token de login atualizado com sucesso!");
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSavingToken(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Personalize o sistema de acordo com suas necessidades.</p>
        </div>

        {/* Company Info */}
        <div className="glass-card rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold text-foreground">Dados da Empresa</h2>
                <p className="text-sm text-muted-foreground">Informações básicas e identidade visual para PDFs</p>
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
        </div>

        {/* Login Token Configuration */}
        <div className="glass-card rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold text-foreground">Token de Login</h2>
              <p className="text-sm text-muted-foreground">Identificador único para login dos funcionários</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="loginToken">Token da Empresa</Label>
                <Input
                  id="loginToken"
                  value={loginToken}
                  onChange={(e) => setLoginToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="VETRA"
                  maxLength={6}
                  className="font-mono uppercase"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSaveLoginToken} disabled={savingToken || !loginToken.trim()}>
                  {savingToken ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Token
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="font-medium mb-1">Como funciona:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Este token será usado para gerar os logins automáticos dos funcionários</li>
                <li>Exemplo: funcionário "João" terá login <span className="font-mono bg-background px-1 rounded">joao{loginToken || 'TOKEN'}</span></li>
                <li>Use 3-6 letras maiúsculas que identifiquem sua empresa</li>
                <li>Alterar o token não afeta logins já criados</li>
              </ul>
            </div>
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 animate-slide-up">
          {settingsGroups.map((group, index) => (
            <Link
              key={group.title}
              to={group.path}
              className="glass-card rounded-2xl p-6 text-left hover-lift group"
              style={{ animationDelay: `${(index + 1) * 50}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <group.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">{group.title}</h3>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <EditarDadosFiscaisDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />
    </MainLayout>
  );
}
