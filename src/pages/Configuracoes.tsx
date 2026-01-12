import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Building2, Users, Palette, Bell, Shield, Database, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import EditarDadosFiscaisDialog from "@/components/configuracoes/EditarDadosFiscaisDialog";
import { Badge } from "@/components/ui/badge";

const settingsGroups = [
  {
    icon: Users,
    title: 'Usuários e Permissões',
    description: 'Controle o acesso dos funcionários ao sistema.',
  },
  {
    icon: Palette,
    title: 'Personalização',
    description: 'Customize cores, logotipo e aparência do sistema.',
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
                <p className="text-sm text-muted-foreground">Informações fiscais para emissão de notas</p>
              </div>
            </div>
            <Button onClick={() => setEditDialogOpen(true)}>
              Editar Dados
            </Button>
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
    </MainLayout>
  );
}
