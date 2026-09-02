import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, Layers3, Loader2, Power, Save, Search, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { operationalErrorMessage } from '@/utils/operationalError';
import { CompositionLaborCard, FinalProductsPricing } from '@/components/precos/FinalProductsPricing';

type Family = { id: string; code: string; name: string; description: string | null; pricing_basis: string; pricing_unit: string; sort_order: number; global_combinations: number; active_combinations: number; priced_combinations: number };
type Option = { id: string; code: string; label: string; value: unknown; sort_order: number };
type Attribute = { id: string; code: string; label: string; data_type: string; required: boolean; sort_order: number; options: Option[] };
type CombinationStatus = 'INACTIVE' | 'ACTIVE_UNPRICED' | 'ACTIVE_READY';
type Combination = { definition_id: string; attribute_signature: string; sort_order: number; option_ids: string[]; option_labels: string[]; attributes: Record<string, unknown>; company_variant_id: string | null; company_active: boolean; cost: number | null; markup_percent: number | null; sale_price: number | null; status: CombinationStatus };
type FamilyCatalog = { family: Family; attributes: Attribute[]; combinations: Combination[] };
type PricingCategory = { category_id: string; category_code: string; category_name: string; item_count: number; markup_percent: number | null; apply_automatically: boolean; is_active: boolean; margin_percent: number | null };
type PricingItem = { company_item_id: string; variant_id: string | null; item_code: string | null; item_name: string; variant_name: string | null; catalog_origin: string; cost_policy: string; pricing_mode: string; effective_cost: number | null; markup_percent: number | null; sale_price: number | null; pricing_source: string; pricing_unit: string | null; bar_length_mm: number | null; weight_per_meter: number | null };

function asFamily(row: Record<string, unknown>): Family {
  return { id: String(row.id), code: String(row.code), name: String(row.name), description: row.description == null ? null : String(row.description), pricing_basis: String(row.pricing_basis), pricing_unit: String(row.pricing_unit), sort_order: Number(row.sort_order), global_combinations: Number(row.global_combinations), active_combinations: Number(row.active_combinations), priced_combinations: Number(row.priced_combinations) };
}
function asCombination(row: Record<string, unknown>): Combination {
  return { definition_id: String(row.definition_id), attribute_signature: String(row.attribute_signature), sort_order: Number(row.sort_order), option_ids: (row.option_ids ?? []) as string[], option_labels: (row.option_labels ?? []) as string[], attributes: (row.attributes ?? {}) as Record<string, unknown>, company_variant_id: row.company_variant_id == null ? null : String(row.company_variant_id), company_active: Boolean(row.company_active), cost: row.cost == null ? null : Number(row.cost), markup_percent: row.markup_percent == null ? null : Number(row.markup_percent), sale_price: row.sale_price == null ? null : Number(row.sale_price), status: String(row.status) as CombinationStatus };
}
function optionOf(combination: Combination, attribute: Attribute | null) { return attribute?.options.find((option) => combination.option_ids.includes(option.id)); }

export default function MeusPrecos() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [familySearch, setFamilySearch] = useState('');
  const familiesQuery = useQuery({ queryKey: ['material-families-activation', companyId], enabled: !!companyId, queryFn: async () => { const { data, error } = await supabase.rpc('list_company_material_families_activation', { _company_id: companyId! }); if (error) throw error; return ((data ?? []) as unknown as Record<string, unknown>[]).map(asFamily); } });
  const catalogQuery = useQuery({ queryKey: ['material-family-combinations', companyId, selectedFamilyId], enabled: !!companyId && !!selectedFamilyId, queryFn: async () => {
    const [catalogResult, combinationsResult] = await Promise.all([supabase.rpc('get_company_material_family_catalog', { _company_id: companyId!, _family_id: selectedFamilyId! }), supabase.rpc('list_company_material_family_combinations', { _company_id: companyId!, _family_id: selectedFamilyId! })]);
    const error = catalogResult.error ?? combinationsResult.error; if (error) throw error;
    const catalog = catalogResult.data as unknown as { family: Family; attributes: Attribute[] };
    return { ...catalog, combinations: ((combinationsResult.data ?? []) as unknown as Record<string, unknown>[]).map(asCombination) } as FamilyCatalog;
  } });
  const mayEdit = (permissions.canEdit('estoque') || permissions.canEdit('produtos')) && permissions.canSeeCosts() && permissions.canSeePrices();
  const visibleFamilies = useMemo(() => { const term = familySearch.trim().toLocaleLowerCase('pt-BR'); return (familiesQuery.data ?? []).filter((family) => !term || `${family.name} ${family.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(term)); }, [familiesQuery.data, familySearch]);
  const invalidate = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['material-families-activation', companyId] }), queryClient.invalidateQueries({ queryKey: ['material-family-combinations', companyId, selectedFamilyId] })]); };
  if (!companyId) return <MainLayout><div className="p-6">Selecione uma empresa.</div></MainLayout>;
  return <MainLayout><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><div><h1 className="text-2xl font-bold">Meus Preços</h1><p className="text-sm text-muted-foreground">Configure como sua empresa forma seus preços de venda.</p></div>
    <Tabs defaultValue="materials" className="space-y-6">
      <TabsList className="grid h-auto w-full max-w-xl grid-cols-2">
        <TabsTrigger className="whitespace-normal py-2" value="materials">Materiais e Componentes</TabsTrigger>
        <TabsTrigger className="whitespace-normal py-2" value="products">Produtos Finais</TabsTrigger>
      </TabsList>
      <TabsContent value="materials" className="space-y-8">
        <PricingPolicyCenter companyId={companyId} mayEdit={mayEdit} />
        <CompositionLaborCard companyId={companyId} mayEdit={mayEdit} />
        <section className="space-y-4"><div><h2 className="text-xl font-semibold">Materiais por área</h2><p className="text-sm text-muted-foreground">Vidros, espelhos, ACM e outras famílias mantêm custo e preço comercial próprios da empresa.</p></div>{familiesQuery.isLoading ? <Loading /> : familiesQuery.error ? <ErrorCard error={familiesQuery.error} /> : !selectedFamilyId ? <><SearchBox value={familySearch} onChange={setFamilySearch} placeholder="Buscar material ou componente" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleFamilies.map((family) => <Card key={family.id} className="flex flex-col"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{family.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{family.description}</p></div><Layers3 className="h-5 w-5 text-primary" /></div></CardHeader><CardContent className="flex flex-1 flex-col gap-4"><Badge className="w-fit" variant="secondary">Preço por {family.pricing_unit}</Badge><div className="grid grid-cols-3 gap-2"><Metric label="Disponíveis" value={family.global_combinations} /><Metric label="Ativas" value={family.active_combinations} /><Metric label="Precificadas" value={family.priced_combinations} /></div><Button className="mt-auto w-full" onClick={() => setSelectedFamilyId(family.id)}>Configurar</Button></CardContent></Card>)}{visibleFamilies.length === 0 ? <Empty text="Nenhuma família encontrada." /> : null}</div></> : catalogQuery.isLoading ? <Loading /> : catalogQuery.error ? <ErrorCard error={catalogQuery.error} /> : catalogQuery.data ? <FamilyDetail companyId={companyId} catalog={catalogQuery.data} mayEdit={mayEdit} canSeeCosts={permissions.canSeeCosts()} canSeePrices={permissions.canSeePrices()} onBack={() => setSelectedFamilyId(null)} onChanged={invalidate} /> : null}</section>
      </TabsContent>
      <TabsContent value="products">
        <FinalProductsPricing companyId={companyId} mayEdit={mayEdit} />
      </TabsContent>
    </Tabs>
  </div></MainLayout>;
}

function PricingPolicyCenter({ companyId, mayEdit }: { companyId: string; mayEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PricingCategory | 'DEFAULT' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PricingCategory | null>(null);
  const categoriesQuery = useQuery({
    queryKey: ['company-pricing-categories', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_company_pricing_categories', { _company_id: companyId });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, markup_percent: row.markup_percent == null ? null : Number(row.markup_percent), margin_percent: row.margin_percent == null ? null : Number(row.margin_percent) })) as PricingCategory[];
    },
  });
  const defaultQuery = useQuery({
    queryKey: ['company-pricing-default', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_pricing_policies').select('*').eq('company_id', companyId).is('category_id', null).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const itemsQuery = useQuery({
    queryKey: ['company-pricing-items', companyId, selectedCategory?.category_id],
    enabled: !!selectedCategory,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_company_pricing_items', { _company_id: companyId, _category_id: selectedCategory!.category_id });
      if (error) throw error;
      return (data ?? []) as PricingItem[];
    },
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['company-pricing-categories', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['company-pricing-default', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['company-pricing-items', companyId] }),
    ]);
  };
  const defaultMarkup = defaultQuery.data?.markup_percent == null ? null : Number(defaultQuery.data.markup_percent);
  return <section className="space-y-4">
    <div className="flex items-start gap-3"><Calculator className="mt-1 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">Política de preços</h2><p className="text-sm text-muted-foreground">Markup sobre custo por categoria. Preços manuais e documentos históricos não são recalculados.</p></div></div>
    {categoriesQuery.isLoading || defaultQuery.isLoading ? <Loading /> : categoriesQuery.error || defaultQuery.error ? <ErrorCard error={categoriesQuery.error ?? defaultQuery.error} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <PolicyCard name="Padrão da empresa" count={(categoriesQuery.data ?? []).reduce((total, row) => total + Number(row.item_count), 0)} markup={defaultMarkup} active={Boolean(defaultQuery.data?.is_active)} onOpen={() => setEditing('DEFAULT')} onItems={undefined} mayEdit={mayEdit} />
      {(categoriesQuery.data ?? []).map((category) => <PolicyCard key={category.category_id} name={category.category_name} count={category.item_count} markup={category.markup_percent} active={category.is_active} onOpen={() => setEditing(category)} onItems={() => setSelectedCategory(category)} mayEdit={mayEdit} />)}
    </div>}
    {selectedCategory ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Itens · {selectedCategory.category_name}</CardTitle><p className="text-sm text-muted-foreground">A origem da regra e o modo pertencem exclusivamente à empresa atual.</p></div><Button variant="outline" onClick={() => setSelectedCategory(null)}>Fechar itens</Button></div></CardHeader><CardContent>{itemsQuery.isLoading ? <Loading /> : itemsQuery.error ? <ErrorCard error={itemsQuery.error} /> : <div className="space-y-3">{(itemsQuery.data ?? []).map((item) => <PricingItemRow key={`${item.company_item_id}-${item.variant_id ?? 'base'}`} companyId={companyId} item={item} mayEdit={mayEdit} onChanged={refresh} />)}{itemsQuery.data?.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item operacional nesta categoria.</p> : null}</div>}</CardContent></Card> : null}
    <PolicyDialog companyId={companyId} target={editing} defaultMarkup={defaultMarkup} onClose={() => setEditing(null)} onSaved={refresh} />
  </section>;
}

function PolicyCard({ name, count, markup, active, onOpen, onItems, mayEdit }: { name: string; count: number; markup: number | null; active: boolean; onOpen: () => void; onItems?: () => void; mayEdit: boolean }) {
  const margin = markup == null ? null : (markup / (100 + markup)) * 100;
  return <Card><CardHeader><CardTitle className="text-base">{name}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3"><Metric label="Itens" value={count} /><div><p className="text-xs text-muted-foreground">Status</p><Badge variant={active ? 'default' : 'outline'}>{active && markup != null ? 'Configurada' : 'Sem política'}</Badge></div></div><div><p className="text-sm text-muted-foreground">Markup sobre custo</p><p className="text-2xl font-semibold">{markup == null ? '—' : `${formatPercent(markup)}`}</p><p className="text-xs text-muted-foreground">Margem resultante: {margin == null ? '—' : formatPercent(margin)}</p></div><div className="flex flex-wrap gap-2">{mayEdit ? <Button size="sm" onClick={onOpen}><Settings2 className="mr-2 h-4 w-4" />Editar política</Button> : null}{onItems ? <Button size="sm" variant="outline" onClick={onItems}>Ver itens</Button> : null}</div></CardContent></Card>;
}

function PolicyDialog({ companyId, target, defaultMarkup, onClose, onSaved }: { companyId: string; target: PricingCategory | 'DEFAULT' | null; defaultMarkup: number | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const currentMarkup = target === 'DEFAULT' ? defaultMarkup : target?.markup_percent;
  const [markup, setMarkup] = useState('');
  const [automatic, setAutomatic] = useState(true);
  useEffect(() => { if (target) { setMarkup(currentMarkup == null ? '' : String(currentMarkup)); setAutomatic(target === 'DEFAULT' ? true : target.apply_automatically); } }, [target, currentMarkup]);
  const numericMarkup = Number(markup.replace(',', '.'));
  const save = useMutation({ mutationFn: async () => {
    const { error } = await supabase.rpc('save_company_pricing_policy', { _company_id: companyId, _category_id: (target === 'DEFAULT' ? null : target?.category_id) as unknown as string, _markup_percent: numericMarkup, _apply_automatically: automatic, _is_active: true });
    if (error) throw error;
  }, onSuccess: async () => { await onSaved(); toast.success('Política comercial atualizada.'); onClose(); }, onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível salvar a política.')) });
  const margin = Number.isFinite(numericMarkup) && numericMarkup >= 0 ? numericMarkup / (100 + numericMarkup) * 100 : null;
  return <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{target === 'DEFAULT' ? 'Padrão da empresa' : target?.category_name}</DialogTitle><DialogDescription>Essa alteração atualiza somente preços automáticos atuais. Preços manuais e documentos históricos permanecem intactos.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Markup padrão sobre custo"><Input inputMode="decimal" value={markup} onChange={(event) => setMarkup(event.target.value)} placeholder="60,00" /></Field><div className="rounded-md border p-3 text-sm"><p>Custo de exemplo: {formatMoney(100)}</p><p className="font-semibold">Venda calculada: {margin == null ? '—' : formatMoney(100 * (1 + numericMarkup / 100))}</p><p className="text-muted-foreground">Margem resultante: {margin == null ? '—' : formatPercent(margin)}</p></div><div className="flex items-center justify-between gap-3"><Label htmlFor="apply-policy">Aplicar aos itens automáticos</Label><Switch id="apply-policy" checked={automatic} onCheckedChange={setAutomatic} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!Number.isFinite(numericMarkup) || numericMarkup < 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Atualizar política</Button></DialogFooter></DialogContent></Dialog>;
}

function PricingItemRow({ companyId, item, mayEdit, onChanged }: { companyId: string; item: PricingItem; mayEdit: boolean; onChanged: () => Promise<void> }) {
  const [override, setOverride] = useState('');
  const [manualPrice, setManualPrice] = useState(item.sale_price == null ? '' : String(item.sale_price));
  const mutate = useMutation({ mutationFn: async (mode: 'POLICY' | 'OVERRIDE' | 'MANUAL') => {
    const overrideValue = Number(override.replace(',', '.')); const manualValue = Number(manualPrice.replace(',', '.'));
    const { error } = await supabase.rpc('set_company_item_pricing_mode', { _company_id: companyId, _company_item_id: item.company_item_id, ...(item.variant_id ? { _variant_id: item.variant_id } : {}), _mode: mode === 'MANUAL' ? 'MANUAL' : 'AUTO', ...(mode === 'OVERRIDE' ? { _markup_override: overrideValue } : {}), ...(mode === 'MANUAL' ? { _manual_sale_price: manualValue } : {}) });
    if (error) throw error;
  }, onSuccess: async () => { await onChanged(); toast.success('Regra do item atualizada.'); }, onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível alterar a regra.')) });
  return <div className="grid gap-3 rounded-md border p-3 lg:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(110px,0.65fr))_minmax(220px,1.2fr)] lg:items-center"><div><p className="font-medium">{item.item_code ? `${item.item_code} · ` : ''}{item.item_name}</p><p className="text-xs text-muted-foreground">{item.variant_name ?? 'Item base'} · {item.catalog_origin === 'PRIVATE' ? 'Privado' : 'Global materializado'}</p></div><PriceMetric label="Custo" value={item.effective_cost} unit={item.pricing_unit} /><PriceMetric label="Markup" value={item.markup_percent} percent /><PriceMetric label="Venda" value={item.sale_price} unit={item.pricing_unit} /><div className="space-y-2"><div className="flex flex-wrap gap-2"><Badge variant={item.pricing_mode === 'MANUAL' ? 'secondary' : 'outline'}>{pricingSourceLabel(item.pricing_source)}</Badge><Badge variant="outline">Custo: {item.cost_policy}</Badge></div>{mayEdit ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => mutate.mutate('POLICY')}>Usar política</Button><Input className="h-9 w-24" inputMode="decimal" value={override} onChange={(event) => setOverride(event.target.value)} placeholder="Markup %" /><Button size="sm" variant="outline" disabled={!Number.isFinite(Number(override.replace(',', '.')))} onClick={() => mutate.mutate('OVERRIDE')}>Aplicar</Button><Input className="h-9 w-28" inputMode="decimal" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} placeholder="Preço manual" /><Button size="sm" variant="outline" onClick={() => mutate.mutate('MANUAL')}>Manual</Button></div> : null}</div></div>;
}

function PriceMetric({ label, value, unit, percent }: { label: string; value: number | null; unit?: string | null; percent?: boolean }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value == null ? '—' : percent ? formatPercent(Number(value)) : `${formatMoney(Number(value))}${unit ? `/${unit.toLocaleLowerCase('pt-BR')}` : ''}`}</p></div>; }
function pricingSourceLabel(source: string) { return ({ CATEGORY_POLICY: 'Política da categoria', COMPANY_DEFAULT: 'Padrão da empresa', ITEM_OVERRIDE: 'Personalizado', MANUAL: 'Manual', UNPRICED: 'Sem política' } as Record<string, string>)[source] ?? source; }
function formatMoney(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatPercent(value: number) { return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`; }

function FamilyDetail({ companyId, catalog, mayEdit, canSeeCosts, canSeePrices, onBack, onChanged }: { companyId: string; catalog: FamilyCatalog; mayEdit: boolean; canSeeCosts: boolean; canSeePrices: boolean; onBack: () => void; onChanged: () => Promise<void> }) {
  const attributes = useMemo(() => [...catalog.attributes].sort((a, b) => a.sort_order - b.sort_order), [catalog.attributes]);
  const navigationAttribute = attributes.find((attribute) => attribute.code === 'TYPE') ?? null;
  const [navigationOptionId, setNavigationOptionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const navigationOptions = useMemo(() => navigationAttribute?.options.filter((option) => catalog.combinations.some((combination) => combination.option_ids.includes(option.id))) ?? [], [catalog.combinations, navigationAttribute]);
  const selectedNavigation = navigationOptions.find((option) => option.id === navigationOptionId) ?? null;
  const scoped = useMemo(() => catalog.combinations.filter((combination) => !navigationOptionId || combination.option_ids.includes(navigationOptionId)), [catalog.combinations, navigationOptionId]);
  const matrixAttributes = attributes.filter((attribute) => attribute.id !== navigationAttribute?.id);
  const groupAttribute = matrixAttributes[0] ?? null;
  const rowAttribute = matrixAttributes[1] ?? null;
  const auxiliaryAttributes = matrixAttributes.slice(2);
  const stableAuxiliary = auxiliaryAttributes.map((attribute) => {
    const used = attribute.options.filter((option) => scoped.some((combination) => combination.option_ids.includes(option.id)));
    return used.length === 1 ? { attribute, option: used[0] } : null;
  }).filter((entry): entry is { attribute: Attribute; option: Option } => Boolean(entry));
  const variableAuxiliary = auxiliaryAttributes.filter((attribute) => !stableAuxiliary.some((entry) => entry.attribute.id === attribute.id));
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = scoped.filter((combination) => !term || combination.option_labels.join(' ').toLocaleLowerCase('pt-BR').includes(term));
  if (navigationAttribute && !navigationOptionId) {
    const visibleOptions = navigationOptions.filter((option) => !term || option.label.toLocaleLowerCase('pt-BR').includes(term));
    return <div className="space-y-5"><Breadcrumb parts={['Meus Preços', catalog.family.name]} /><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Famílias</Button><div><h2 className="text-2xl font-bold">{catalog.family.name}</h2><p className="text-sm text-muted-foreground">Escolha {navigationAttribute.label.toLocaleLowerCase('pt-BR')} para editar a matriz comercial.</p></div><SearchBox value={search} onChange={setSearch} placeholder="Buscar tipo" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleOptions.map((option) => { const combinations = catalog.combinations.filter((combination) => combination.option_ids.includes(option.id)); return <Card key={option.id} className="flex flex-col"><CardHeader><CardTitle>{option.label}</CardTitle></CardHeader><CardContent className="flex flex-1 flex-col gap-4"><div className="grid grid-cols-3 gap-2"><Metric label="Disponíveis" value={combinations.length} /><Metric label="Ativas" value={combinations.filter((row) => row.company_active).length} /><Metric label="Com preço" value={combinations.filter((row) => row.status === 'ACTIVE_READY').length} /></div><Button className="mt-auto" onClick={() => setNavigationOptionId(option.id)}>Abrir {option.label}</Button></CardContent></Card>; })}{visibleOptions.length === 0 ? <Empty text="Nenhum tipo encontrado." /> : null}</div></div>;
  }
  const groups = groupAttribute ? groupAttribute.options.filter((option) => visible.some((combination) => combination.option_ids.includes(option.id))) : [];
  return <div className="space-y-5"><Breadcrumb parts={['Meus Preços', catalog.family.name, selectedNavigation?.label].filter((part): part is string => Boolean(part))} /><Button variant="outline" onClick={() => navigationAttribute ? setNavigationOptionId(null) : onBack()}><ArrowLeft className="mr-2 h-4 w-4" />{navigationAttribute ? catalog.family.name : 'Famílias'}</Button><div><h2 className="text-2xl font-bold">{selectedNavigation?.label ?? catalog.family.name}</h2><p className="text-sm text-muted-foreground">Custo e venda por {catalog.family.pricing_unit}. Valores exclusivos da empresa atual.</p>{stableAuxiliary.length > 0 ? <p className="text-sm text-muted-foreground">{stableAuxiliary.map((entry) => `${entry.attribute.label}: ${entry.option.label}`).join(' · ')}</p> : null}</div><SearchBox value={search} onChange={setSearch} placeholder="Buscar tipo, cor ou espessura" />
    {visible.length === 0 ? <Empty text={catalog.combinations.length === 0 ? 'As opções estruturais estão configuradas, mas as combinações comerciais ainda não foram definidas pelo administrador do Vetra.' : 'Nenhuma combinação corresponde à busca.'} /> : groups.length > 0 ? groups.map((group) => <section key={group.id} className="space-y-3"><h3 className="text-lg font-semibold">{group.label}</h3><div className="space-y-3">{visible.filter((combination) => combination.option_ids.includes(group.id)).sort((a, b) => Number(optionOf(a, rowAttribute)?.value ?? a.sort_order) - Number(optionOf(b, rowAttribute)?.value ?? b.sort_order)).map((combination) => <PriceRow key={combination.definition_id} companyId={companyId} catalog={catalog} combination={combination} rowAttribute={rowAttribute} auxiliaryAttributes={variableAuxiliary} mayEdit={mayEdit} canSeeCosts={canSeeCosts} canSeePrices={canSeePrices} onChanged={onChanged} />)}</div></section>) : <div className="space-y-3">{visible.map((combination) => <PriceRow key={combination.definition_id} companyId={companyId} catalog={catalog} combination={combination} rowAttribute={rowAttribute} auxiliaryAttributes={variableAuxiliary} mayEdit={mayEdit} canSeeCosts={canSeeCosts} canSeePrices={canSeePrices} onChanged={onChanged} />)}</div>}
  </div>;
}

function PriceRow({ companyId, catalog, combination, rowAttribute, auxiliaryAttributes, mayEdit, canSeeCosts, canSeePrices, onChanged }: { companyId: string; catalog: FamilyCatalog; combination: Combination; rowAttribute: Attribute | null; auxiliaryAttributes: Attribute[]; mayEdit: boolean; canSeeCosts: boolean; canSeePrices: boolean; onChanged: () => Promise<void> }) {
  const [cost, setCost] = useState(combination.cost == null ? '' : String(combination.cost));
  const [sale, setSale] = useState(combination.sale_price == null ? '' : String(combination.sale_price));
  const costNumber = Number(cost.replace(',', '.')); const saleNumber = Number(sale.replace(',', '.'));
  const invalid = !Number.isFinite(costNumber) || costNumber <= 0 || !Number.isFinite(saleNumber) || saleNumber < costNumber;
  const activation = useMutation({ mutationFn: async (active: boolean) => { const { error } = await supabase.rpc('set_company_material_combination_active', { _company_id: companyId, _definition_id: combination.definition_id, _active: active }); if (error) throw error; }, onSuccess: async (_, active) => { await onChanged(); toast.success(active ? 'Combinação ativada.' : 'Combinação desativada.'); }, onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível alterar a combinação.')) });
  const save = useMutation({ mutationFn: async () => { const { error } = await supabase.rpc('save_company_material_variant_price', { _company_id: companyId, _definition_id: combination.definition_id, _cost: costNumber, _basis: 'SALE_PRICE', _value: saleNumber }); if (error) throw error; }, onSuccess: async () => { await onChanged(); toast.success('Preço empresarial salvo.'); }, onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível salvar o preço.')) });
  const rowOption = optionOf(combination, rowAttribute);
  const auxiliary = auxiliaryAttributes.map((attribute) => optionOf(combination, attribute)).filter((option): option is Option => Boolean(option));
  const margin = costNumber > 0 && saleNumber >= costNumber ? ((saleNumber - costNumber) / saleNumber) * 100 : null;
  return <Card><CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] lg:items-end"><div><p className="font-semibold">{rowOption?.label ?? combination.option_labels.join(' · ')}</p>{auxiliary.length > 0 ? <p className="text-sm text-muted-foreground">{auxiliary.map((option) => option.label).join(' · ')}</p> : null}<StatusBadge status={combination.status} /></div>{combination.company_active ? <>{canSeeCosts ? <Field label={`Custo/${catalog.family.pricing_unit}`}><Input type="number" inputMode="decimal" min="0" step="0.01" value={cost} disabled={!mayEdit} onChange={(event) => setCost(event.target.value)} /></Field> : <div />}{canSeePrices ? <Field label={`Venda/${catalog.family.pricing_unit}`}><Input type="number" inputMode="decimal" min="0" step="0.01" value={sale} disabled={!mayEdit} onChange={(event) => setSale(event.target.value)} /></Field> : <div />}<div className="flex flex-wrap gap-2 lg:justify-end">{canSeeCosts && canSeePrices && margin != null ? <Badge variant="outline">Margem {margin.toFixed(1)}%</Badge> : null}{mayEdit ? <><Button size="sm" disabled={invalid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar</Button><Button size="sm" variant="outline" disabled={activation.isPending} onClick={() => activation.mutate(false)}>Desativar</Button></> : null}</div></> : <><p className="text-sm text-muted-foreground lg:col-span-2">Disponível globalmente. Ative para informar os valores da sua empresa.</p><div className="lg:text-right">{mayEdit ? <Button disabled={activation.isPending} onClick={() => activation.mutate(true)}><Power className="mr-2 h-4 w-4" />Ativar</Button> : null}</div></>}</CardContent></Card>;
}

function Breadcrumb({ parts }: { parts: string[] }) { return <nav aria-label="Navegação estrutural" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{parts.map((part, index) => <span key={`${part}-${index}`} className="flex items-center gap-2">{index > 0 ? <span aria-hidden>›</span> : null}<span className={index === parts.length - 1 ? 'font-medium text-foreground' : ''}>{part}</span></span>)}</nav>; }
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>; }
function StatusBadge({ status }: { status: CombinationStatus }) { if (status === 'ACTIVE_READY') return <Badge className="mt-2">Ativo • Precificado</Badge>; if (status === 'ACTIVE_UNPRICED') return <Badge className="mt-2" variant="secondary">Ativo • Sem preço</Badge>; return <Badge className="mt-2" variant="outline">Inativo</Badge>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Loading() { return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function ErrorCard({ error }: { error: unknown }) { return <Card><CardContent className="p-6 text-sm text-destructive">{operationalErrorMessage(error, 'Não foi possível carregar o catálogo.')}</CardContent></Card>; }
function Empty({ text }: { text: string }) { return <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{Number.isFinite(value) ? value : 0}</p></div>; }
