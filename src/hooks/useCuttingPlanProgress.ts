import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CuttingPlanProgressData {
  totalPlans: number;
  totalItems: number;
  completedItems: number;
  progressPercent: number;
  status: 'pending' | 'in_progress' | 'completed';
  planDetails: Array<{
    id: string;
    productName: string;
    status: string;
    itemStatus: Record<string, boolean>;
    totalItems: number;
    completedItems: number;
  }>;
}

export function useCuttingPlanProgress(ordemServicoId: string | undefined) {
  return useQuery({
    queryKey: ['cutting-plan-progress', ordemServicoId],
    queryFn: async (): Promise<CuttingPlanProgressData> => {
      if (!ordemServicoId) {
        return {
          totalPlans: 0,
          totalItems: 0,
          completedItems: 0,
          progressPercent: 0,
          status: 'pending',
          planDetails: [],
        };
      }

      const { data, error } = await supabase
        .from('os_cutting_plan')
        .select('id, product_name, status, item_status, cuts_data, glass_cuts_data, quantity')
        .eq('ordem_servico_id', ordemServicoId);

      if (error) throw error;

      const plans = data || [];
      
      if (plans.length === 0) {
        return {
          totalPlans: 0,
          totalItems: 0,
          completedItems: 0,
          progressPercent: 0,
          status: 'pending',
          planDetails: [],
        };
      }

      let totalItems = 0;
      let completedItems = 0;
      const planDetails: CuttingPlanProgressData['planDetails'] = [];

      for (const plan of plans) {
        const cutsData = (plan.cuts_data as any[]) || [];
        const glassData = (plan.glass_cuts_data as any[]) || [];
        const itemStatus = (plan.item_status as Record<string, boolean>) || {};
        
        // Count total items (profiles + glass panels)
        const profileCount = cutsData.reduce((sum, cut) => sum + (cut.quantity || 1), 0) * (plan.quantity || 1);
        const glassCount = glassData.reduce((sum, glass) => sum + (glass.quantity || 1), 0) * (plan.quantity || 1);
        const planTotalItems = profileCount + glassCount;
        
        // Count completed items from item_status
        const planCompletedItems = Object.values(itemStatus).filter(v => v === true).length;
        
        totalItems += planTotalItems;
        completedItems += planCompletedItems;
        
        planDetails.push({
          id: plan.id,
          productName: plan.product_name,
          status: plan.status || 'pending',
          itemStatus,
          totalItems: planTotalItems,
          completedItems: planCompletedItems,
        });
      }

      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      
      // Determine overall status
      let status: 'pending' | 'in_progress' | 'completed' = 'pending';
      if (completedItems > 0 && completedItems < totalItems) {
        status = 'in_progress';
      } else if (completedItems >= totalItems && totalItems > 0) {
        status = 'completed';
      }

      return {
        totalPlans: plans.length,
        totalItems,
        completedItems,
        progressPercent,
        status,
        planDetails,
      };
    },
    enabled: !!ordemServicoId,
  });
}
