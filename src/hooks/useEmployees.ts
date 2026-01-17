import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Employee {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  specialty: string | null;
  hourly_rate: number;
  is_active: boolean;
  notes: string | null;
  commission_enabled: boolean;
  commission_percent: number;
  commission_type: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmployees() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['employees', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!currentCompany?.id,
  });

  const createEmployee = useMutation({
    mutationFn: async (employeeData: Omit<Employee, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      const { data, error } = await supabase
        .from('employees')
        .insert({
          ...employeeData,
          company_id: currentCompany.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      toast.success('Funcionário cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating employee:', error);
      toast.error('Erro ao cadastrar funcionário: ' + error.message);
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, ...employeeData }: Partial<Employee> & { id: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      toast.success('Funcionário atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error updating employee:', error);
      toast.error('Erro ao atualizar funcionário: ' + error.message);
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      toast.success('Funcionário removido com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error deleting employee:', error);
      toast.error('Erro ao remover funcionário: ' + error.message);
    },
  });

  const toggleEmployeeStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('employees')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      toast.success(data.is_active ? 'Funcionário ativado!' : 'Funcionário desativado!');
    },
    onError: (error: Error) => {
      console.error('Error toggling employee status:', error);
      toast.error('Erro ao alterar status: ' + error.message);
    },
  });

  return {
    employees,
    isLoading,
    error,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeStatus,
  };
}
