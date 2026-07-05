import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil, Palette, Ruler, Layers, DollarSign, GlassWater, ChevronRight } from 'lucide-react';
import {
  useAdminGlassColors,
  useAdminGlassThicknesses,
  useAdminAluminumColors,
  useAdminSuggestedPrices,
} from '@/hooks/useAdminPricingLists';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
const ADMIN_VIDROS_KEY = '__vidros__';
export const linhaToSlug = (l: string) => encodeURIComponent(l);

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface NameFormState {
  open: boolean;
  id?: string;
  name: string;
  hex_color: string;
  is_active: boolean;
}
const emptyName: NameFormState = { open: false, name: '', hex_color: '', is_active: true };

function NameListSection({
  title,
  icon,
  hook,
  hasHex = true,
}: {
  title: string;
  icon: React.ReactNode;
  hook: typeof useAdminGlassColors;
  hasHex?: boolean;
}) {
  const { data = [], upsert, remove } = hook();
  const [form, setForm] = useState<NameFormState>(emptyName);

  const save = () => {
    if (!form.name.trim()) return;
    upsert.mutate({
      id: form.id,
      name: form.name.trim(),
      slug: slugify(form.name),
      hex_color: hasHex ? form.hex_color || null : null,
      is_active: form.is_active,
    } as never);
    setForm(emptyName);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">{icon}{title}</CardTitle>
        <Button size="sm" onClick={() => setForm({ ...emptyName, open: true })}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              {hasHex && <TableHead>Cor</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                {hasHex && (
                  <TableCell>
                    {item.hex_color ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded border" style={{ backgroundColor: item.hex_color }} />
                        <span className="text-xs text-muted-foreground">{item.hex_color}</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={item.is_active ? 'default' : 'secondary'}>
                    {item.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setForm({
                    open: true, id: item.id, name: item.name, hex_color: item.hex_color ?? '', is_active: item.is_active,
                  })}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow><TableCell colSpan={hasHex ? 4 : 3} className="text-center text-muted-foreground py-6">Nenhum cadastro.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={form.open} onOpenChange={(o) => !o && setForm(emptyName)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Adicionar'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {hasHex && (
              <div>
                <Label>Cor (hex)</Label>
                <Input type="color" value={form.hex_color || '#cccccc'} onChange={(e) => setForm({ ...form, hex_color: e.target.value })} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(emptyName)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ThicknessSection() {
  const { data = [], upsert, remove } = useAdminGlassThicknesses();
  const [thick, setThick] = useState('');

  const add = () => {
    const mm = parseInt(thick, 10);
    if (!mm || mm <= 0) return;
    upsert.mutate({ thickness_mm: mm, label: `${mm}mm`, is_active: true, sort_order: mm } as never);
    setThick('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Ruler className="w-5 h-5" />Espessuras de Vidro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Espessura em mm (ex: 8)" type="number" value={thick} onChange={(e) => setThick(e.target.value)} className="max-w-[220px]" />
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.map((t) => (
            <div key={t.id} className="flex items-center gap-1 border rounded-md pl-3 pr-1 py-1 bg-muted">
              <span className="text-sm font-medium">{t.thickness_mm}mm</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(t.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {data.length === 0 && <span className="text-sm text-muted-foreground">Nenhuma espessura cadastrada.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestedPricesSection() {
  const { data: glassColors = [] } = useAdminGlassColors();
  const { data: thicknesses = [] } = useAdminGlassThicknesses();
  const { data: aluColors = [] } = useAdminAluminumColors();
  const { data: prices = [], upsert } = useAdminSuggestedPrices();

  const getGlass = (color: string, mm: number) =>
    prices.find(p => p.kind === 'glass' && p.glass_color === color && p.thickness_mm === mm);
  const getAlu = (color: string) =>
    prices.find(p => p.kind === 'aluminum' && p.aluminum_color === color);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5" />Preços Sugeridos (fallback)</CardTitle>
        <CardDescription>
          Usados no orçamento quando a empresa não cadastrou preço próprio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2 text-sm">Vidro (por m²)</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cor</TableHead>
                  <TableHead>Espessura</TableHead>
                  <TableHead>Custo/m²</TableHead>
                  <TableHead>Preço/m²</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {glassColors.flatMap(c => thicknesses.map(t => {
                  const p = getGlass(c.name, t.thickness_mm);
                  return <PriceRow
                    key={`${c.id}-${t.id}`}
                    label={`${c.name} · ${t.thickness_mm}mm`}
                    initial={{ cost: p?.cost_per_sqm, price: p?.price_per_sqm }}
                    onSave={(cost, price) => upsert.mutate({
                      kind: 'glass', glass_color: c.name, thickness_mm: t.thickness_mm,
                      cost_per_sqm: cost, price_per_sqm: price,
                    })}
                  />;
                }))}
                {glassColors.length === 0 || thicknesses.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Cadastre cores e espessuras primeiro.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2 text-sm">Alumínio (por metro linear e por m²)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Custo/ml</TableHead>
                <TableHead>Preço/ml</TableHead>
                <TableHead>Custo/m²</TableHead>
                <TableHead>Preço/m²</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {aluColors.map(c => {
                const p = getAlu(c.name);
                return <AluPriceRow
                  key={c.id}
                  label={c.name}
                  initial={{
                    costM: p?.cost_per_meter, priceM: p?.price_per_meter,
                    costSqm: p?.cost_per_sqm, priceSqm: p?.price_per_sqm,
                  }}
                  onSave={(v) => upsert.mutate({
                    kind: 'aluminum', aluminum_color: c.name,
                    cost_per_meter: v.costM, price_per_meter: v.priceM,
                    cost_per_sqm: v.costSqm, price_per_sqm: v.priceSqm,
                  })}
                />;
              })}
              {aluColors.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Cadastre cores de alumínio primeiro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceRow({ label, initial, onSave }: {
  label: string; initial: { cost?: number | null; price?: number | null };
  onSave: (cost: number | null, price: number | null) => void;
}) {
  const [cost, setCost] = useState<string>(initial.cost != null ? String(initial.cost) : '');
  const [price, setPrice] = useState<string>(initial.price != null ? String(initial.price) : '');
  return (
    <TableRow>
      <TableCell>{label.split(' · ')[0]}</TableCell>
      <TableCell><Badge variant="secondary">{label.split(' · ')[1]}</Badge></TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="w-28" /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" /></TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}>Salvar</Button>
      </TableCell>
    </TableRow>
  );
}

function AluPriceRow({ label, initial, onSave }: {
  label: string;
  initial: { costM?: number | null; priceM?: number | null; costSqm?: number | null; priceSqm?: number | null };
  onSave: (v: { costM: number | null; priceM: number | null; costSqm: number | null; priceSqm: number | null }) => void;
}) {
  const [costM, setCostM] = useState<string>(initial.costM != null ? String(initial.costM) : '');
  const [priceM, setPriceM] = useState<string>(initial.priceM != null ? String(initial.priceM) : '');
  const [costS, setCostS] = useState<string>(initial.costSqm != null ? String(initial.costSqm) : '');
  const [priceS, setPriceS] = useState<string>(initial.priceSqm != null ? String(initial.priceSqm) : '');
  const num = (v: string) => (v ? parseFloat(v) : null);
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell><Input type="number" step="0.01" value={costM} onChange={(e) => setCostM(e.target.value)} className="w-24" /></TableCell>
      <TableCell><Input type="number" step="0.01" value={priceM} onChange={(e) => setPriceM(e.target.value)} className="w-24" /></TableCell>
      <TableCell><Input type="number" step="0.01" value={costS} onChange={(e) => setCostS(e.target.value)} className="w-24" /></TableCell>
      <TableCell><Input type="number" step="0.01" value={priceS} onChange={(e) => setPriceS(e.target.value)} className="w-24" /></TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={() => onSave({ costM: num(costM), priceM: num(priceM), costSqm: num(costS), priceSqm: num(priceS) })}>Salvar</Button>
      </TableCell>
    </TableRow>
  );
}

export default function AdminInsumos() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Tabela de Insumos</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre a lista mestre de cores de vidro, espessuras, cores de alumínio e preços sugeridos.
            Essas opções aparecem em Product Templates e servem de fallback para orçamentos das empresas.
          </p>
        </div>

        <Tabs defaultValue="glass-colors" className="space-y-4">
          <TabsList>
            <TabsTrigger value="glass-colors"><Palette className="w-4 h-4 mr-1" />Cores de Vidro</TabsTrigger>
            <TabsTrigger value="thicknesses"><Ruler className="w-4 h-4 mr-1" />Espessuras</TabsTrigger>
            <TabsTrigger value="aluminum"><Layers className="w-4 h-4 mr-1" />Cores de Alumínio</TabsTrigger>
            <TabsTrigger value="prices"><DollarSign className="w-4 h-4 mr-1" />Preços Sugeridos</TabsTrigger>
          </TabsList>

          <TabsContent value="glass-colors">
            <NameListSection title="Cores de Vidro" icon={<Palette className="w-5 h-5" />} hook={useAdminGlassColors} />
          </TabsContent>
          <TabsContent value="thicknesses">
            <ThicknessSection />
          </TabsContent>
          <TabsContent value="aluminum">
            <NameListSection title="Cores de Alumínio" icon={<Layers className="w-5 h-5" />} hook={useAdminAluminumColors} />
          </TabsContent>
          <TabsContent value="prices">
            <SuggestedPricesSection />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
