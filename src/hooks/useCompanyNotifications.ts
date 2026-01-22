import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface CompanyNotification {
  id: string;
  company_id: string;
  from_user_id: string;
  to_role: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  action_taken: boolean;
  action_by: string | null;
  action_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useCompanyNotifications() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar notificações não lidas para admins/gerentes
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['company-notifications', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('company_notifications')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CompanyNotification[];
    },
    enabled: !!currentCompany?.id,
  });

  // Criar notificação
  const createNotificationMutation = useMutation({
    mutationFn: async (data: {
      type: string;
      title: string;
      message?: string;
      to_role: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!currentCompany?.id || !user?.id) throw new Error('Não autenticado');

      const insertData = {
        company_id: currentCompany.id,
        from_user_id: user.id,
        to_role: data.to_role,
        type: data.type,
        title: data.title,
        message: data.message || null,
        metadata: JSON.parse(JSON.stringify(data.metadata || {})),
      };

      const { error } = await supabase
        .from('company_notifications')
        .insert([insertData]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-notifications'] });
    },
  });

  // Marcar como lida
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('company_notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-notifications'] });
    },
  });

  // Marcar ação tomada
  const markActionTakenMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('company_notifications')
        .update({
          is_read: true,
          action_taken: true,
          action_by: user.id,
          action_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-notifications'] });
    },
  });

  // Realtime subscription para novas notificações
  useEffect(() => {
    if (!currentCompany?.id) return;

    const channel = supabase
      .channel('company-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_notifications',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        (payload) => {
          const notification = payload.new as CompanyNotification;
          queryClient.invalidateQueries({ queryKey: ['company-notifications'] });
          
          // Show toast for new notifications
          if (notification.type === 'cash_open_request') {
            toast.info('Nova solicitação de abertura de caixa!', {
              description: notification.title,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  // Helper to request cash opening
  const requestCashOpen = async () => {
    return createNotificationMutation.mutateAsync({
      type: 'cash_open_request',
      title: 'Solicitação de abertura de caixa',
      message: 'Um funcionário solicitou a abertura do caixa para registrar vendas.',
      to_role: 'admin,gerente',
    });
  };

  // Filter notifications by type
  const cashOpenRequests = notifications.filter(n => n.type === 'cash_open_request');

  return {
    notifications,
    cashOpenRequests,
    isLoading,
    refetch,
    createNotification: createNotificationMutation.mutateAsync,
    markAsRead: markAsReadMutation.mutateAsync,
    markActionTaken: markActionTakenMutation.mutateAsync,
    requestCashOpen,
    isRequestingCashOpen: createNotificationMutation.isPending,
  };
}
