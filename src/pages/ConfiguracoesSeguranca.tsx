import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Shield, Lock, Key, Clock, AlertTriangle, Smartphone, History } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";

interface SecuritySettings {
  id?: string;
  company_id: string;
  require_strong_password: boolean;
  password_expiry_days: number;
  session_timeout_minutes: number;
  two_factor_enabled: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
}

const defaultSettings: Omit<SecuritySettings, 'id' | 'company_id'> = {
  require_strong_password: true,
  password_expiry_days: 0,
  session_timeout_minutes: 480,
  two_factor_enabled: false,
  max_login_attempts: 5,
  lockout_duration_minutes: 15,
};

export default function ConfiguracoesSeguranca() {
  const { currentCompany, user } = useAuth();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['security-settings', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('company_security_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from('company_security_settings')
          .insert({ company_id: currentCompany.id, ...defaultSettings })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newSettings as SecuritySettings;
      }
      
      return data as SecuritySettings;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch recent login attempts
  const { data: loginAttempts = [] } = useQuery({
    queryKey: ['login-attempts', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      
      const { data, error } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) return [];
      return data || [];
    },
    enabled: !!user?.email,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: keyof SecuritySettings; value: boolean | number }) => {
      if (!settings?.id) throw new Error("Configurações não encontradas");
      
      const { error } = await supabase
        .from('company_security_settings')
        .update({ [field]: value, updated_at: new Date().toISOString() } as never)
        .eq('id', settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
      toast.success("Configuração atualizada!");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleToggle = (field: keyof SecuritySettings, value: boolean) => {
    updateMutation.mutate({ field, value });
  };

  const handleNumberChange = (field: keyof SecuritySettings, value: number) => {
    updateMutation.mutate({ field, value });
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas administradores podem acessar configurações de segurança.</p>
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6 pt-12 lg:pt-0">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 pt-12 lg:pt-0">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Link to="/configuracoes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Segurança</h1>
            <p className="text-muted-foreground mt-1">Configurações de senha, autenticação e proteção de acesso.</p>
          </div>
        </div>

        {/* Password Policies */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Políticas de Senha</CardTitle>
                <CardDescription>Configure as regras de criação e renovação de senhas.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div>
                <p className="font-medium">Exigir senha forte</p>
                <p className="text-sm text-muted-foreground">
                  Mínimo de 8 caracteres com letras maiúsculas, minúsculas, números e símbolos.
                </p>
              </div>
              <Switch
                checked={Boolean(settings?.require_strong_password)}
                onCheckedChange={(v) => handleToggle('require_strong_password', v)}
              />
            </div>

            <div className="p-4 rounded-xl bg-muted/50">
              <Label className="font-medium">Expiração de senha</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Força a troca de senha após um período. 0 = nunca expira.
              </p>
              <Select
                value={String(settings?.password_expiry_days || 0)}
                onValueChange={(v) => handleNumberChange('password_expiry_days', parseInt(v))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nunca expira</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                  <SelectItem value="365">1 ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Session Settings */}
        <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Sessão e Timeout</CardTitle>
                <CardDescription>Configure o tempo de inatividade antes do logout automático.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-xl bg-muted/50">
              <Label className="font-medium">Timeout de sessão</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Tempo máximo de inatividade antes de exigir novo login.
              </p>
              <Select
                value={String(settings?.session_timeout_minutes || 480)}
                onValueChange={(v) => handleNumberChange('session_timeout_minutes', parseInt(v))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="240">4 horas</SelectItem>
                  <SelectItem value="480">8 horas</SelectItem>
                  <SelectItem value="720">12 horas</SelectItem>
                  <SelectItem value="1440">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Auth */}
        <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Autenticação em Dois Fatores</CardTitle>
                <CardDescription>Adicione uma camada extra de segurança ao login.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div>
                <p className="font-medium">Habilitar 2FA</p>
                <p className="text-sm text-muted-foreground">
                  Exigir código de verificação além da senha ao fazer login.
                </p>
              </div>
              <Switch
                checked={Boolean(settings?.two_factor_enabled)}
                onCheckedChange={(v) => handleToggle('two_factor_enabled', v)}
              />
            </div>
            {settings?.two_factor_enabled && (
              <div className="mt-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    A autenticação em dois fatores requer configuração adicional. 
                    Cada usuário precisará configurar seu aplicativo autenticador.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Login Protection */}
        <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Proteção de Login</CardTitle>
                <CardDescription>Configure limites de tentativas de login e bloqueio automático.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <Label className="font-medium">Máximo de tentativas</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Número de erros antes do bloqueio.
                </p>
                <Input
                  type="number"
                  min={3}
                  max={10}
                  value={settings?.max_login_attempts || 5}
                  onChange={(e) => handleNumberChange('max_login_attempts', parseInt(e.target.value) || 5)}
                  className="w-24"
                />
              </div>

              <div className="p-4 rounded-xl bg-muted/50">
                <Label className="font-medium">Duração do bloqueio</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Tempo de espera após bloqueio (minutos).
                </p>
                <Select
                  value={String(settings?.lockout_duration_minutes || 15)}
                  onValueChange={(v) => handleNumberChange('lockout_duration_minutes', parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login History */}
        <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <History className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Histórico de Login</CardTitle>
                <CardDescription>Últimas tentativas de acesso à sua conta.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loginAttempts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum histórico de login registrado.
              </p>
            ) : (
              <div className="space-y-2">
                {loginAttempts.map((attempt) => (
                  <div 
                    key={attempt.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      attempt.success ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        attempt.success ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">
                          {attempt.success ? 'Login bem-sucedido' : 'Tentativa falha'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(attempt.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {attempt.user_agent && (
                      <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {attempt.user_agent.includes('Mobile') ? 'Dispositivo móvel' : 'Navegador desktop'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
