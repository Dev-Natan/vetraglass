import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RotateCcw, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type Rule = Tables<'product_parametric_rules'>;
type Override = Tables<'company_parametric_rule_overrides'>;

interface Props {
  companyId: string;
  productTemplateId: string;
}

export function ParametricEngineeringRulesPanel({ companyId, productTemplateId }: Props) {
  const queryClient = useQueryClient();
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [companyItemId, setCompanyItemId] = useState('__global__');
  const [formula, setFormula] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('');
  const [condition, setCondition] = useState('');
  const [disabled, setDisabled] = useState(false);

  const rulesQuery = useQuery({
    queryKey: ['parametric-engineering-rules-admin', productTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_parametric_rules')
        .select('*')
        .eq('product_template_id', productTemplateId)
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
  const overridesQuery = useQuery({
    queryKey: ['parametric-engineering-overrides', companyId, productTemplateId],
    queryFn: async () => {
      const ruleIds = (rulesQuery.data ?? []).map((rule) => rule.id);
      if (!ruleIds.length) return [] as Override[];
      const { data, error } = await supabase
        .from('company_parametric_rule_overrides')
        .select('*')
        .eq('company_id', companyId)
        .in('rule_id', ruleIds);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(rulesQuery.data?.length),
  });
  const companyItemsQuery = useQuery({
    queryKey: ['parametric-engineering-company-items', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_items')
        .select('id,name,item_template_id,is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const overrides = useMemo(
    () => new Map((overridesQuery.data ?? []).map((override) => [override.rule_id, override])),
    [overridesQuery.data],
  );

  useEffect(() => {
    if (!selectedRule) return;
    const override = overrides.get(selectedRule.id);
    setCompanyItemId(override?.company_item_id ?? '__global__');
    setFormula(
      override?.width_formula_override
      ?? override?.height_formula_override
      ?? override?.formula_override
      ?? selectedRule.width_formula
      ?? selectedRule.height_formula
      ?? selectedRule.formula
      ?? '',
    );
    setQuantityFormula(override?.quantity_formula_override ?? selectedRule.quantity_formula ?? '1');
    setCondition(override?.condition_override ?? selectedRule.condition_expression ?? '');
    setDisabled(override?.is_disabled ?? false);
  }, [selectedRule, overrides]);

  const saveOverride = useMutation({
    mutationFn: async () => {
      if (!selectedRule) return;
      const usesWidth = Boolean(selectedRule.width_formula);
      const usesHeight = !usesWidth && Boolean(selectedRule.height_formula);
      const { error } = await supabase
        .from('company_parametric_rule_overrides')
        .upsert({
          company_id: companyId,
          rule_id: selectedRule.id,
          company_item_id: companyItemId === '__global__' ? null : companyItemId,
          formula_override: usesWidth || usesHeight ? null : formula.trim() || null,
          width_formula_override: usesWidth ? formula.trim() || null : null,
          height_formula_override: usesHeight ? formula.trim() || null : null,
          quantity_formula_override: quantityFormula.trim() || null,
          condition_override: condition.trim() || null,
          is_disabled: disabled,
        }, { onConflict: 'company_id,rule_id' });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['parametric-engineering-overrides', companyId, productTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ['parametric-engineering'] });
      toast.success('Override da empresa salvo. O template global não foi alterado.');
      setSelectedRule(null);
    },
    onError: (error) => toast.error(`Falha ao salvar override: ${error.message}`),
  });

  const restoreGlobal = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('company_parametric_rule_overrides')
        .delete()
        .eq('company_id', companyId)
        .eq('rule_id', ruleId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['parametric-engineering-overrides', companyId, productTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ['parametric-engineering'] });
      toast.success('Padrão global restaurado.');
    },
    onError: (error) => toast.error(`Falha ao restaurar regra: ${error.message}`),
  });

  if (rulesQuery.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando engenharia…</CardContent></Card>;
  }
  if (!rulesQuery.data?.length) return null;

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="h-5 w-5 text-primary" />
              Engenharia / Composição paramétrica
            </CardTitle>
            <Badge>PARAMETRIC</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Regras globais são somente leitura. As personalizações abaixo pertencem exclusivamente à empresa.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Material</th>
                  <th className="px-3 py-2 text-left font-medium">Fórmula</th>
                  <th className="px-3 py-2 text-left font-medium">Quantidade</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                  <th className="px-3 py-2 text-center font-medium">Versão</th>
                  <th className="px-3 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rulesQuery.data.map((rule) => {
                  const override = overrides.get(rule.id);
                  return (
                    <tr key={rule.id} className="border-t">
                      <td className="px-3 py-2">
                        <p className="font-medium">{rule.rule_key}</p>
                        <p className="text-xs text-muted-foreground capitalize">{rule.material_type}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {override?.width_formula_override
                          ?? override?.height_formula_override
                          ?? override?.formula_override
                          ?? rule.width_formula
                          ?? rule.height_formula
                          ?? rule.formula}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {override?.quantity_formula_override ?? rule.quantity_formula ?? '1'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={rule.is_validated ? 'default' : 'secondary'}>
                            {rule.is_validated ? 'VALIDATED' : 'ESTIMATED'}
                          </Badge>
                          {override && <Badge variant="outline">override empresa</Badge>}
                          {override?.is_disabled && <Badge variant="destructive">desativada</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">v{rule.version}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedRule(rule)}>
                            {override ? 'Editar override' : 'Criar override'}
                          </Button>
                          {override && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => restoreGlobal.mutate(rule.id)}
                              disabled={restoreGlobal.isPending}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Padrão global
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rulesQuery.data.some((rule) => !rule.is_validated) && (
            <p className="mt-3 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Fórmulas estimadas precisam ser conferidas contra uma folha de corte real antes da produção.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRule)} onOpenChange={(open) => !open && setSelectedRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override da empresa</DialogTitle>
            <DialogDescription>
              A regra global e sua versão permanecem intactas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item da empresa</Label>
              <Select value={companyItemId} onValueChange={setCompanyItemId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">Resolver pelo item global</SelectItem>
                  {(companyItemsQuery.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fórmula de medida / folga</Label>
              <Input value={formula} onChange={(event) => setFormula(event.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Fórmula de quantidade</Label>
              <Input value={quantityFormula} onChange={(event) => setQuantityFormula(event.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Condição</Label>
              <Input value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="folhas == 2" className="font-mono" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Desativar esta regra para a empresa</Label>
              <Switch checked={disabled} onCheckedChange={setDisabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRule(null)}>Cancelar</Button>
            <Button onClick={() => saveOverride.mutate()} disabled={saveOverride.isPending || !formula.trim()}>
              Salvar override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
