import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Layers3, Loader2, Pencil, Power, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { operationalErrorMessage } from '@/utils/operationalError';

type Family = {
  id: string; code: string; name: string; description: string | null;
  pricing_basis: string; pricing_unit: string; sort_order: number;
  global_combinations: number; active_combinations: number; priced_combinations: number;
};
type Option = { id: string; code: string; label: string; value: unknown; sort_order: number };
type Attribute = { id: string; code: string; label: string; data_type: string; required: boolean; sort_order: number; options: Option[] };
type CombinationStatus = 'INACTIVE' | 'ACTIVE_UNPRICED' | 'ACTIVE_READY';
type Combination = {
  definition_id: string; attribute_signature: string; sort_order: number;
  option_ids: string[]; option_labels: string[]; attributes: Record<string, unknown>;
  company_variant_id: string | null; company_active: boolean; cost: number | null;
  markup_percent: number | null; sale_price: number | null; status: CombinationStatus;
};
type FamilyCatalog = { family: Family; attributes: Attribute[]; combinations: Combination[] };
type StatusFilter = 'ALL' | 'ACTIVE' | CombinationStatus;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function asFamily(row: Record<string, unknown>): Family {
  return {
    id: String(row.id), code: String(row.code), name: String(row.name),
    description: row.description == null ? null : String(row.description),
    pricing_basis: String(row.pricing_basis), pricing_unit: String(row.pricing_unit),
    sort_order: Number(row.sort_order), global_combinations: Number(row.global_combinations),
    active_combinations: Number(row.active_combinations), priced_combinations: Number(row.priced_combinations),
  };
}

function asCombination(row: Record<string, unknown>): Combination {
  return {
    definition_id: String(row.definition_id), attribute_signature: String(row.attribute_signature),
    sort_order: Number(row.sort_order), option_ids: (row.option_ids ?? []) as string[],
    option_labels: (row.option_labels ?? []) as string[],
    attributes: (row.attributes ?? {}) as Record<string, unknown>,
    company_variant_id: row.company_variant_id == null ? null : String(row.company_variant_id),
    company_active: Boolean(row.company_active), cost: row.cost == null ? null : Number(row.cost),
    markup_percent: row.markup_percent == null ? null : Number(row.markup_percent),
    sale_price: row.sale_price == null ? null : Number(row.sale_price),
    status: String(row.status) as CombinationStatus,
  };
}

export default function MeusPrecos() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [familySearch, setFamilySearch] = useState('');
  const [editor, setEditor] = useState<Combination | null>(null);

  const familiesQuery = useQuery({
    queryKey: ['material-families-activation', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_company_material_families_activation', { _company_id: companyId! });
      if (error) throw error;
      return ((data ?? []) as unknown as Record<string, unknown>[]).map(asFamily);
    },
  });
  const catalogQuery = useQuery({
    queryKey: ['material-family-combinations', companyId, selectedFamilyId],
    enabled: !!companyId && !!selectedFamilyId,
    queryFn: async () => {
      const [catalogResult, combinationsResult] = await Promise.all([
        supabase.rpc('get_company_material_family_catalog', { _company_id: companyId!, _family_id: selectedFamilyId! }),
        supabase.rpc('list_company_material_family_combinations', { _company_id: companyId!, _family_id: selectedFamilyId! }),
      ]);
      const error = catalogResult.error ?? combinationsResult.error;
      if (error) throw error;
      const catalog = catalogResult.data as unknown as { family: Family; attributes: Attribute[] };
      return { ...catalog, combinations: ((combinationsResult.data ?? []) as unknown as Record<string, unknown>[]).map(asCombination) } as FamilyCatalog;
    },
  });
  const mayEdit = (permissions.canEdit('estoque') || permissions.canEdit('produtos'))
    && permissions.canSeeCosts() && permissions.canSeePrices();
  const visibleFamilies = useMemo(() => {
    const families = familiesQuery.data ?? [];
    const term = familySearch.trim().toLocaleLowerCase('pt-BR');
    return term ? families.filter((family) => `${family.name} ${family.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(term)) : families;
  }, [familiesQuery.data, familySearch]);
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['material-families-activation', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['material-family-combinations', companyId, selectedFamilyId] }),
    ]);
  };

  if (!companyId) return <MainLayout><div className="p-6">Selecione uma empresa.</div></MainLayout>;
  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Meus Preços</h1><p className="text-sm text-muted-foreground">Ative combinações globais e configure somente os preços da sua empresa.</p></div>
          {selectedFamilyId ? <Button variant="outline" onClick={() => setSelectedFamilyId(null)}><ArrowLeft className="mr-2 h-4 w-4" /> Famílias</Button> : null}
        </div>
        {familiesQuery.isLoading ? <Loading /> : familiesQuery.error ? <ErrorCard error={familiesQuery.error} /> : !selectedFamilyId ? (
          <>
            <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={familySearch} onChange={(event) => setFamilySearch(event.target.value)} placeholder="Buscar matéria-prima" /></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleFamilies.map((family) => (
                <Card key={family.id} className="flex flex-col">
                  <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{family.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{family.description}</p></div><Layers3 className="h-5 w-5 text-primary" /></div></CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <div className="flex flex-wrap gap-2"><Badge variant="outline">{family.pricing_basis}</Badge><Badge variant="secondary">Preço por {family.pricing_unit}</Badge></div>
                    <div className="grid grid-cols-3 gap-2 text-sm"><Metric label="Globais" value={family.global_combinations} /><Metric label="Ativas" value={family.active_combinations} /><Metric label="Com preço" value={family.priced_combinations} /></div>
                    <Button className="mt-auto w-full" onClick={() => setSelectedFamilyId(family.id)}>Ver catálogo</Button>
                  </CardContent>
                </Card>
              ))}
              {visibleFamilies.length === 0 ? <Empty text="Nenhuma família encontrada." /> : null}
            </div>
          </>
        ) : catalogQuery.isLoading ? <Loading /> : catalogQuery.error ? <ErrorCard error={catalogQuery.error} /> : catalogQuery.data ? (
          <FamilyDetail companyId={companyId} catalog={catalogQuery.data} mayEdit={mayEdit}
            canSeeCosts={permissions.canSeeCosts()} canSeePrices={permissions.canSeePrices()}
            onEdit={setEditor} onChanged={invalidate} />
        ) : null}
      </div>
      {editor && catalogQuery.data ? <PriceDialog companyId={companyId} catalog={catalogQuery.data} combination={editor}
        onClose={() => setEditor(null)} onSaved={invalidate} /> : null}
    </MainLayout>
  );
}

function FamilyDetail({ companyId, catalog, mayEdit, canSeeCosts, canSeePrices, onEdit, onChanged }: {
  companyId: string; catalog: FamilyCatalog; mayEdit: boolean; canSeeCosts: boolean; canSeePrices: boolean;
  onEdit: (combination: Combination) => void; onChanged: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const activation = useMutation({
    mutationFn: async ({ definitionId, active }: { definitionId: string; active: boolean }) => {
      const { error } = await supabase.rpc('set_company_material_combination_active', {
        _company_id: companyId, _definition_id: definitionId, _active: active,
      });
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await onChanged();
      toast.success(variables.active ? 'Combinação ativada.' : 'Combinação desativada.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível alterar a combinação.')),
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return catalog.combinations.filter((combination) => {
      const matchesText = !term || combination.option_labels.join(' ').toLocaleLowerCase('pt-BR').includes(term);
      const matchesStatus = statusFilter === 'ALL'
        || (statusFilter === 'ACTIVE' && combination.company_active)
        || combination.status === statusFilter;
      const matchesAttributes = Object.values(attributeFilters).every((optionId) => combination.option_ids.includes(optionId));
      return matchesText && matchesStatus && matchesAttributes;
    });
  }, [attributeFilters, catalog.combinations, search, statusFilter]);

  return <div className="space-y-4">
    <Card><CardHeader><CardTitle>{catalog.family.name}</CardTitle><p className="text-sm text-muted-foreground">Combinações válidas definidas no catálogo global.</p></CardHeader></Card>
    <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tipo, cor, espessura ou acabamento" /></div>
      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos</SelectItem><SelectItem value="ACTIVE">Ativos</SelectItem><SelectItem value="INACTIVE">Inativos</SelectItem><SelectItem value="ACTIVE_UNPRICED">Sem preço</SelectItem><SelectItem value="ACTIVE_READY">Com preço</SelectItem></SelectContent></Select>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{catalog.attributes.map((attribute) => <Select key={attribute.id} value={attributeFilters[attribute.id] ?? 'ALL'} onValueChange={(optionId) => setAttributeFilters((current) => { const next = { ...current }; if (optionId === 'ALL') delete next[attribute.id]; else next[attribute.id] = optionId; return next; })}><SelectTrigger><SelectValue placeholder={attribute.label} /></SelectTrigger><SelectContent><SelectItem value="ALL">{attribute.label}: todos</SelectItem>{attribute.options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select>)}</div>
    {filtered.length === 0 ? <Empty text="Nenhuma combinação corresponde aos filtros." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((combination) => {
        const cost = combination.cost == null ? null : Number(combination.cost);
        const sale = combination.sale_price == null ? null : Number(combination.sale_price);
        return <Card key={combination.definition_id}><CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-2"><p className="font-medium">{combination.option_labels.join(' · ')}</p><StatusBadge status={combination.status} /></div>
          {combination.status !== 'INACTIVE' ? <div className="grid grid-cols-2 gap-3 text-sm">
            {canSeeCosts ? <Price label={`Custo/${catalog.family.pricing_unit}`} value={cost} /> : null}
            {canSeePrices ? <Price label={`Venda/${catalog.family.pricing_unit}`} value={sale} /> : null}
            {canSeeCosts && canSeePrices ? <Price label="Lucro" value={cost != null && sale != null ? sale - cost : null} /> : null}
            {canSeePrices ? <Percent label="Margem" value={cost != null && sale != null && sale>0 ? ((sale-cost)/sale)*100 : null} /> : null}
          </div> : <p className="text-sm text-muted-foreground">Disponível no catálogo global, ainda não ativada por esta empresa.</p>}
          {mayEdit ? <div className="flex flex-wrap gap-2">
            {combination.status === 'INACTIVE' ? <Button className="flex-1" disabled={activation.isPending} onClick={() => activation.mutate({ definitionId: combination.definition_id, active: true })}><Power className="mr-2 h-4 w-4" /> Ativar</Button> : <>
              <Button className="flex-1" onClick={() => onEdit(combination)}><Pencil className="mr-2 h-4 w-4" /> {combination.status === 'ACTIVE_READY' ? 'Editar preço' : 'Configurar preço'}</Button>
              <Button variant="outline" disabled={activation.isPending} onClick={() => activation.mutate({ definitionId: combination.definition_id, active: false })}>Desativar</Button>
            </>}
          </div> : null}
        </CardContent></Card>;
      })}
    </div>}
  </div>;
}

function PriceDialog({ companyId, catalog, combination, onClose, onSaved }: {
  companyId: string; catalog: FamilyCatalog; combination: Combination; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const initialBasis = combination.markup_percent == null ? 'SALE_PRICE' : 'MARKUP';
  const [cost, setCost] = useState(combination.cost == null ? '' : String(combination.cost));
  const [basis, setBasis] = useState<'MARKUP' | 'SALE_PRICE'>(initialBasis);
  const [value, setValue] = useState(initialBasis === 'MARKUP' ? String(combination.markup_percent ?? '') : String(combination.sale_price ?? ''));
  const costNumber = Number(cost.replace(',', '.'));
  const valueNumber = Number(value.replace(',', '.'));
  const invalid = !Number.isFinite(costNumber) || costNumber<=0 || !Number.isFinite(valueNumber) || valueNumber<0
    || (basis === 'SALE_PRICE' && valueNumber<costNumber);
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_company_material_variant_price', {
        _company_id: companyId, _definition_id: combination.definition_id,
        _cost: costNumber, _basis: basis, _value: valueNumber,
      });
      if (error) throw error;
    },
    onSuccess: async () => { await onSaved(); toast.success('Preço empresarial salvo.'); onClose(); },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível salvar o preço.')),
  });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{catalog.family.name}</DialogTitle><DialogDescription>{combination.option_labels.join(' · ')}. Os valores pertencem somente à empresa atual.</DialogDescription></DialogHeader>
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2"><Field label={`Custo/${catalog.family.pricing_unit}`}><Input type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></Field><Field label="Editar por"><Select value={basis} onValueChange={(next) => { setBasis(next as typeof basis); setValue(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MARKUP">Markup</SelectItem><SelectItem value="SALE_PRICE">Preço de venda</SelectItem></SelectContent></Select></Field></div>
      <Field label={basis === 'MARKUP' ? 'Markup (%)' : `Venda/${catalog.family.pricing_unit}`}><Input type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} /></Field>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={invalid || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Salvar</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function StatusBadge({ status }: { status: CombinationStatus }) {
  if (status === 'ACTIVE_READY') return <Badge>Com preço</Badge>;
  if (status === 'ACTIVE_UNPRICED') return <Badge variant="secondary">Sem preço</Badge>;
  return <Badge variant="outline">Inativa</Badge>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Loading() { return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function ErrorCard({ error }: { error: unknown }) { return <Card><CardContent className="p-6 text-sm text-destructive">{operationalErrorMessage(error, 'Não foi possível carregar o catálogo.')}</CardContent></Card>; }
function Empty({ text }: { text: string }) { return <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{Number.isFinite(value) ? value : 0}</p></div>; }
function Price({ label, value }: { label: string; value: number | null }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value == null ? '—' : brl.format(value)}</p></div>; }
function Percent({ label, value }: { label: string; value: number | null }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value == null ? '—' : `${value.toFixed(2)}%`}</p></div>; }
