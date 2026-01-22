import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EmployeeInvite {
  id: string;
  employee_id: string;
  company_id: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_by: string | null;
  created_at: string;
}

export function useEmployeeInvites() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['employee-invites', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('employee_invites')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmployeeInvite[];
    },
    enabled: !!currentCompany?.id,
  });

  const createInvite = useMutation({
    mutationFn: async ({
      employeeId,
      email,
      role,
      permissionProfileId,
    }: {
      employeeId: string;
      email: string;
      role: 'admin' | 'manager' | 'employee';
      permissionProfileId?: string;
    }) => {
      if (!currentCompany?.id || !user?.id) {
        throw new Error('Empresa ou usuário não encontrado');
      }

      // Generate a unique token
      const token = crypto.randomUUID();
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('employee_invites')
        .insert({
          employee_id: employeeId,
          company_id: currentCompany.id,
          email,
          role,
          token,
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update employee with permission profile if provided
      if (permissionProfileId) {
        await supabase
          .from('employees')
          .update({ permission_profile_id: permissionProfileId })
          .eq('id', employeeId);
      }

      // Call edge function to send email
      const { error: emailError } = await supabase.functions.invoke('send-employee-invite', {
        body: {
          email,
          token,
          companyName: currentCompany.name,
        },
      });

      if (emailError) {
        console.error('Error sending invite email:', emailError);
        toast.warning('Convite criado, mas houve um problema ao enviar o email. Copie o link manualmente.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-invites', currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      toast.success('Convite enviado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating invite:', error);
      toast.error('Erro ao criar convite: ' + error.message);
    },
  });

  const resendInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const invite = invites.find(i => i.id === inviteId);
      if (!invite) throw new Error('Convite não encontrado');

      // Update expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: updateError } = await supabase
        .from('employee_invites')
        .update({ expires_at: expiresAt.toISOString() })
        .eq('id', inviteId);

      if (updateError) throw updateError;

      // Resend email
      const { error: emailError } = await supabase.functions.invoke('send-employee-invite', {
        body: {
          email: invite.email,
          token: invite.token,
          companyName: currentCompany?.name,
        },
      });

      if (emailError) {
        console.error('Error resending invite email:', emailError);
        toast.warning('Convite atualizado, mas houve um problema ao reenviar o email.');
      }

      return invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-invites', currentCompany?.id] });
      toast.success('Convite reenviado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error resending invite:', error);
      toast.error('Erro ao reenviar convite: ' + error.message);
    },
  });

  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      // Set expiration to past
      const { error } = await supabase
        .from('employee_invites')
        .update({ expires_at: new Date(0).toISOString() })
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-invites', currentCompany?.id] });
      toast.success('Convite revogado!');
    },
    onError: (error: Error) => {
      console.error('Error revoking invite:', error);
      toast.error('Erro ao revogar convite: ' + error.message);
    },
  });

  const getInviteForEmployee = (employeeId: string): EmployeeInvite | null => {
    return invites.find(i => 
      i.employee_id === employeeId && 
      !i.accepted_at && 
      new Date(i.expires_at) > new Date()
    ) || null;
  };

  const getAcceptedInviteForEmployee = (employeeId: string): EmployeeInvite | null => {
    return invites.find(i => i.employee_id === employeeId && i.accepted_at) || null;
  };

  return {
    invites,
    isLoading,
    createInvite,
    resendInvite,
    revokeInvite,
    getInviteForEmployee,
    getAcceptedInviteForEmployee,
  };
}
