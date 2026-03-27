import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PRICING_POLICY, type PricingPolicy } from '@/utils/pricingEngine';
import { toast } from 'sonner';

function mapRowToPolicy(row: any): PricingPolicy {
  return {
    marginType: row.margin_type || 'simple',
    defaultMargin: Number(row.default_margin) || 30,
    defaultLossPercent: Number(row.default_loss_percent) || 5,
    includeLabor: row.include_labor ?? false,
    laborCostPerSqm: Number(row.labor_cost_per_sqm) || 0,
    includePackaging: row.include_packaging ?? false,
    packagingCostPerUnit: Number(row.packaging_cost_per_unit) || 0,
    includeInstallation: row.include_installation ?? false,
    installationCostPerSqm: Number(row.installation_cost_per_sqm) || 0,
    includeTransport: row.include_transport ?? false,
    transportCostPerUnit: Number(row.transport_cost_per_unit) || 0,
    includeCommission: row.include_commission ?? false,
    commissionPercent: Number(row.commission_percent) || 0,
    includeTax: row.include_tax ?? false,
    taxPercent: Number(row.tax_percent) || 0,
    adminFee: Number(row.admin_fee) || 0,
    roundingMode: row.rounding_mode || 'round',
    priceDecimals: Number(row.price_decimals) ?? 2,
  };
}

function mapPolicyToRow(policy: PricingPolicy, companyId: string) {
  return {
    company_id: companyId,
    margin_type: policy.marginType,
    default_margin: policy.defaultMargin,
    default_loss_percent: policy.defaultLossPercent,
    include_labor: policy.includeLabor,
    labor_cost_per_sqm: policy.laborCostPerSqm,
    include_packaging: policy.includePackaging,
    packaging_cost_per_unit: policy.packagingCostPerUnit,
    include_installation: policy.includeInstallation,
    installation_cost_per_sqm: policy.installationCostPerSqm,
    include_transport: policy.includeTransport,
    transport_cost_per_unit: policy.transportCostPerUnit,
    include_commission: policy.includeCommission,
    commission_percent: policy.commissionPercent,
    include_tax: policy.includeTax,
    tax_percent: policy.taxPercent,
    admin_fee: policy.adminFee,
    rounding_mode: policy.roundingMode,
    price_decimals: policy.priceDecimals,
    updated_at: new Date().toISOString(),
  };
}

export function usePricingPolicy() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const queryClient = useQueryClient();

  const { data: policy, isLoading } = useQuery({
    queryKey: ['pricing-policy', companyId],
    queryFn: async () => {
      if (!companyId) return DEFAULT_PRICING_POLICY;
      const { data, error } = await supabase
        .from('pricing_policies')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_PRICING_POLICY;
      return mapRowToPolicy(data);
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (newPolicy: PricingPolicy) => {
      if (!companyId) throw new Error('Sem empresa');
      const row = mapPolicyToRow(newPolicy, companyId);
      
      const { data: existing } = await supabase
        .from('pricing_policies')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('pricing_policies')
          .update(row)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_policies')
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-policy', companyId] });
      toast.success('Política de preços salva!');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar: ' + err.message);
    },
  });

  return {
    policy: policy ?? DEFAULT_PRICING_POLICY,
    isLoading,
    savePolicy: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
