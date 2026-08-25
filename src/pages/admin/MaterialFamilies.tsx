import { useState } from 'react';
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
type FamilyEditor = Partial<Family> & { code: string; unit: string; basis: string; active: boolean };
type AttributeEditor = Partial<Attribute> & { code: string; type: string; required: boolean; active: boolean };
type OptionEditor = Partial<Option> & { code: string; value: string; active: boolean };

export default function MaterialFamilies() {
  const queryClient = useQueryClient();
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [familyEditor, setFamilyEditor] = useState<FamilyEditor | null>(null);
  const [attributeEditor, setAttributeEditor] = useState<AttributeEditor | null>(null);
  const [optionEditor, setOptionEditor] = useState<{ attribute: Attribute; value: OptionEditor } | null>(null);
  const query = useQuery({
    queryKey: ['admin-material-family-catalog'],
    queryFn: async () => {
      const [families, attributes, options] = await Promise.all([
        supabase.from('item_templates').select('id,commercial_material_family,name,description,pricing_basis,pricing_unit,sort_order,is_active').eq('is_commercial_area_material', true).is('company_id', null).order('sort_order').order('name'),
        supabase.from('item_template_attributes').select('*').order('sort_order').order('label'),
        supabase.from('item_template_attribute_options').select('*').order('sort_order').order('label'),
      ]);
      const error = families.error ?? attributes.error ?? options.error;
      if (error) throw error;
      return { families: (families.data ?? []) as Family[], attributes: (attributes.data ?? []) as Attribute[], options: (options.data ?? []) as Option[] };
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
        onEditFamily={() => setFamilyEditor({ ...selectedFamily, code: selectedFamily.commercial_material_family ?? '', unit: selectedFamily.pricing_unit ?? 'm²', basis: selectedFamily.pricing_basis ?? 'AREA', active: selectedFamily.is_active })}
        onNewAttribute={() => setAttributeEditor({ code: '', label: '', type: 'SELECT', required: true, sort_order: 0, active: true })}
        onEditAttribute={(row) => setAttributeEditor({ ...row, code: row.attribute_code, type: row.data_type, required: row.is_required, active: row.is_active })}
        onNewOption={(attribute) => setOptionEditor({ attribute, value: { code: '', label: '', value: '', sort_order: 0, active: true } })}
        onEditOption={(attribute, row) => setOptionEditor({ attribute, value: { ...row, code: row.option_code, value: row.canonical_value == null ? '' : String(row.canonical_value), active: row.is_active } })} />
    ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(query.data?.families ?? []).map((family) => <Card key={family.id} className="transition hover:border-primary"><button type="button" className="w-full cursor-pointer text-left" onClick={() => setSelectedFamily(family)}><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle>{family.name}</CardTitle><Badge variant={family.is_active ? 'default' : 'secondary'}>{family.is_active ? 'ATIVA' : 'INATIVA'}</Badge></div></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{family.description}</p><div className="flex gap-2"><Badge variant="outline">{family.pricing_basis}</Badge><Badge variant="outline">{family.pricing_unit}</Badge></div><p className="text-xs text-muted-foreground">{(query.data?.attributes ?? []).filter((row) => row.item_template_id === family.id).length} atributos</p></CardContent></button></Card>)}</div>}
  </div>
  {familyEditor ? <FamilyDialog value={familyEditor} onClose={() => setFamilyEditor(null)} onSaved={async () => { await refresh(); setFamilyEditor(null); setSelectedFamily(null); }} /> : null}
  {attributeEditor && selectedFamily ? <AttributeDialog familyId={selectedFamily.id} value={attributeEditor} onClose={() => setAttributeEditor(null)} onSaved={async () => { await refresh(); setAttributeEditor(null); }} /> : null}
  {optionEditor ? <OptionDialog attribute={optionEditor.attribute} value={optionEditor.value} onClose={() => setOptionEditor(null)} onSaved={async () => { await refresh(); setOptionEditor(null); }} /> : null}
  </AdminLayout>;
}

function FamilyStructure({ family, attributes, options, onEditFamily, onNewAttribute, onEditAttribute, onNewOption, onEditOption }: {
  family: Family; attributes: Attribute[]; options: Option[]; onEditFamily: () => void; onNewAttribute: () => void;
  onEditAttribute: (row: Attribute) => void; onNewOption: (attribute: Attribute) => void; onEditOption: (attribute: Attribute, row: Option) => void;
}) {
  return <div className="space-y-4"><Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>{family.name}</CardTitle><p className="text-sm text-muted-foreground">{family.commercial_material_family} · {family.pricing_basis}/{family.pricing_unit}</p></div><Button variant="outline" onClick={onEditFamily}><Pencil className="mr-2 h-4 w-4" /> Editar família</Button></CardHeader></Card>
    <div className="flex justify-end"><Button onClick={onNewAttribute}><Plus className="mr-2 h-4 w-4" /> Adicionar atributo</Button></div>
    {attributes.map((attribute) => <Card key={attribute.id}><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><CardTitle className="text-lg">{attribute.label}</CardTitle><Badge variant="outline">{attribute.data_type}</Badge>{attribute.is_required ? <Badge>Obrigatório</Badge> : null}{!attribute.is_active ? <Badge variant="secondary">Inativo</Badge> : null}</div><p className="text-xs text-muted-foreground">{attribute.attribute_code}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onEditAttribute(attribute)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button><Button size="sm" onClick={() => onNewOption(attribute)}><Plus className="mr-2 h-4 w-4" /> Opção</Button></div></CardHeader><CardContent><div className="flex flex-wrap gap-2">{options.filter((row) => row.attribute_id === attribute.id).map((option) => <Button key={option.id} size="sm" variant={option.is_active ? 'secondary' : 'outline'} onClick={() => onEditOption(attribute, option)}>{option.label}{!option.is_active ? ' · inativa' : ''}</Button>)}{options.every((row) => row.attribute_id !== attribute.id) ? <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada.</p> : null}</div></CardContent></Card>)}
  </div>;
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

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Actions({ pending, onClose, onSave }: { pending: boolean; onClose: () => void; onSave: () => void }) { return <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={pending} onClick={onSave}>{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button></DialogFooter>; }
