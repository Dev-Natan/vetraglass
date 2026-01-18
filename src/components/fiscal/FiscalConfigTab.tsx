import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { TaxDashboard } from '@/components/financeiro/TaxDashboard';
import { TaxReports } from '@/components/financeiro/TaxReports';
import { TaxCategories } from '@/components/financeiro/TaxCategories';
import { TaxConfigDialog } from '@/components/financeiro/TaxConfigDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Receipt, Tag } from 'lucide-react';

export function FiscalConfigTab() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [taxConfigOpen, setTaxConfigOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('dashboard');

  // Fetch sales for tax calculations
  const { data: sales = [] } = useQuery({
    queryKey: ['sales-fiscal', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch tax config
  const { data: taxConfig } = useQuery({
    queryKey: ['tax-config', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data } = await supabase
        .from('company_tax_config')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch tax categories
  const { data: taxCategories = [] } = useQuery({
    queryKey: ['tax-categories', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data } = await supabase
        .from('tax_categories')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name');
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch sale taxes
  const { data: saleTaxes = [] } = useQuery({
    queryKey: ['sale-taxes', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data } = await supabase
        .from('sale_taxes')
        .select('*')
        .eq('company_id', currentCompany.id);
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Save tax config mutation
  const saveTaxConfigMutation = useMutation({
    mutationFn: async (config: { regime_tributario: string; faixa_simples: number; aliquota_efetiva: number; anexo_simples: string; receita_bruta_12_meses: number }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const { data, error } = await supabase
        .from('company_tax_config')
        .upsert({ ...config, company_id: currentCompany.id }, { onConflict: 'company_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Configuração tributária salva!');
      queryClient.invalidateQueries({ queryKey: ['tax-config'] });
      setTaxConfigOpen(false);
    },
  });

  // Tax category mutations
  const addCategoryMutation = useMutation({
    mutationFn: async (cat: { name: string; ncm_code: string | null; description: string | null; aliquota_ibs: number; aliquota_cbs: number; aliquota_is: number }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const { error } = await supabase.from('tax_categories').insert({ ...cat, company_id: currentCompany.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-categories'] }),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; ncm_code: string | null; description: string | null; aliquota_ibs: number; aliquota_cbs: number; aliquota_is: number }> }) => {
      const { error } = await supabase.from('tax_categories').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-categories'] }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-categories'] }),
  });

  return (
    <div className="space-y-6">
      {/* Header with config button */}
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => setTaxConfigOpen(true)}>
          <Settings className="w-4 h-4" />
          Configurar Impostos
        </Button>
      </div>

      {/* Sub-tabs for fiscal content */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <Receipt className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-2">
            <Tag className="w-4 h-4" />
            Categorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <TaxDashboard 
            sales={sales} 
            taxConfig={taxConfig} 
            saleTaxes={saleTaxes} 
          />
        </TabsContent>

        <TabsContent value="relatorios" className="mt-6">
          <TaxReports 
            sales={sales} 
            taxConfig={taxConfig}
            company={currentCompany ? { name: currentCompany.name, cnpj: currentCompany.cnpj } : null}
          />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <TaxCategories
            categories={taxCategories}
            onAdd={async (cat) => { await addCategoryMutation.mutateAsync(cat); }}
            onUpdate={async (id, data) => { await updateCategoryMutation.mutateAsync({ id, data }); }}
            onDelete={async (id) => { await deleteCategoryMutation.mutateAsync(id); }}
            isLoading={addCategoryMutation.isPending || updateCategoryMutation.isPending || deleteCategoryMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Tax Config Dialog */}
      <TaxConfigDialog
        open={taxConfigOpen}
        onOpenChange={setTaxConfigOpen}
        config={taxConfig}
        onSave={(config) => saveTaxConfigMutation.mutateAsync(config)}
        isLoading={saveTaxConfigMutation.isPending}
      />
    </div>
  );
}
