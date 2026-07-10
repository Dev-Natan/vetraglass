import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getNextSalaryDueDate, toISODate } from '@/utils/salaryDueDate';

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
  permission_profile_id: string | null;
  username: string | null;
  photo_url: string | null;
  admission_date: string | null;
  salary_payment_day: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Insere idempotentemente uma despesa mensal de salário para o funcionário.
 * Se já existir despesa `funcionarios` para o employee no mês do dueDate, não faz nada.
 */
async function ensureMonthlySalaryExpense(params: {
  companyId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  paymentDay: number;
  admissionDate: string | null;
}) {
  const dueDate = getNextSalaryDueDate(
    params.paymentDay,
    params.admissionDate ? new Date(params.admissionDate) : null,
  );
  const year = dueDate.getFullYear();
  const month = dueDate.getMonth();
  const monthStart = toISODate(new Date(year, month, 1));
  const monthEnd = toISODate(new Date(year, month + 1, 0));

  const { data: existing } = await supabase
    .from('expenses')
    .select('id')
    .eq('company_id', params.companyId)
    .eq('employee_id', params.employeeId)
    .eq('category', 'funcionarios')
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd)
    .maybeSingle();

  if (existing) return;

  await supabase.from('expenses').insert({
    company_id: params.companyId,
    category: 'funcionarios',
    description: `Salário - ${params.employeeName}`,
    amount: params.amount,
    due_date: toISODate(dueDate),
    status: 'pending',
    recurrence: 'monthly',
    recurrence_day: params.paymentDay,
    is_auto_generated: true,
    employee_id: params.employeeId,
    notes: 'Despesa gerada automaticamente a partir do cadastro do funcionário',
  });
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
    mutationFn: async (employeeData: Omit<Employee, 'id' | 'company_id' | 'created_at' | 'updated_at'> & { createSystemAccess?: boolean; password?: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      const { createSystemAccess, password, ...dataToInsert } = employeeData;

      const { data, error } = await supabase
        .from('employees')
        .insert({
          ...dataToInsert,
          company_id: currentCompany.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create automatic expense if employee has a salary (hourly_rate)
      if (employeeData.hourly_rate && employeeData.hourly_rate > 0) {
        const monthlyAmount = employeeData.hourly_rate;
        const nextDueDate = new Date();
        nextDueDate.setDate(5); // Day 5 of each month as default payment day
        if (nextDueDate.getDate() < 5) {
          // If we're before day 5, use current month
        } else {
          // If we're past day 5, use next month
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }

        await supabase.from('expenses').insert({
          company_id: currentCompany.id,
          category: 'funcionarios',
          description: `Salário - ${employeeData.name}`,
          amount: monthlyAmount,
          due_date: nextDueDate.toISOString().split('T')[0],
          status: 'pending',
          recurrence: 'monthly',
          employee_id: data.id,
          notes: 'Despesa gerada automaticamente ao cadastrar funcionário',
        });
      }

      // Create system access if requested (auto-generated login based)
      if (createSystemAccess && employeeData.username && password && employeeData.permission_profile_id) {
        const { data: accessResult, error: accessError } = await supabase.functions.invoke('create-employee-user', {
          body: {
            generatedLogin: employeeData.username, // username field now contains the auto-generated login
            password: password,
            employeeId: data.id,
            employeeName: employeeData.name,
            companyId: currentCompany.id,
            permissionProfileId: employeeData.permission_profile_id,
          },
        });

        if (accessError) {
          console.error('Error creating system access:', accessError);
          toast.warning('Funcionário cadastrado, mas houve erro ao criar acesso ao sistema: ' + (accessError.message || 'Erro desconhecido'));
        } else if (accessResult?.error) {
          toast.warning('Funcionário cadastrado, mas: ' + accessResult.error);
        } else if (accessResult?.success) {
          toast.success('Acesso ao sistema criado! O funcionário já pode fazer login.');
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Funcionário cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating employee:', error);
      toast.error('Erro ao cadastrar funcionário: ' + error.message);
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, createSystemAccess, password, ...employeeData }: Partial<Employee> & { id: string; createSystemAccess?: boolean; password?: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update or create expense when salary changes
      if (currentCompany?.id && employeeData.hourly_rate !== undefined) {
        // Check if expense already exists for this employee
        const { data: existingExpense } = await supabase
          .from('expenses')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('employee_id', id)
          .eq('category', 'funcionarios')
          .single();

        if (employeeData.hourly_rate > 0) {
          const nextDueDate = new Date();
          nextDueDate.setDate(5);
          if (nextDueDate.getDate() >= 5) {
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          }

          if (existingExpense) {
            // Update existing expense
            await supabase
              .from('expenses')
              .update({
                description: `Salário - ${employeeData.name || data.name}`,
                amount: employeeData.hourly_rate,
              })
              .eq('id', existingExpense.id);
          } else {
            // Create new expense
            await supabase.from('expenses').insert({
              company_id: currentCompany.id,
              category: 'funcionarios',
              description: `Salário - ${employeeData.name || data.name}`,
              amount: employeeData.hourly_rate,
              due_date: nextDueDate.toISOString().split('T')[0],
              status: 'pending',
              recurrence: 'monthly',
              employee_id: id,
              notes: 'Despesa gerada automaticamente ao atualizar funcionário',
            });
          }
        } else if (existingExpense) {
          // Remove expense if salary is zero or removed
          await supabase.from('expenses').delete().eq('id', existingExpense.id);
        }
      }

      // Create system access if requested and employee doesn't have user_id (auto-generated login based)
      if (createSystemAccess && !data.user_id && employeeData.username && password && employeeData.permission_profile_id) {
        const { data: accessResult, error: accessError } = await supabase.functions.invoke('create-employee-user', {
          body: {
            generatedLogin: employeeData.username, // username field now contains the auto-generated login
            password: password,
            employeeId: id,
            employeeName: employeeData.name || data.name,
            companyId: currentCompany?.id,
            permissionProfileId: employeeData.permission_profile_id,
          },
        });

        if (accessError) {
          console.error('Error creating system access:', accessError);
          toast.warning('Funcionário atualizado, mas houve erro ao criar acesso ao sistema: ' + (accessError.message || 'Erro desconhecido'));
        } else if (accessResult?.error) {
          toast.warning('Funcionário atualizado, mas: ' + accessResult.error);
        } else if (accessResult?.success) {
          toast.success('Acesso ao sistema criado! O funcionário já pode fazer login.');
          // Refetch to get updated user_id
          const { data: refreshed } = await supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .single();
          if (refreshed) return refreshed;
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
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
    mutationFn: async ({ id, is_active, user_id }: { id: string; is_active: boolean; user_id: string | null }) => {
      // First update the employee status
      const { error } = await supabase
        .from('employees')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;

      // If employee has system access, toggle their auth access too
      if (user_id) {
        const { data, error: fnError } = await supabase.functions.invoke('toggle-employee-access', {
          body: {
            employeeId: id,
            userId: user_id,
            isActive: is_active,
          },
        });

        if (fnError) {
          console.error('Error toggling employee access:', fnError);
          // Don't throw, the main status update succeeded
        } else {
          console.log('Toggle access result:', data);
        }
      }

      return { is_active, user_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees', currentCompany?.id] });
      const hasAccess = !!data.user_id;
      if (data.is_active) {
        toast.success('Funcionário ativado!');
      } else {
        toast.success(hasAccess 
          ? 'Funcionário desativado e acesso ao sistema revogado!' 
          : 'Funcionário desativado!');
      }
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
