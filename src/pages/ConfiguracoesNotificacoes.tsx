import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Bell, Mail, BellRing, FileText, DollarSign, Package, Calendar, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationSettings {
  id?: string;
  company_id: string;
  email_new_quote: boolean;
  email_quote_approved: boolean;
  email_order_status: boolean;
  email_payment_received: boolean;
  email_low_stock: boolean;
  email_expense_due: boolean;
  notify_overdue_orders: boolean;
  notify_pending_quotes: boolean;
  notify_low_stock: boolean;
  notify_expense_alerts: boolean;
  daily_digest: boolean;
  weekly_report: boolean;
}

const defaultSettings: Omit<NotificationSettings, 'id' | 'company_id'> = {
  email_new_quote: true,
  email_quote_approved: true,
  email_order_status: true,
  email_payment_received: true,
  email_low_stock: true,
  email_expense_due: true,
  notify_overdue_orders: true,
  notify_pending_quotes: true,
  notify_low_stock: true,
  notify_expense_alerts: true,
  daily_digest: false,
  weekly_report: true,
};

export default function ConfiguracoesNotificacoes() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('company_notification_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        // Create default settings if they don't exist
        const { data: newSettings, error: insertError } = await supabase
          .from('company_notification_settings')
          .insert({ company_id: currentCompany.id, ...defaultSettings })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newSettings as NotificationSettings;
      }
      
      return data as NotificationSettings;
    },
    enabled: !!currentCompany?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: keyof NotificationSettings; value: boolean }) => {
      if (!settings?.id) throw new Error("Configurações não encontradas");
      
      const { error } = await supabase
        .from('company_notification_settings')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast.success("Configuração atualizada!");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleToggle = (field: keyof NotificationSettings, value: boolean) => {
    updateMutation.mutate({ field, value });
  };

  const emailNotifications = [
    { field: 'email_new_quote', label: 'Novo orçamento', description: 'Receber email quando um novo orçamento for criado', icon: FileText },
    { field: 'email_quote_approved', label: 'Orçamento aprovado', description: 'Receber email quando um orçamento for aprovado', icon: FileText },
    { field: 'email_order_status', label: 'Status de OS', description: 'Receber email quando o status de uma OS mudar', icon: Calendar },
    { field: 'email_payment_received', label: 'Pagamento recebido', description: 'Receber email ao registrar um pagamento', icon: DollarSign },
    { field: 'email_low_stock', label: 'Estoque baixo', description: 'Receber email quando um item atingir estoque mínimo', icon: Package },
    { field: 'email_expense_due', label: 'Despesa vencendo', description: 'Receber email antes do vencimento de despesas', icon: AlertCircle },
  ] as const;

  const systemNotifications = [
    { field: 'notify_overdue_orders', label: 'Ordens atrasadas', description: 'Mostrar alertas de ordens com prazo vencido', icon: Calendar },
    { field: 'notify_pending_quotes', label: 'Orçamentos pendentes', description: 'Alertar sobre orçamentos aguardando resposta', icon: FileText },
    { field: 'notify_low_stock', label: 'Estoque baixo', description: 'Alertar quando itens atingirem estoque mínimo', icon: Package },
    { field: 'notify_expense_alerts', label: 'Despesas vencendo', description: 'Alertar sobre despesas próximas do vencimento', icon: DollarSign },
  ] as const;

  const digestSettings = [
    { field: 'daily_digest', label: 'Resumo diário', description: 'Receber resumo diário das atividades por email' },
    { field: 'weekly_report', label: 'Relatório semanal', description: 'Receber relatório semanal com métricas' },
  ] as const;

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
            <h1 className="text-3xl font-display font-bold text-foreground">Notificações</h1>
            <p className="text-muted-foreground mt-1">Configure alertas por email e notificações do sistema.</p>
          </div>
        </div>

        {/* Email Notifications */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Notificações por Email</CardTitle>
                <CardDescription>Escolha quais eventos geram envio de email.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailNotifications.map((item) => (
              <div 
                key={item.field} 
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(settings?.[item.field])}
                  onCheckedChange={(v) => handleToggle(item.field, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System Notifications */}
        <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BellRing className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Alertas do Sistema</CardTitle>
                <CardDescription>Notificações exibidas dentro do sistema.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemNotifications.map((item) => (
              <div 
                key={item.field} 
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(settings?.[item.field])}
                  onCheckedChange={(v) => handleToggle(item.field, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Digest Settings */}
        <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Resumos e Relatórios</CardTitle>
                <CardDescription>Receba compilados periódicos das atividades.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {digestSettings.map((item) => (
              <div 
                key={item.field} 
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={Boolean(settings?.[item.field])}
                  onCheckedChange={(v) => handleToggle(item.field, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Info Card */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border animate-slide-up" style={{ animationDelay: '150ms' }}>
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> As notificações por email dependem de um serviço de email configurado. 
            Algumas notificações podem não ser enviadas se o sistema não tiver integração de email ativa.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
