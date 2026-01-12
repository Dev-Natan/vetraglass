import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementDismissal {
  id: string;
  announcement_id: string;
  user_id: string;
  dismissed_at: string;
}

export function useAnnouncements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active announcements for regular users
  const { data: announcements = [], isLoading: isLoadingAnnouncements } = useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Announcement[];
    },
    enabled: !!user,
  });

  // Fetch user's dismissals
  const { data: dismissals = [] } = useQuery({
    queryKey: ['announcement-dismissals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_dismissals')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;
      return data as AnnouncementDismissal[];
    },
    enabled: !!user,
  });

  // Filter out dismissed announcements
  const activeAnnouncements = announcements.filter(
    (announcement) => !dismissals.some((d) => d.announcement_id === announcement.id)
  );

  // Dismiss an announcement
  const dismissMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase
        .from('announcement_dismissals')
        .insert({
          announcement_id: announcementId,
          user_id: user!.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement-dismissals'] });
    },
  });

  return {
    announcements: activeAnnouncements,
    isLoading: isLoadingAnnouncements,
    dismissAnnouncement: dismissMutation.mutate,
  };
}

// Admin hook for managing all announcements
export function useAdminAnnouncements() {
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Announcement[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (announcement: Omit<Announcement, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('announcements')
        .insert(announcement)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Aviso criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar aviso: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Announcement> & { id: string }) => {
      const { data, error } = await supabase
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Aviso atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar aviso: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Aviso removido com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao remover aviso: ' + error.message);
    },
  });

  return {
    announcements,
    isLoading,
    createAnnouncement: createMutation.mutate,
    updateAnnouncement: updateMutation.mutate,
    deleteAnnouncement: deleteMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
