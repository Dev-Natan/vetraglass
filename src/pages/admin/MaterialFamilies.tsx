import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { operationalErrorMessage } from '@/utils/operationalError';

type Family = { id: string; commercial_material_family: string | null; name: string; description: string | null; pricing_basis: string | null; pricing_unit: string | null; sort_order: number; is_active: boolean };
type Attribute = { id: string; item_template_id: string; attribute_code: string; label: string; data_type: string; is_required: boolean; sort_order: number; is_active: boolean };
type Option = { id: string; attribute_id: string; option_code: string; label: string; canonical_value: unknown; sort_order: number; is_active: boolean };
type Definition = { id: string; item_template_id: string; attribute_signature: string; sort_order: number; is_active: boolean };
type DefinitionOption = { definition_id: string; item_template_id: string; attribute_id: string; option_id: string };
type FamilyEditor = Partial<Family> & { code: string; unit: string; basis: string; active: boolean };
type AttributeEditor = Partial<Attribute> & { code: string; type: string; required: boolean; active: boolean };
type OptionEditor = Partial<Option> & { code: string; value: string; active: boolean };

export default function MaterialFamilies() {
  const queryClient = useQueryClient();
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [familyEditor, setFamilyEditor] = useState<FamilyEditor | null>(null);
  const [attributeEditor, setAttributeEditor] = useState<AttributeEditor | null>(null);
  const [optionEditor, setOptionEditor] = useState<{ attribute: Attribute; value: OptionEditor } | null>(null);
  const [combinationEditor, setCombinationEditor] = useState(false);
  const query = useQuery({
    queryKey: ['admin-material-family-catalog'],
    queryFn: async () => {
      const [families, attributes, options, definitions, definitionOptions] = await Promise.all([
        supabase.from('item_templates').select('id,commercial_material_family,name,description,pricing_basis,pricing_unit,sort_order,is_active').eq('is_commercial_area_material', true).is('company_id', null).order('sort_order').order('name'),
        supabase.from('item_template_attributes').select('*').order('sort_order').order('label'),
        supabase.from('item_template_attribute_options').select('*').order('sort_order').order('label'),
        supabase.from('item_template_variant_definitions').select('*').order('sort_order').order('created_at'),
        supabase.from('item_template_variant_definition_options').select('*'),
      ]);
      const error = families.error ?? attributes.error ?? options.error ?? definitions.error ?? definitionOptions.error;
      if (error) throw error;
      return {
        families: (families.data ?? []) as Family[], attributes: (attributes.data ?? []) as Attribute[], options: (options.data ?? []) as Option[],
        definitions: (definitions.data ?? []) as Definition[], definitionOptions: (definitionOptions.data ?? []) as DefinitionOption[],
      };
    },
  });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['admin-material-family-catalog'] }); };

  return <AdminLayout><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Matérias-primas</h1><p className="text-sm text-muted-foreground">Famílias, atributos e opções globais do Vetra.</p></div>
      {selectedFamily ? <Button variant="outline" onClick={() => setSelectedFamily(null)}><ArrowLeft className="mr-2 h-4 w-4" /> Famílias</Button>
        : <Button onClick={() => setFamilyEditor({ code: '', name: '', description: '', unit: 'm²', basis: 'AREA', sort_order: 0, active: true })}><Plus className="mr-2 h-4 w-4" /> Nova família</Button>}
    </div>
    {query.isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : query.error ? <Card><CardContent className="p-6 text-destructive">{operationalErrorMessage(query.error, 'Falha ao carregar catálogo.')}</CardContent></Card> : selectedFamily ? (
      <FamilyStructure family={selectedFamily} attributes={(query.data?.attributes ?? []).filter((row) => row.item_template_id === selectedFamily.id)} options={query.data?.options ?? []}
        definitions={(query.data?.definitions ?? []).filter((row) => row.item_template_id === selectedFamily.id)} definitionOptions={query.data?.definitionOptions ?? []}
        onEditFamily={() => setFamilyEditor({ ...selectedFamily, code: selectedFamily.commercial_material_family ?? '', unit: selectedFamily.pricing_unit ?? 'm²', basis: selectedFamily.pricing_basis ?? 'AREA', active: selectedFamily.is_active })}
        onNewAttribute={() => setAttributeEditor({ code: '', label: '', type: 'SELECT', required: true, sort_order: 0, active: true })}
        onEditAttribute={(row) => setAttributeEditor({ ...row, code: row.attribute_code, type: row.data_type, required: row.is_required, active: row.is_active })}
        onNewOption={(attribute) => setOptionEditor({ attribute, value: { code: '', label: '', value: '', sort_order: 0, active: true } })}
        onEditOption={(attribute, row) => setOptionEditor({ attribute, value: { ...row, code: row.option_code, value: row.canonical_value == null ? '' : String(row.canonical_value), active: row.is_active } })}
        onNewCombination={() => setCombinationEditor(true)} onChanged={refresh} />
    ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(query.data?.families ?? []).map((family) => <Card key={family.id} className="transition hover:border-primary"><button type="button" className="w-full cursor-pointer text-left" onClick={() => setSelectedFamily(family)}><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle>{family.name}</CardTitle><Badge variant={family.is_active ? 'default' : 'secondary'}>{family.is_active ? 'ATIVA' : 'INATIVA'}</Badge></div></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{family.description}</p><div className="flex gap-2"><Badge variant="outline">{family.pricing_basis}</Badge><Badge variant="outline">{family.pricing_unit}</Badge></div><p className="text-xs text-muted-foreground">{(query.data?.attributes ?? []).filter((row) => row.item_template_id === family.id).length} atributos</p></CardContent></button></Card>)}</div>}
  </div>
  {familyEditor ? <FamilyDialog value={familyEditor} onClose={() => setFamilyEditor(null)} onSaved={async () => { await refresh(); setFamilyEditor(null); setSelectedFamily(null); }} /> : null}
  {attributeEditor && selectedFamily ? <AttributeDialog familyId={selectedFamily.id} value={attributeEditor} onClose={() => setAttributeEditor(null)} onSaved={async () => { await refresh(); setAttributeEditor(null); }} /> : null}
  {optionEditor ? <OptionDialog attribute={optionEditor.attribute} value={optionEditor.value} onClose={() => setOptionEditor(null)} onSaved={async () => { await refresh(); setOptionEditor(null); }} /> : null}
  {combinationEditor && selectedFamily ? <CombinationDialog family={selectedFamily} attributes={(query.data?.attributes ?? []).filter((row) => row.item_template_id === selectedFamily.id)} options={query.data?.options ?? []} onClose={() => setCombinationEditor(false)} onSaved={async () => { await refresh(); setCombinationEditor(false); }} /> : null}
  </AdminLayout>;
}

function FamilyStructure({ family, attributes, options, definitions, definitionOptions, onEditFamily, onNewAttribute, onEditAttribute, onNewOption, onEditOption, onNewCombination, onChanged }: {
  family: Family; attributes: Attribute[]; options: Option[]; definitions: Definition[]; definitionOptions: DefinitionOption[]; onEditFamily: () => void; onNewAttribute: () => void;
  onEditAttribute: (row: Attribute) => void; onNewOption: (attribute: Attribute) => void; onEditOption: (attribute: Attribute, row: Option) => void; onNewCombination: () => void; onChanged: () => Promise<void>;
}) {
  const orderedAttributes = useMemo(() => [...attributes].sort((a, b) => a.sort_order - b.sort_order), [attributes]);
  const navigationAttribute = orderedAttributes.find((attribute) => attribute.attribute_code === 'TYPE') ?? null;
  const [navigationOptionId, setNavigationOptionId] = useState<string | null>(null);
  const navigationOptions = navigationAttribute ? options.filter((option) => option.attribute_id === navigationAttribute.id && definitions.some((definition) => definitionOptions.some((link) => link.definition_id === definition.id && link.option_id === option.id))) : [];
  const visibleDefinitions = definitions.filter((definition) => !navigationOptionId || definitionOptions.some((link) => link.definition_id === definition.id && link.option_id === navigationOptionId));
  const matrixAttributes = orderedAttributes.filter((attribute) => attribute.id !== navigationAttribute?.id);
  const groupAttribute = matrixAttributes[0] ?? null;
  const groupOptions = groupAttribute ? options.filter((option) => option.attribute_id === groupAttribute.id && visibleDefinitions.some((definition) => definitionOptions.some((link) => link.definition_id === definition.id && link.option_id === option.id))) : [];
  const labelsFor = (definition: Definition) => orderedAttributes.map((attribute) => {
    const link = definitionOptions.find((candidate) => candidate.definition_id === definition.id && candidate.attribute_id === attribute.id);
    return options.find((option) => option.id === link?.option_id)?.label;
  }).filter((label): label is string => Boolean(label));
  const toggle = useMutation({ mutationFn: async (definition: Definition) => { const { error } = await supabase.rpc('admin_set_material_combination_active', { _definition_id: definition.id, _active: !definition.is_active }); if (error) throw error; }, onSuccess: onChanged, onError: (error) => toast.error(operationalErrorMessage(error, 'Falha ao alterar combinação.')) });
  return <div className="space-y-4"><Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>{family.name}</CardTitle><p className="text-sm text-muted-foreground">{family.commercial_material_family} · {family.pricing_basis}/{family.pricing_unit}</p></div><Button variant="outline" onClick={onEditFamily}><Pencil className="mr-2 h-4 w-4" /> Editar família</Button></CardHeader></Card>
    <div className="flex justify-end"><Button onClick={onNewAttribute}><Plus className="mr-2 h-4 w-4" /> Adicionar atributo</Button></div>
    {attributes.map((attribute) => <Card key={attribute.id}><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><CardTitle className="text-lg">{attribute.label}</CardTitle><Badge variant="outline">{attribute.data_type}</Badge>{attribute.is_required ? <Badge>Obrigatório</Badge> : null}{!attribute.is_active ? <Badge variant="secondary">Inativo</Badge> : null}</div><p className="text-xs text-muted-foreground">{attribute.attribute_code}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onEditAttribute(attribute)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button><Button size="sm" onClick={() => onNewOption(attribute)}><Plus className="mr-2 h-4 w-4" /> Opção</Button></div></CardHeader><CardContent><div className="flex flex-wrap gap-2">{options.filter((row) => row.attribute_id === attribute.id).map((option) => <Button key={option.id} size="sm" variant={option.is_active ? 'secondary' : 'outline'} onClick={() => onEditOption(attribute, option)}>{option.label}{!option.is_active ? ' · inativa' : ''}</Button>)}{options.every((row) => row.attribute_id !== attribute.id) ? <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada.</p> : null}</div></CardContent></Card>)}
    <Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">Combinações válidas</CardTitle><p className="text-sm text-muted-foreground">A organização abaixo segue os atributos e a ordem definidos no catálogo.</p></div><Button onClick={onNewCombination}><Plus className="mr-2 h-4 w-4" /> Nova combinação</Button></CardHeader><CardContent className="space-y-4">
      {navigationAttribute && !navigationOptionId ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{navigationOptions.map((option) => { const count = definitions.filter((definition) => definitionOptions.some((link) => link.definition_id === definition.id && link.option_id === option.id)).length; return <button key={option.id} type="button" className="rounded-lg border p-4 text-left transition hover:border-primary" onClick={() => setNavigationOptionId(option.id)}><p className="font-semibold">{option.label}</p><p className="text-sm text-muted-foreground">{count} combinações</p></button>; })}</div> : <>
        {navigationAttribute ? <Button size="sm" variant="outline" onClick={() => setNavigationOptionId(null)}><ArrowLeft className="mr-2 h-4 w-4" />Tipos</Button> : null}
        {groupOptions.length > 0 ? groupOptions.map((group) => <div key={group.id} className="space-y-2"><h4 className="font-semibold">{group.label}</h4><div className="grid gap-3 md:grid-cols-2">{visibleDefinitions.filter((definition) => definitionOptions.some((link) => link.definition_id === definition.id && link.option_id === group.id)).map((definition) => <DefinitionRow key={definition.id} definition={definition} labels={labelsFor(definition)} pending={toggle.isPending} onToggle={() => toggle.mutate(definition)} />)}</div></div>) : <div className="grid gap-3 md:grid-cols-2">{visibleDefinitions.map((definition) => <DefinitionRow key={definition.id} definition={definition} labels={labelsFor(definition)} pending={toggle.isPending} onToggle={() => toggle.mutate(definition)} />)}</div>}
      </>}
      {definitions.length === 0 ? <p className="text-sm text-muted-foreground">As opções estruturais existem, mas nenhuma combinação comercial foi cadastrada.</p> : null}
    </CardContent></Card>
  </div>;
}

function DefinitionRow({ definition, labels, pending, onToggle }: { definition: Definition; labels: string[]; pending: boolean; onToggle: () => void }) {
  return <div className="flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><div><p className="font-medium">{labels.join(' · ')}</p><Badge variant={definition.is_active ? 'default' : 'secondary'}>{definition.is_active ? 'ATIVA' : 'INATIVA'}</Badge></div><Button size="sm" variant="outline" disabled={pending} onClick={onToggle}><Power className="mr-2 h-4 w-4" />{definition.is_active ? 'Desativar' : 'Ativar'}</Button></div>;
}

function FamilyDialog({ value, onClose, onSaved }: { value: FamilyEditor; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(value);
  const mutation = useMutation({ mutationFn: async () => { const { error } = await supabase.rpc('admin_upsert_material_family', { _id: form.id ?? null, _code: form.code, _name: form.name ?? '', _description: form.description ?? '', _pricing_basis: form.basis, _pricing_unit: form.unit, _sort_order: Number(form.sort_order ?? 0), _active: form.active }); if (error) throw error; }, onSuccess: onSaved, onError: (error) => toast.error(operationalErrorMessage(error, 'Falha ao salvar família.')) });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{form.id ? 'Editar família' : 'Nova família'}</DialogTitle></DialogHeader><div className="grid gap-4"><Field label="Nome"><Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Código estável"><Input value={form.code} disabled={!!form.id} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field><Field label="Descrição"><Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Base"><Select value={form.basis} onValueChange={(basis) => setForm({ ...form, basis })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['AREA','LENGTH','UNIT','WEIGHT','VOLUME'].map((basis) => <SelectItem key={basis} value={basis}>{basis}</SelectItem>)}</SelectContent></Select></Field><Field label="Unidade"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field></div><Field label="Ordem"><Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field><Button type="button" variant="outline" onClick={() => setForm({ ...form, active: !form.active })}><Power className="mr-2 h-4 w-4" />{form.active ? 'Ativa' : 'Inativa'}</Button></div><Actions pending={mutation.isPending} onClose={onClose} onSave={() => mutation.mutate()} /></DialogContent></Dialog>;
}

function AttributeDialog({ familyId, value, onClose, onSaved }: { familyId: string; value: AttributeEditor; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(value);
  const mutation = useMutation({ mutationFn: async () => { const { error } = await supabase.rpc('admin_upsert_material_attribute', { _id: form.id ?? null, _family_id: familyId, _code: form.code, _label: form.label ?? '', _data_type: form.type, _required: form.required, _sort_order: Number(form.sort_order ?? 0), _active: form.active }); if (error) throw error; }, onSuccess: onSaved, onError: (error) => toast.error(operationalErrorMessage(error, 'Falha ao salvar atributo.')) });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{form.id ? 'Editar atributo' : 'Novo atributo'}</DialogTitle></DialogHeader><div className="grid gap-4"><Field label="Nome"><Input value={form.label ?? ''} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field><Field label="Código estável"><Input value={form.code} disabled={!!form.id} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field><Field label="Tipo"><Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['SELECT','TEXT','NUMBER','BOOLEAN'].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></Field><Field label="Ordem"><Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setForm({ ...form, required: !form.required })}>{form.required ? 'Obrigatório' : 'Opcional'}</Button><Button variant="outline" onClick={() => setForm({ ...form, active: !form.active })}>{form.active ? 'Ativo' : 'Inativo'}</Button></div></div><Actions pending={mutation.isPending} onClose={onClose} onSave={() => mutation.mutate()} /></DialogContent></Dialog>;
}

function OptionDialog({ attribute, value, onClose, onSaved }: { attribute: Attribute; value: OptionEditor; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(value);
  const mutation = useMutation({ mutationFn: async () => { const canonical = attribute.data_type === 'NUMBER' && form.value !== '' ? Number(form.value.replace(',', '.')) : form.value || form.code; const { error } = await supabase.rpc('admin_upsert_material_option', { _id: form.id ?? null, _attribute_id: attribute.id, _code: form.code, _label: form.label ?? '', _value: canonical, _sort_order: Number(form.sort_order ?? 0), _active: form.active }); if (error) throw error; }, onSuccess: onSaved, onError: (error) => toast.error(operationalErrorMessage(error, 'Falha ao salvar opção.')) });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{form.id ? 'Editar opção' : 'Nova opção'} · {attribute.label}</DialogTitle></DialogHeader><div className="grid gap-4"><Field label="Label"><Input value={form.label ?? ''} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field><Field label="Código estável"><Input value={form.code} disabled={!!form.id} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field><Field label="Valor canônico"><Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field><Field label="Ordem"><Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field><Button variant="outline" onClick={() => setForm({ ...form, active: !form.active })}>{form.active ? 'Ativa' : 'Inativa'}</Button></div><Actions pending={mutation.isPending} onClose={onClose} onSave={() => mutation.mutate()} /></DialogContent></Dialog>;
}

function CombinationDialog({ family, attributes, options, onClose, onSaved }: { family: Family; attributes: Attribute[]; options: Option[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const availableAttributes = useMemo(() => attributes.filter((attribute) => attribute.is_active).sort((a, b) => a.sort_order - b.sort_order), [attributes]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState(0);
  const missingRequired = availableAttributes.some((attribute) => attribute.is_required && !selected[attribute.id]);
  const mutation = useMutation({
    mutationFn: async () => {
      const optionIds = availableAttributes.map((attribute) => selected[attribute.id]).filter((id): id is string => Boolean(id));
      const { error } = await supabase.rpc('admin_save_material_combination', {
        _id: null as unknown as string, _family_id: family.id, _option_ids: optionIds, _sort_order: sortOrder, _active: true,
      });
      if (error) throw error;
    },
    onSuccess: onSaved,
    onError: (error) => toast.error(operationalErrorMessage(error, 'Falha ao salvar combinação.')),
  });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Nova combinação · {family.name}</DialogTitle></DialogHeader><div className="grid gap-4">{availableAttributes.map((attribute) => <Field key={attribute.id} label={`${attribute.label}${attribute.is_required ? ' *' : ''}`}><Select value={selected[attribute.id] ?? ''} onValueChange={(optionId) => setSelected((current) => ({ ...current, [attribute.id]: optionId }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.filter((option) => option.attribute_id === attribute.id && option.is_active).map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></Field>)}<Field label="Ordem"><Input type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></Field><p className="text-xs text-muted-foreground">A combinação é global. Cada empresa decide separadamente se deseja ativá-la e definir seus próprios preços.</p></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={missingRequired || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Criar combinação</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Actions({ pending, onClose, onSave }: { pending: boolean; onClose: () => void; onSave: () => void }) { return <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={pending} onClick={onSave}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button></DialogFooter>; }
