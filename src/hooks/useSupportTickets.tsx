import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface SupportAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: number;
  company_id: string;
  user_id: string;
  subject: string;
  category: 'bug' | 'feature' | 'question' | 'billing' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  company?: {
    name: string;
  };
  last_message?: SupportMessage;
  unread_count?: number;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  is_admin: boolean;
  content: string;
  created_at: string;
  attachments?: SupportAttachment[];
}

export function useSupportTickets() {
  const { user, currentCompany, isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch tickets (company or all for admin)
  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['support-tickets', currentCompany?.id, isSaasAdmin],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!isSaasAdmin && currentCompany) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user && (!!currentCompany || isSaasAdmin),
  });

  // Fetch tickets with company info (for admin)
  const { data: adminTickets = [], isLoading: adminTicketsLoading, refetch: refetchAdminTickets } = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          company:companies(name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user && isSaasAdmin,
  });

  // Fetch messages for a specific ticket with attachments
  const useTicketMessages = (ticketId: string | null) => {
    return useQuery({
      queryKey: ['support-messages', ticketId],
      queryFn: async () => {
        if (!ticketId) return [];
        
        // Get messages
        const { data: messages, error: messagesError } = await supabase
          .from('support_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // Get attachments for all messages
        const messageIds = messages.map(m => m.id);
        const { data: attachments, error: attachmentsError } = await supabase
          .from('support_attachments')
          .select('*')
          .in('message_id', messageIds);

        if (attachmentsError) throw attachmentsError;

        // Merge attachments into messages
        const messagesWithAttachments = messages.map(message => ({
          ...message,
          attachments: attachments?.filter(a => a.message_id === message.id) || [],
        }));

        return messagesWithAttachments as SupportMessage[];
      },
      enabled: !!ticketId,
    });
  };

  // Create new ticket
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: {
      subject: string;
      category: string;
      priority: string;
      content: string;
    }) => {
      if (!currentCompany || !user) throw new Error('Sem empresa ou usuário');

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          company_id: currentCompany.id,
          user_id: user.id,
          subject: ticketData.subject,
          category: ticketData.category,
          priority: ticketData.priority,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create first message
      const { error: messageError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          is_admin: false,
          content: ticketData.content,
        });

      if (messageError) throw messageError;

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar ticket: ' + error.message);
    },
  });

  // Send message with optional attachments
  const sendMessageMutation = useMutation({
    mutationFn: async ({ 
      ticketId, 
      content, 
      files 
    }: { 
      ticketId: string; 
      content: string; 
      files?: File[];
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: message, error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          is_admin: isSaasAdmin,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload files if any
      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = `${ticketId}/${message.id}/${Date.now()}-${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('support-attachments')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          // Save attachment record
          await supabase
            .from('support_attachments')
            .insert({
              message_id: message.id,
              file_name: file.name,
              file_path: filePath,
              file_type: file.type,
              file_size: file.size,
            });
        }
      }

      // Update ticket status if admin is responding
      if (isSaasAdmin) {
        await supabase
          .from('support_tickets')
          .update({ status: 'waiting', updated_at: new Date().toISOString() })
          .eq('id', ticketId);
      } else {
        await supabase
          .from('support_tickets')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', ticketId);
      }

      return message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    },
    onError: (error) => {
      toast.error('Erro ao enviar mensagem: ' + error.message);
    },
  });

  // Update ticket status (admin only)
  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const uniqueId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Register ALL .on() handlers BEFORE calling .subscribe()
    const ticketsChannel = supabase.channel(`support-tickets-${uniqueId}`);
    ticketsChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'support_tickets' },
      () => {
        refetchTickets();
        if (isSaasAdmin) refetchAdminTickets();
      }
    );
    ticketsChannel.subscribe();

    const messagesChannel = supabase.channel(`support-messages-${uniqueId}`);
    messagesChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'support_messages' },
      (payload) => {
        const message = payload.new as SupportMessage;
        queryClient.invalidateQueries({ queryKey: ['support-messages', message.ticket_id] });

        if (message.is_admin && !isSaasAdmin) {
          toast.info('Nova resposta do suporte!');
        } else if (!message.is_admin && isSaasAdmin) {
          toast.info('Nova mensagem de cliente!');
        }
      }
    );
    messagesChannel.subscribe();

    return () => {
      ticketsChannel.unsubscribe();
      messagesChannel.unsubscribe();
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user, isSaasAdmin, queryClient, refetchTickets, refetchAdminTickets]);

  // Count open tickets
  const openTicketsCount = tickets.filter(t => 
    t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting'
  ).length;

  return {
    tickets,
    adminTickets,
    ticketsLoading,
    adminTicketsLoading,
    openTicketsCount,
    useTicketMessages,
    createTicket: createTicketMutation.mutate,
    createTicketLoading: createTicketMutation.isPending,
    sendMessage: sendMessageMutation.mutate,
    sendMessageLoading: sendMessageMutation.isPending,
    updateTicketStatus: updateTicketStatusMutation.mutate,
    updateTicketStatusLoading: updateTicketStatusMutation.isPending,
  };
}
