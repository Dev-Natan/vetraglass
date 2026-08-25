import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Layers3, Loader2, Pencil, Plus } from 'lucide-react';
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
  configured_variants: number; total_combinations: number;
};
type Option = { id: string; code: string; label: string; value: unknown; sort_order: number };
type Attribute = { id: string; code: string; label: string; data_type: string; required: boolean; sort_order: number; options: Option[] };
type Variant = { id: string; company_item_id: string; signature: string; cost: number | null; markup_percent: number | null; sale_price: number | null; option_ids: string[] };
type FamilyCatalog = { family: Family; attributes: Attribute[]; variants: Variant[] };

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function asFamily(row: Record<string, unknown>): Family {
  return {
    id: String(row.id), code: String(row.code), name: String(row.name),
    description: row.description == null ? null : String(row.description),
    pricing_basis: String(row.pricing_basis), pricing_unit: String(row.pricing_unit),
    sort_order: Number(row.sort_order), configured_variants: Number(row.configured_variants),
    total_combinations: Number(row.total_combinations),
  };
}

export default function MeusPrecos() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Variant | 'new' | null>(null);

  const familiesQuery = useQuery({
    queryKey: ['dynamic-material-families', companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_company_material_families', { _company_id: companyId! });
      if (error) throw error;
      return ((data ?? []) as unknown as Record<string, unknown>[]).map(asFamily);
    },
  });
  const catalogQuery = useQuery({
    queryKey: ['dynamic-material-family-catalog', companyId, selectedFamilyId],
    enabled: !!companyId && !!selectedFamilyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_material_family_catalog', { _company_id: companyId!, _family_id: selectedFamilyId! });
      if (error) throw error;
      return data as unknown as FamilyCatalog;
    },
  });
  const mayEdit = (permissions.canEdit('estoque') || permissions.canEdit('produtos'))
    && permissions.canSeeCosts() && permissions.canSeePrices();
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dynamic-material-families', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['dynamic-material-family-catalog', companyId, selectedFamilyId] }),
    ]);
  };

  if (!companyId) return <MainLayout><div className="p-6">Selecione uma empresa.</div></MainLayout>;
  const families = familiesQuery.data ?? [];
  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Meus Preços</h1><p className="text-sm text-muted-foreground">Catálogo global, preços exclusivos da sua empresa.</p></div>
          {selectedFamilyId ? <Button variant="outline" onClick={() => setSelectedFamilyId(null)}><ArrowLeft className="mr-2 h-4 w-4" /> Famílias</Button> : null}
        </div>
        {familiesQuery.isLoading ? <Loading /> : familiesQuery.error ? <ErrorCard error={familiesQuery.error} /> : !selectedFamilyId ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {families.map((family) => (
              <Card key={family.id} className="flex flex-col">
                <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{family.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{family.description}</p></div><Layers3 className="h-5 w-5 text-primary" /></div></CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-wrap gap-2"><Badge variant="outline">{family.pricing_basis}</Badge><Badge variant="secondary">Preço por {family.pricing_unit}</Badge></div>
                  <div className="grid grid-cols-2 gap-3 text-sm"><Metric label="Configuradas" value={family.configured_variants} /><Metric label="Pendentes" value={Math.max(family.total_combinations - family.configured_variants, 0)} /></div>
                  <Button className="mt-auto w-full" onClick={() => setSelectedFamilyId(family.id)}>Configurar preços</Button>
                </CardContent>
              </Card>
            ))}
            {families.length === 0 ? <Empty text="Nenhuma família de matéria-prima está ativa." /> : null}
          </div>
        ) : catalogQuery.isLoading ? <Loading /> : catalogQuery.error ? <ErrorCard error={catalogQuery.error} /> : catalogQuery.data ? (
          <FamilyDetail catalog={catalogQuery.data} mayEdit={mayEdit} canSeeCosts={permissions.canSeeCosts()} canSeePrices={permissions.canSeePrices()}
            onAdd={() => setEditor('new')} onEdit={setEditor} />
        ) : null}
      </div>
      {editor && catalogQuery.data ? <PriceDialog companyId={companyId} catalog={catalogQuery.data} variant={editor === 'new' ? null : editor}
        onClose={() => setEditor(null)} onSaved={invalidate} /> : null}
    </MainLayout>
  );
}

function FamilyDetail({ catalog, mayEdit, canSeeCosts, canSeePrices, onAdd, onEdit }: {
  catalog: FamilyCatalog; mayEdit: boolean; canSeeCosts: boolean; canSeePrices: boolean;
  onAdd: () => void; onEdit: (variant: Variant) => void;
}) {
  const labels = useMemo(() => {
    const map = new Map<string, string>();
    catalog.attributes.forEach((attribute) => attribute.options.forEach((option) => map.set(option.id, option.label)));
    return map;
  }, [catalog.attributes]);
  return <div className="space-y-4">
    <Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>{catalog.family.name}</CardTitle><p className="text-sm text-muted-foreground">Selecione uma combinação cadastrada no catálogo global.</p></div>{mayEdit ? <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" /> Nova combinação</Button> : null}</CardHeader></Card>
    {catalog.variants.length === 0 ? <Empty text="Nenhum preço configurado para esta empresa." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {catalog.variants.map((variant) => {
        const cost = variant.cost == null ? null : Number(variant.cost);
        const sale = variant.sale_price == null ? null : Number(variant.sale_price);
        return <Card key={variant.id}><CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-2"><p className="font-medium">{variant.option_ids.map((id) => labels.get(id) ?? id).join(' · ')}</p>{mayEdit ? <Button size="icon" variant="ghost" onClick={() => onEdit(variant)} aria-label="Editar preço"><Pencil className="h-4 w-4" /></Button> : null}</div>
          <div className="grid grid-cols-2 gap-3 text-sm">{canSeeCosts ? <Price label={`Custo/${catalog.family.pricing_unit}`} value={cost} /> : null}{canSeePrices ? <Price label={`Venda/${catalog.family.pricing_unit}`} value={sale} /> : null}{canSeeCosts && canSeePrices ? <Price label="Lucro" value={cost != null && sale != null ? sale - cost : null} /> : null}{canSeePrices ? <div><p className="text-xs text-muted-foreground">Markup</p><p className="font-semibold">{variant.markup_percent == null ? '—' : `${Number(variant.markup_percent).toFixed(2)}%`}</p></div> : null}</div>
        </CardContent></Card>;
      })}
    </div>}
  </div>;
}

function PriceDialog({ companyId, catalog, variant, onClose, onSaved }: {
  companyId: string; catalog: FamilyCatalog; variant: Variant | null; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const initial = useMemo(() => Object.fromEntries(catalog.attributes.map((attribute) => [attribute.id, attribute.options.find((option) => variant?.option_ids.includes(option.id))?.id ?? ''])), [catalog.attributes, variant]);
  const [selected, setSelected] = useState<Record<string, string>>(initial);
  const [cost, setCost] = useState(variant?.cost == null ? '' : String(variant.cost));
  const initialBasis = variant?.markup_percent == null ? 'SALE_PRICE' : 'MARKUP';
  const [basis, setBasis] = useState<'MARKUP' | 'SALE_PRICE'>(initialBasis);
  const [value, setValue] = useState(
    initialBasis === 'MARKUP'
      ? String(variant?.markup_percent ?? '')
      : String(variant?.sale_price ?? ''),
  );
  const optionIds = Object.values(selected).filter(Boolean);
  const costNumber = Number(cost.replace(',', '.'));
  const valueNumber = Number(value.replace(',', '.'));
  const invalid = catalog.attributes.some((attribute) => attribute.required && !selected[attribute.id])
    || !Number.isFinite(costNumber) || costNumber <= 0 || !Number.isFinite(valueNumber) || valueNumber < 0
    || (basis === 'SALE_PRICE' && valueNumber < costNumber);
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_company_material_variant', { _company_id: companyId, _family_id: catalog.family.id, _option_ids: optionIds, _cost: costNumber, _basis: basis, _value: valueNumber });
      if (error) throw error;
    },
    onSuccess: async () => { await onSaved(); toast.success('Preço empresarial salvo.'); onClose(); },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível salvar o preço.')),
  });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{variant ? 'Editar preço' : 'Nova combinação'} · {catalog.family.name}</DialogTitle><DialogDescription>Os valores pertencem somente à empresa atual.</DialogDescription></DialogHeader>
    <div className="grid gap-4">{catalog.attributes.map((attribute) => <div key={attribute.id} className="space-y-2"><Label>{attribute.label}{attribute.required ? ' *' : ''}</Label><Select value={selected[attribute.id]} disabled={!!variant} onValueChange={(next) => setSelected((current) => ({ ...current, [attribute.id]: next }))}><SelectTrigger><SelectValue placeholder={`Selecione ${attribute.label.toLowerCase()}`} /></SelectTrigger><SelectContent>{attribute.options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>)}
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Custo/{catalog.family.pricing_unit}</Label><Input type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></div><div className="space-y-2"><Label>Editar por</Label><Select value={basis} onValueChange={(next) => { setBasis(next as typeof basis); setValue(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MARKUP">Markup</SelectItem><SelectItem value="SALE_PRICE">Preço de venda</SelectItem></SelectContent></Select></div></div>
      <div className="space-y-2"><Label>{basis === 'MARKUP' ? 'Markup (%)' : `Venda/${catalog.family.pricing_unit}`}</Label><Input type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} /></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={invalid || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Salvar</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Loading() { return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function ErrorCard({ error }: { error: unknown }) { return <Card><CardContent className="p-6 text-sm text-destructive">{operationalErrorMessage(error, 'Não foi possível carregar o catálogo.')}</CardContent></Card>; }
function Empty({ text }: { text: string }) { return <Card className="sm:col-span-2 xl:col-span-3"><CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{Number.isFinite(value) ? value : 0}</p></div>; }
function Price({ label, value }: { label: string; value: number | null }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value == null ? '—' : brl.format(value)}</p></div>; }
