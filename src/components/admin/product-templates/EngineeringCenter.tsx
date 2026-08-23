import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Calculator, CheckCircle2, History, Plus, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useParametricEngineering } from '@/hooks/useParametricEngineering';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  buildEngineeringFormula,
  EngineeringFormulaTarget,
  EngineeringFormulaVariable,
  suggestCalibratedFormula,
} from '@/utils/engineeringFormulaBuilder';

type RuleRow = {
  id: string;
  product_template_id: string;
  rule_key: string;
  material_type: string;
  item_template_id: string | null;
  group_name: string;
  formula: string | null;
  width_formula: string | null;
  height_formula: string | null;
  quantity_formula: string | null;
  pieces_formula: string | null;
  pieces_quantity: number;
  condition_expression: string | null;
  unit: string;
  cut_orientation: string | null;
  cut_angle: string | null;
  version: number;
  is_active: boolean;
  is_validated: boolean;
  validation_source: string | null;
  technical_status: string;
  source_type: string | null;
  source_name: string | null;
  source_page: string | null;
  source_reference: string | null;
  supply_mode: string | null;
  change_reason: string | null;
  created_at: string;
  item_template: { id: string; name: string; type: string; unit: string } | null;
};

type VariantRow = {
  id: string;
  variant_key: string;
  label: string;
  input_type: string;
  allowed_values: unknown;
  default_value: unknown;
  is_active: boolean;
  sort_order: number;
  change_reason: string | null;
};

type RuleDraft = {
  rule_key: string;
  material_type: string;
  item_template_id: string;
  group_name: string;
  formula: string;
  width_formula: string;
  height_formula: string;
  quantity_formula: string;
  pieces_formula: string;
  pieces_quantity: string;
  condition_expression: string;
  unit: string;
  cut_orientation: string;
  cut_angle: string;
  is_active: boolean;
  is_validated: boolean;
  validation_source: string;
  technical_status: 'ESTIMATED' | 'VALIDATED' | 'REJECTED';
  source_type: string;
  source_name: string;
  source_page: string;
  source_reference: string;
  supply_mode: '' | 'INTERNAL_STOCK' | 'DEDICATED_PURCHASE';
  change_reason: string;
};

const emptyRule: RuleDraft = {
  rule_key: '', material_type: 'profile', item_template_id: '', group_name: 'Geral',
  formula: '', width_formula: '', height_formula: '', quantity_formula: '1',
  pieces_formula: '', pieces_quantity: '1', condition_expression: '', unit: 'un',
  cut_orientation: '', cut_angle: '90', is_active: true, is_validated: false,
  validation_source: '', change_reason: '',
  technical_status: 'ESTIMATED', source_type: '', source_name: '', source_page: '',
  source_reference: '', supply_mode: '',
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(value);

const parseJsonValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
};

interface Props {
  productTemplateId: string;
  line: string | null;
}

export function EngineeringCenter({ productTemplateId, line }: Props) {
  const queryClient = useQueryClient();
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [sourceRule, setSourceRule] = useState<RuleRow | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(emptyRule);
  const [validatedConfirmation, setValidatedConfirmation] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [ruleStatusTarget, setRuleStatusTarget] = useState<RuleRow | null>(null);
  const [ruleStatusReason, setRuleStatusReason] = useState('');
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [variantKey, setVariantKey] = useState('');
  const [variantLabel, setVariantLabel] = useState('');
  const [variantType, setVariantType] = useState('select');
  const [variantValues, setVariantValues] = useState('');
  const [variantDefault, setVariantDefault] = useState('');
  const [variantActive, setVariantActive] = useState(true);
  const [variantReason, setVariantReason] = useState('');
  const [variantSelections, setVariantSelections] = useState<Record<string, string | number | boolean>>({});
  const [companyId, setCompanyId] = useState('');
  const [width, setWidth] = useState(2000);
  const [height, setHeight] = useState(1200);
  const [quantity, setQuantity] = useState(1);
  const [glass, setGlass] = useState('Incolor');
  const [calculationRequested, setCalculationRequested] = useState(false);
  const [builderTarget, setBuilderTarget] = useState<EngineeringFormulaTarget>('width_formula');
  const [builderVariable, setBuilderVariable] = useState<EngineeringFormulaVariable>('L');
  const [builderAdjustment, setBuilderAdjustment] = useState(0);
  const [builderDivisor, setBuilderDivisor] = useState(1);
  const [calibrationReference, setCalibrationReference] = useState(0);
  const [calibrationMeasured, setCalibrationMeasured] = useState(0);

  const rulesQuery = useQuery({
    queryKey: ['saas-engineering-rules', productTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_parametric_rules')
        .select('*, item_template:item_templates(id,name,type,unit)')
        .eq('product_template_id', productTemplateId)
        .order('rule_key')
        .order('version', { ascending: false });
      if (error) throw error;
      return data as unknown as RuleRow[];
    },
  });

  const itemTemplatesQuery = useQuery({
    queryKey: ['saas-engineering-item-templates', line],
    queryFn: async () => {
      let query = supabase.from('item_templates').select('id,name,type,unit,linha').eq('is_active', true);
      if (line) query = query.or(`linha.eq.${line},linha.eq.Universal`);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    },
  });

  const variantsQuery = useQuery({
    queryKey: ['saas-engineering-variants', productTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variant_definitions')
        .select('*')
        .eq('product_template_id', productTemplateId)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as VariantRow[];
    },
  });

  const companiesQuery = useQuery({
    queryKey: ['saas-engineering-companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id,name').order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!companyId && companiesQuery.data?.length) setCompanyId(companiesQuery.data[0].id);
  }, [companyId, companiesQuery.data]);

  useEffect(() => {
    const activeVariants = (variantsQuery.data ?? []).filter((variant) => variant.is_active);
    setVariantSelections((current) => {
      const next: Record<string, string | number | boolean> = {};
      activeVariants.forEach((variant) => {
        const fallback = variant.default_value;
        const value = current[variant.variant_key] ?? fallback;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          next[variant.variant_key] = value;
        }
      });
      return next;
    });
  }, [variantsQuery.data]);

  const stockQuery = useQuery({
    queryKey: ['saas-engineering-stock', companyId, productTemplateId],
    queryFn: async () => {
      const itemIds = [...new Set((rulesQuery.data ?? []).filter((rule) => rule.is_active).map((rule) => rule.item_template_id).filter(Boolean))] as string[];
      if (!itemIds.length) return [];
      const { data, error } = await supabase
        .from('company_stock')
        .select('item_template_id,company_item_id,quantity,location')
        .eq('company_id', companyId)
        .in('item_template_id', itemIds);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(companyId && rulesQuery.data),
  });

  const engineering = useParametricEngineering({
    companyId: companyId || undefined,
    productTemplateId,
    width_mm: width,
    height_mm: height,
    quantity,
    line,
    glass,
    profile_color: null,
    glass_color: glass,
    variants: variantSelections,
    enabled: calculationRequested,
  });

  const activeRules = useMemo(() => (rulesQuery.data ?? []).filter((rule) => rule.is_active), [rulesQuery.data]);
  const activeVariants = useMemo(() => (variantsQuery.data ?? []).filter((variant) => variant.is_active), [variantsQuery.data]);
  const stockByTemplate = useMemo(
    () => new Map((stockQuery.data ?? []).map((row) => [row.item_template_id, row])),
    [stockQuery.data],
  );
  const priceCoverage = useMemo(() => {
    const materials = engineering.result?.materials ?? [];
    return {
      hasCost: materials.length > 0 && materials.every((material) => material.cost !== null),
      hasSalePrice: materials.length > 0 && materials.every((material) => material.sale_price !== null),
    };
  }, [engineering.result]);

  const openRule = (rule?: RuleRow) => {
    setSourceRule(rule ?? null);
    setValidatedConfirmation(false);
    setRuleDraft(rule ? {
      rule_key: rule.rule_key,
      material_type: rule.material_type,
      item_template_id: rule.item_template_id ?? '',
      group_name: rule.group_name,
      formula: rule.formula ?? '',
      width_formula: rule.width_formula ?? '',
      height_formula: rule.height_formula ?? '',
      quantity_formula: rule.quantity_formula ?? '1',
      pieces_formula: rule.pieces_formula ?? '',
      pieces_quantity: String(rule.pieces_quantity ?? 1),
      condition_expression: rule.condition_expression ?? '',
      unit: rule.unit,
      cut_orientation: rule.cut_orientation ?? '',
      cut_angle: rule.cut_angle ?? '90',
      is_active: rule.is_active,
      is_validated: rule.is_validated,
      validation_source: rule.validation_source ?? '',
      technical_status: rule.technical_status === 'VALIDATED' || rule.technical_status === 'REJECTED' ? rule.technical_status : 'ESTIMATED',
      source_type: rule.source_type ?? '',
      source_name: rule.source_name ?? '',
      source_page: rule.source_page ?? '',
      source_reference: rule.source_reference ?? '',
      supply_mode: rule.supply_mode === 'INTERNAL_STOCK' || rule.supply_mode === 'DEDICATED_PURCHASE' ? rule.supply_mode : '',
      change_reason: '',
    } : emptyRule);
    setRuleDialogOpen(true);
  };

  const applyVisualFormula = () => {
    try {
      const formula = buildEngineeringFormula(builderVariable, builderAdjustment, builderDivisor);
      setRuleDraft((current) => ({ ...current, [builderTarget]: formula }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível montar a fórmula.');
    }
  };

  const applyCalibrationSuggestion = () => {
    try {
      const suggestion = suggestCalibratedFormula({
        variable: builderVariable === 'A' ? 'A' : 'L',
        referenceDimensionMm: calibrationReference,
        measuredCutMm: calibrationMeasured,
        divisor: builderDivisor,
      });
      setRuleDraft((current) => ({
        ...current,
        [builderTarget]: suggestion.formula,
        is_validated: false,
        technical_status: suggestion.technicalStatus,
        validation_source: '',
      }));
      setValidatedConfirmation(false);
      toast.info(`Sugestão aplicada como ESTIMATED (ajuste ${suggestion.adjustmentMm} mm).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Calibração inválida.');
    }
  };

  const saveRule = useMutation({
    mutationFn: async () => {
      const payload = {
        ...ruleDraft,
        item_template_id: ruleDraft.item_template_id || null,
        pieces_quantity: Number(ruleDraft.pieces_quantity || 1),
        formula: ruleDraft.formula || null,
        width_formula: ruleDraft.width_formula || null,
        height_formula: ruleDraft.height_formula || null,
        pieces_formula: ruleDraft.pieces_formula || null,
        condition_expression: ruleDraft.condition_expression || null,
        cut_orientation: ruleDraft.cut_orientation || null,
        validation_source: ruleDraft.validation_source || null,
        technical_status: ruleDraft.is_validated ? 'VALIDATED' : ruleDraft.technical_status,
        source_type: ruleDraft.source_type || null,
        source_name: ruleDraft.source_name || null,
        source_page: ruleDraft.source_page || null,
        source_reference: ruleDraft.source_reference || null,
        supply_mode: ruleDraft.supply_mode || null,
      };
      const { error } = await supabase.rpc('create_product_parametric_rule_version', {
        _source_rule_id: sourceRule?.id ?? null,
        _product_template_id: productTemplateId,
        _rule: payload,
        _change_reason: ruleDraft.change_reason,
        _confirm_validated: validatedConfirmation,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saas-engineering-rules', productTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ['parametric-engineering'] });
      toast.success(sourceRule ? 'Nova versão criada; histórico preservado.' : 'Regra global criada.');
      setRuleDialogOpen(false);
    },
    onError: (error) => toast.error(`Falha ao versionar regra: ${error.message}`),
  });

  const setRuleActive = useMutation({
    mutationFn: async () => {
      if (!ruleStatusTarget) return;
      const { error } = await supabase.rpc('set_product_parametric_rule_active', {
        _rule_id: ruleStatusTarget.id,
        _is_active: !ruleStatusTarget.is_active,
        _change_reason: ruleStatusReason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saas-engineering-rules', productTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ['parametric-engineering'] });
      toast.success(ruleStatusTarget?.is_active ? 'Regra desativada; histórico preservado.' : 'Versão reativada.');
      setRuleStatusTarget(null);
      setRuleStatusReason('');
    },
    onError: (error) => toast.error(`Falha ao alterar status: ${error.message}`),
  });

  const saveVariant = useMutation({
    mutationFn: async () => {
      const values = variantValues.split(',').map((value) => value.trim()).filter(Boolean).map((value) => {
        const numeric = Number(value);
        return Number.isNaN(numeric) ? value : numeric;
      });
      const defaultNumeric = Number(variantDefault);
      const payload = {
        product_template_id: productTemplateId,
        variant_key: variantKey.trim(), label: variantLabel.trim(), input_type: variantType,
        allowed_values: values, default_value: Number.isNaN(defaultNumeric) ? variantDefault : defaultNumeric,
        is_active: variantActive,
        change_reason: variantReason.trim(),
      };
      const query = variantId
        ? supabase.from('product_variant_definitions').update(payload).eq('id', variantId)
        : supabase.from('product_variant_definitions').insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saas-engineering-variants', productTemplateId] });
      toast.success('Variação salva.');
      setVariantDialogOpen(false);
    },
    onError: (error) => toast.error(`Falha ao salvar variação: ${error.message}`),
  });

  const openVariant = (variant?: VariantRow) => {
    setVariantId(variant?.id ?? null);
    setVariantKey(variant?.variant_key ?? '');
    setVariantLabel(variant?.label ?? '');
    setVariantType(variant?.input_type ?? 'select');
    setVariantValues(parseJsonValue(variant?.allowed_values));
    setVariantDefault(parseJsonValue(variant?.default_value));
    setVariantActive(variant?.is_active ?? true);
    setVariantReason('');
    setVariantDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Settings2 className="h-5 w-5" /> Centro de Engenharia</h3>
          <p className="text-sm text-muted-foreground">Regras globais versionadas, variações e simulação sem criar orçamento.</p>
        </div>
        <Badge variant={activeRules.every((rule) => rule.is_validated) ? 'default' : 'secondary'}>
          {activeRules.every((rule) => rule.is_validated) ? 'VALIDATED' : 'ESTIMATED'}
        </Badge>
      </div>

      <Tabs defaultValue="regras">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="regras">Engenharia</TabsTrigger>
          <TabsTrigger value="variacoes">Variações</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="space-y-3">
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setShowHistory((value) => !value)}><History className="mr-2 h-4 w-4" />{showHistory ? 'Ocultar histórico' : 'Mostrar histórico'}</Button>
            <Button onClick={() => openRule()}><Plus className="mr-2 h-4 w-4" />Adicionar regra</Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground"><tr>
                <th className="p-2">Material / código</th><th className="p-2">Grupo</th><th className="p-2">Fórmula</th>
                <th className="p-2">Qtd.</th><th className="p-2">Condição</th><th className="p-2">Corte</th>
                <th className="p-2">Versão</th><th className="p-2">Status</th><th className="p-2 text-right">Ação</th>
              </tr></thead>
              <tbody>{(rulesQuery.data ?? []).filter((rule) => showHistory || rule.is_active).map((rule) => (
                <tr key={rule.id} className={rule.is_active ? 'border-t' : 'border-t bg-muted/30 text-muted-foreground'}>
                  <td className="p-2"><p className="font-medium">{rule.item_template?.name ?? 'Sem material'}</p><p className="font-mono text-xs">{rule.rule_key} · {rule.material_type}</p></td>
                  <td className="p-2">{rule.group_name}</td>
                  <td className="p-2 font-mono text-xs">{rule.width_formula ?? rule.height_formula ?? rule.formula ?? '—'}</td>
                  <td className="p-2 font-mono text-xs">{rule.quantity_formula ?? '1'} {rule.unit}</td>
                  <td className="p-2 font-mono text-xs">{rule.condition_expression ?? '—'}</td>
                  <td className="p-2">{rule.cut_orientation ?? '—'} {rule.cut_angle ? `· ${rule.cut_angle}°` : ''}</td>
                  <td className="p-2">v{rule.version}</td>
                  <td className="p-2"><div className="flex flex-col gap-1"><Badge variant={rule.is_validated ? 'default' : 'secondary'}>{rule.is_validated ? 'VALIDATED' : 'ESTIMATED'}</Badge><Badge variant={rule.is_active ? 'outline' : 'destructive'}>{rule.is_active ? 'ATIVA' : 'HISTÓRICA'}</Badge></div></td>
                  <td className="p-2 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openRule(rule)}>Criar versão</Button><Button size="sm" variant={rule.is_active ? 'destructive' : 'secondary'} onClick={() => { setRuleStatusTarget(rule); setRuleStatusReason(''); }}>{rule.is_active ? 'Desativar' : 'Reativar'}</Button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="variacoes" className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => openVariant()}><Plus className="mr-2 h-4 w-4" />Adicionar variação</Button></div>
          <div className="grid gap-3 md:grid-cols-2">
            {(variantsQuery.data ?? []).map((variant) => (
              <Card key={variant.id}><CardHeader className="pb-2"><div className="flex justify-between"><CardTitle className="text-base">{variant.label}</CardTitle><Badge variant={variant.is_active ? 'default' : 'secondary'}>{variant.is_active ? 'ATIVA' : 'INATIVA'}</Badge></div><CardDescription>{variant.variant_key} · {variant.input_type}</CardDescription></CardHeader><CardContent className="flex items-center justify-between"><span className="text-sm">Valores: {parseJsonValue(variant.allowed_values)} · padrão {parseJsonValue(variant.default_value)}</span><Button size="sm" variant="outline" onClick={() => openVariant(variant)}>Editar</Button></CardContent></Card>
            ))}
          </div>
          <Card className="border-dashed"><CardContent className="pt-6 text-sm text-muted-foreground">Arquitetura preparada para bandeira, tela, contramarco, preenchimento, vidro duplo, peitoril, trilho e fixos laterais. Estas opções ainda não alteram o motor nesta fase.</CardContent></Card>
        </TabsContent>

        <TabsContent value="simulador" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Simulador técnico global</CardTitle><CardDescription>Executa o motor paramétrico real sem criar empresa, orçamento, venda, OS, estoque ou preço.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2"><Label>Contexto de custo/preço</Label><Select value={companyId || '__global__'} onValueChange={(value) => { setCompanyId(value === '__global__' ? '' : value); setCalculationRequested(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__global__">Catálogo global — sem empresa</SelectItem>{(companiesQuery.data ?? []).map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Largura (mm)</Label><Input type="number" value={width} onChange={(event) => { setWidth(Number(event.target.value)); setCalculationRequested(false); }} /></div>
            <div><Label>Altura (mm)</Label><Input type="number" value={height} onChange={(event) => { setHeight(Number(event.target.value)); setCalculationRequested(false); }} /></div>
            <div><Label>Quantidade</Label><Input type="number" min={1} value={quantity} onChange={(event) => { setQuantity(Number(event.target.value)); setCalculationRequested(false); }} /></div>
            <div><Label>Vidro</Label><Input value={glass} onChange={(event) => { setGlass(event.target.value); setCalculationRequested(false); }} /></div>
            {activeVariants.map((variant) => {
              const allowedValues = Array.isArray(variant.allowed_values) ? variant.allowed_values : [];
              const currentValue = variantSelections[variant.variant_key];
              if (variant.input_type === 'boolean') {
                return <div key={variant.id} className="flex items-center justify-between rounded-md border p-3"><Label>{variant.label}</Label><Switch checked={Boolean(currentValue)} onCheckedChange={(value) => { setVariantSelections((current) => ({ ...current, [variant.variant_key]: value })); setCalculationRequested(false); }} /></div>;
              }
              if (variant.input_type === 'select') {
                return <div key={variant.id}><Label>{variant.label}</Label><Select value={String(currentValue ?? '')} onValueChange={(value) => { const numeric = Number(value); setVariantSelections((current) => ({ ...current, [variant.variant_key]: Number.isNaN(numeric) ? value : numeric })); setCalculationRequested(false); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{allowedValues.map((value) => <SelectItem key={String(value)} value={String(value)}>{String(value)}</SelectItem>)}</SelectContent></Select></div>;
              }
              return <div key={variant.id}><Label>{variant.label}</Label><Input type={variant.input_type === 'number' ? 'number' : 'text'} value={String(currentValue ?? '')} onChange={(event) => { const value = variant.input_type === 'number' ? Number(event.target.value) : event.target.value; setVariantSelections((current) => ({ ...current, [variant.variant_key]: value })); setCalculationRequested(false); }} /></div>;
            })}
            <div className="md:col-span-6 flex items-end justify-between gap-3"><p className="text-sm text-muted-foreground">Linha {line ?? '—'} · {companyId ? 'custos da empresa selecionada' : 'sem custos/preços empresariais'}</p><Button onClick={() => setCalculationRequested(true)} disabled={width <= 0 || height <= 0 || quantity <= 0}>CALCULAR</Button></div>
          </CardContent></Card>

          {engineering.calculationError && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{engineering.calculationError.message}</div>}
          {engineering.result && <>
            <div className="grid gap-3 md:grid-cols-3"><Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Custo</p><p className="text-xl font-semibold">{priceCoverage.hasCost ? money(engineering.result.totals.cost) : 'Indisponível'}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Venda</p><p className="text-xl font-semibold">{priceCoverage.hasSalePrice ? money(engineering.result.totals.sale_price) : 'Indisponível'}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Margem bruta</p><p className="text-xl font-semibold">{priceCoverage.hasCost && priceCoverage.hasSalePrice ? money(engineering.result.totals.margin) : 'Indisponível'}</p></CardContent></Card></div>
            <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/60 text-left"><tr><th className="p-2">Material</th><th className="p-2">Tipo</th><th className="p-2">Quantidade</th><th className="p-2">Cortes / vidro</th><th className="p-2">Vínculo</th><th className="p-2">Regra</th></tr></thead><tbody>{engineering.result.materials.map((material) => {
              const stock = material.item_template_id ? stockByTemplate.get(material.item_template_id) : undefined;
              const mapping = !material.item_template_id ? 'INVALID_MAPPING' : !companyId ? 'GLOBAL_CATALOG' : !material.company_item_id ? 'MISSING_COMPANY_ITEM' : material.cost === null || material.sale_price === null ? 'MISSING_PRICE' : 'LINKED';
              return <tr key={`${material.source_rule_id}-${material.item_template_id}`} className="border-t"><td className="p-2 font-medium">{material.item_name}<p className="font-mono text-xs text-muted-foreground">{material.item_template_id ?? 'sem item_template'}</p></td><td className="p-2">{material.material_type}</td><td className="p-2">{material.quantity} {material.unit}</td><td className="p-2 font-mono text-xs">{material.cuts_mm.length ? material.cuts_mm.join(', ') + ' mm' : material.glass_pieces.length ? material.glass_pieces.map((piece) => `${piece.width_mm}×${piece.height_mm} × ${piece.quantity}`).join('; ') : '—'}</td><td className="p-2"><Badge variant={mapping === 'LINKED' ? 'default' : mapping === 'GLOBAL_CATALOG' ? 'secondary' : 'destructive'}>{mapping}</Badge><p className="mt-1 text-xs">Estoque: {stock?.quantity ?? '—'}</p></td><td className="p-2">v{material.source_rule_version} · {material.source}<br/><Badge variant={material.validated ? 'default' : 'secondary'}>{material.validated ? 'VALIDATED' : 'ESTIMATED'}</Badge></td></tr>;
            })}</tbody></table></div>
            {engineering.result.warnings.length > 0 && <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{engineering.result.warnings.map((warning) => <p key={warning} className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{warning}</p>)}</div>}
          </>}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(ruleStatusTarget)} onOpenChange={(open) => { if (!open) { setRuleStatusTarget(null); setRuleStatusReason(''); } }}><DialogContent><DialogHeader><DialogTitle>{ruleStatusTarget?.is_active ? 'Desativar regra' : 'Reativar versão'}</DialogTitle><DialogDescription>A versão permanece no histórico. Informe o motivo para a trilha de auditoria.</DialogDescription></DialogHeader><div><Label>Motivo</Label><Textarea value={ruleStatusReason} onChange={(event) => setRuleStatusReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setRuleStatusTarget(null)}>Cancelar</Button><Button variant={ruleStatusTarget?.is_active ? 'destructive' : 'default'} onClick={() => setRuleActive.mutate()} disabled={!ruleStatusReason.trim() || setRuleActive.isPending}>{ruleStatusTarget?.is_active ? 'Desativar' : 'Reativar'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{sourceRule ? `Nova versão de ${sourceRule.rule_key}` : 'Nova regra global'}</DialogTitle><DialogDescription>Nenhuma versão histórica será sobrescrita. Informe obrigatoriamente o motivo.</DialogDescription></DialogHeader><div className="grid gap-3 md:grid-cols-2">
        <div><Label>Código lógico</Label><Input value={ruleDraft.rule_key} disabled={Boolean(sourceRule)} onChange={(event) => setRuleDraft({ ...ruleDraft, rule_key: event.target.value })} /></div>
        <div><Label>Material</Label><Select value={ruleDraft.item_template_id} onValueChange={(value) => { const item = itemTemplatesQuery.data?.find((candidate) => candidate.id === value); setRuleDraft({ ...ruleDraft, item_template_id: value, material_type: item?.type ?? ruleDraft.material_type, unit: item?.unit ?? ruleDraft.unit }); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(itemTemplatesQuery.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Grupo</Label><Input value={ruleDraft.group_name} onChange={(event) => setRuleDraft({ ...ruleDraft, group_name: event.target.value })} /></div><div><Label>Tipo</Label><Select value={ruleDraft.material_type} onValueChange={(value) => setRuleDraft({ ...ruleDraft, material_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['profile','glass','accessory','consumable','service'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Fórmula geral</Label><Input className="font-mono" value={ruleDraft.formula} onChange={(event) => setRuleDraft({ ...ruleDraft, formula: event.target.value })} /></div><div><Label>Quantidade</Label><Input className="font-mono" value={ruleDraft.quantity_formula} onChange={(event) => setRuleDraft({ ...ruleDraft, quantity_formula: event.target.value })} /></div>
        <div><Label>Largura / corte horizontal</Label><Input className="font-mono" value={ruleDraft.width_formula} onChange={(event) => setRuleDraft({ ...ruleDraft, width_formula: event.target.value })} /></div><div><Label>Altura / corte vertical</Label><Input className="font-mono" value={ruleDraft.height_formula} onChange={(event) => setRuleDraft({ ...ruleDraft, height_formula: event.target.value })} /></div>
        <div><Label>Peças fixas</Label><Input type="number" min={1} value={ruleDraft.pieces_quantity} onChange={(event) => setRuleDraft({ ...ruleDraft, pieces_quantity: event.target.value })} /></div><div><Label>Fórmula de peças</Label><Input className="font-mono" value={ruleDraft.pieces_formula} onChange={(event) => setRuleDraft({ ...ruleDraft, pieces_formula: event.target.value })} /></div>
        <div><Label>Condição</Label><Input className="font-mono" value={ruleDraft.condition_expression} onChange={(event) => setRuleDraft({ ...ruleDraft, condition_expression: event.target.value })} /></div><div><Label>Unidade</Label><Input value={ruleDraft.unit} onChange={(event) => setRuleDraft({ ...ruleDraft, unit: event.target.value })} /></div>
        <div><Label>Orientação</Label><Input value={ruleDraft.cut_orientation} onChange={(event) => setRuleDraft({ ...ruleDraft, cut_orientation: event.target.value })} /></div><div><Label>Ângulo</Label><Input value={ruleDraft.cut_angle} onChange={(event) => setRuleDraft({ ...ruleDraft, cut_angle: event.target.value })} /></div>
        <div className="md:col-span-2 space-y-3 rounded-md border p-3"><div><Label>Construtor visual de fórmula</Label><p className="text-xs text-muted-foreground">Gera uma expressão segura usando as variáveis canônicas L, A, Q e FOLHAS.</p></div><div className="grid gap-2 sm:grid-cols-4"><Select value={builderTarget} onValueChange={(value: EngineeringFormulaTarget) => setBuilderTarget(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="formula">Fórmula geral</SelectItem><SelectItem value="quantity_formula">Quantidade</SelectItem><SelectItem value="width_formula">Largura</SelectItem><SelectItem value="height_formula">Altura</SelectItem><SelectItem value="pieces_formula">Peças</SelectItem></SelectContent></Select><Select value={builderVariable} onValueChange={(value: EngineeringFormulaVariable) => setBuilderVariable(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['L','A','Q','FOLHAS'] as const).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Input type="number" value={builderAdjustment} onChange={(event) => setBuilderAdjustment(Number(event.target.value))} placeholder="Somar/subtrair" /><Input type="number" min="0.0001" value={builderDivisor} onChange={(event) => setBuilderDivisor(Number(event.target.value))} placeholder="Dividir por" /></div><Button type="button" variant="secondary" onClick={applyVisualFormula}>Aplicar fórmula</Button></div>
        <div className="md:col-span-2 space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3"><div><Label>Calibração assistida</Label><p className="text-xs text-muted-foreground">A sugestão nunca valida a regra automaticamente: o resultado permanece ESTIMATED até confirmação técnica com fonte.</p></div><div className="grid gap-2 sm:grid-cols-2"><Input type="number" value={calibrationReference} onChange={(event) => setCalibrationReference(Number(event.target.value))} placeholder="Dimensão de referência (mm)" /><Input type="number" value={calibrationMeasured} onChange={(event) => setCalibrationMeasured(Number(event.target.value))} placeholder="Corte medido (mm)" /></div><Button type="button" variant="outline" onClick={applyCalibrationSuggestion} disabled={builderVariable !== 'L' && builderVariable !== 'A'}>Sugerir como ESTIMATED</Button></div>
        <div><Label>Modo de suprimento</Label><Select value={ruleDraft.supply_mode || 'none'} onValueChange={(value) => setRuleDraft({ ...ruleDraft, supply_mode: value === 'none' ? '' : value as RuleDraft['supply_mode'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Não aplicável</SelectItem><SelectItem value="INTERNAL_STOCK">Estoque interno</SelectItem><SelectItem value="DEDICATED_PURCHASE">Compra dedicada</SelectItem></SelectContent></Select></div><div><Label>Status técnico</Label><Input value={ruleDraft.is_validated ? 'VALIDATED' : ruleDraft.technical_status} disabled /></div>
        <div className="flex items-center justify-between rounded-md border p-3"><Label>Nova versão ativa</Label><Switch checked={ruleDraft.is_active} onCheckedChange={(value) => setRuleDraft({ ...ruleDraft, is_active: value })} /></div><div className="flex items-center justify-between rounded-md border p-3"><Label>VALIDATED</Label><Switch checked={ruleDraft.is_validated} onCheckedChange={(value) => { setRuleDraft({ ...ruleDraft, is_validated: value, technical_status: value ? 'VALIDATED' : 'ESTIMATED' }); setValidatedConfirmation(false); }} /></div>
        <div><Label>Tipo da fonte</Label><Input value={ruleDraft.source_type} onChange={(event) => setRuleDraft({ ...ruleDraft, source_type: event.target.value })} placeholder="manual, desenho, fabricante" /></div><div><Label>Nome da fonte</Label><Input value={ruleDraft.source_name} onChange={(event) => setRuleDraft({ ...ruleDraft, source_name: event.target.value })} /></div>
        <div><Label>Página</Label><Input value={ruleDraft.source_page} onChange={(event) => setRuleDraft({ ...ruleDraft, source_page: event.target.value })} /></div><div><Label>Referência técnica</Label><Input value={ruleDraft.source_reference} onChange={(event) => setRuleDraft({ ...ruleDraft, source_reference: event.target.value })} /></div>
        <div className="md:col-span-2"><Label>Origem da validação</Label><Input value={ruleDraft.validation_source} onChange={(event) => setRuleDraft({ ...ruleDraft, validation_source: event.target.value })} placeholder="Documento técnico, plano de corte ou responsável" /></div>
        {ruleDraft.is_validated && <div className="md:col-span-2 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"><Checkbox id="validated-confirmation" checked={validatedConfirmation} onCheckedChange={(value) => setValidatedConfirmation(value === true)} /><Label htmlFor="validated-confirmation" className="leading-5">Confirmo explicitamente que esta fórmula possui evidência técnica real e pode ser marcada como VALIDATED.</Label></div>}
        <div className="md:col-span-2"><Label>Motivo da alteração</Label><Textarea value={ruleDraft.change_reason} onChange={(event) => setRuleDraft({ ...ruleDraft, change_reason: event.target.value })} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancelar</Button><Button onClick={() => saveRule.mutate()} disabled={saveRule.isPending || !ruleDraft.item_template_id || !ruleDraft.change_reason.trim() || (ruleDraft.is_validated && !validatedConfirmation)}><Save className="mr-2 h-4 w-4" />Criar versão</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}><DialogContent><DialogHeader><DialogTitle>Variação permitida</DialogTitle><DialogDescription>Define os inputs disponíveis para esta tipologia.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Chave</Label><Input value={variantKey} onChange={(event) => setVariantKey(event.target.value)} /></div><div><Label>Rótulo</Label><Input value={variantLabel} onChange={(event) => setVariantLabel(event.target.value)} /></div><div><Label>Tipo</Label><Select value={variantType} onValueChange={setVariantType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['select','number','boolean','text'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div><Label>Valores permitidos, separados por vírgula</Label><Input value={variantValues} onChange={(event) => setVariantValues(event.target.value)} /></div><div><Label>Valor padrão</Label><Input value={variantDefault} onChange={(event) => setVariantDefault(event.target.value)} /></div><div className="flex items-center justify-between rounded-md border p-3"><Label>Ativa</Label><Switch checked={variantActive} onCheckedChange={setVariantActive} /></div><div><Label>Motivo da alteração</Label><Textarea value={variantReason} onChange={(event) => setVariantReason(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setVariantDialogOpen(false)}>Cancelar</Button><Button onClick={() => saveVariant.mutate()} disabled={!variantKey.trim() || !variantLabel.trim() || !variantReason.trim() || saveVariant.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />Salvar</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
