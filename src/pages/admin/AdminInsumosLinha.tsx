import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft, Layers, Palette, Wrench, Sparkles, Loader2,
  ChevronDown, ChevronRight, DollarSign,
} from 'lucide-react';
import {
  useAdminGlassColors,
  useAdminGlassThicknesses,
  useAdminSuggestedPrices,
} from '@/hooks/useAdminPricingLists';
import {
  useItemTemplateColorPrices,
} from '@/hooks/useItemColorPrices';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const VIDROS_KEY = '__vidros__';
const GUARNICAO_REGEX = /guarn|borracha|veda|escova|felt|pel[uú]cia/i;

interface Template {
  id: string;
  name: string;
  linha: string | null;
  type: string;
}

export default function AdminInsumosLinha() {
  const { linha: linhaParam = '' } = useParams();
  const linhaDecoded = decodeURIComponent(linhaParam);
  const isVidros = linhaDecoded === VIDROS_KEY;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-insumos-linha-templates', linhaDecoded],
    enabled: !isVidros,
    queryFn: async () => {
      const q = sb
        .from('item_templates')
        .select('id, name, linha, type')
        .eq('is_active', true)
        .in('type', ['profile', 'accessory'])
        .order('name');
      if (linhaDecoded === 'Sem Linha') q.is('linha', null);
      else q.eq('linha', linhaDecoded);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Template[];
    },
    staleTime: 60_000,
  });

  const perfis = useMemo(() => templates.filter(t => t.type === 'profile'), [templates]);
  const acessorios = useMemo(
    () => templates.filter(t => t.type === 'accessory' && !GUARNICAO_REGEX.test(t.name)),
    [templates],
  );
  const guarnicoes = useMemo(
    () => templates.filter(t => t.type === 'accessory' && GUARNICAO_REGEX.test(t.name)),
    [templates],
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/categories"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Link>
          </Button>
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{isVidros ? 'Vidros' : linhaDecoded}</h1>
              <p className="text-sm text-muted-foreground">
                {isVidros
                  ? 'Preços sugeridos por combinação de cor e espessura.'
                  : 'Edite preços sugeridos por cor para perfis, acessórios e guarnições desta linha.'}
              </p>
            </div>
          </div>
        </div>

        {isVidros ? (
          <VidrosAdminTab />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="perfis">
            <TabsList>
              <TabsTrigger value="perfis"><Layers className="w-4 h-4 mr-1" />Perfis ({perfis.length})</TabsTrigger>
              <TabsTrigger value="acessorios"><Wrench className="w-4 h-4 mr-1" />Acessórios ({acessorios.length})</TabsTrigger>
              <TabsTrigger value="guarnicoes"><Sparkles className="w-4 h-4 mr-1" />Guarnições ({guarnicoes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="perfis" className="space-y-2 mt-4">
              <TemplateList items={perfis} emptyLabel="Nenhum perfil nesta linha." />
            </TabsContent>
            <TabsContent value="acessorios" className="space-y-2 mt-4">
              <TemplateList items={acessorios} emptyLabel="Nenhum acessório nesta linha." />
            </TabsContent>
            <TabsContent value="guarnicoes" className="space-y-2 mt-4">
              <TemplateList items={guarnicoes} emptyLabel="Nenhuma guarnição nesta linha." />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}

function TemplateList({ items, emptyLabel }: { items: Template[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">{emptyLabel}</CardContent></Card>;
  }
  return <div className="space-y-2">{items.map(t => <TemplateCard key={t.id} template={t} />)}</div>;
}

function TemplateCard({ template }: { template: Template }) {
  const [open, setOpen] = useState(false);
  const { data: rows = [], upsert, remove } = useItemTemplateColorPrices(open ? template.id : undefined);
  const [newColor, setNewColor] = useState('');

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="w-full flex items-stretch">
          <Link
            to={`/admin/insumos?edit=${template.id}`}
            className="flex-1 flex items-center gap-3 p-4 hover:bg-muted/40 text-left rounded-l-lg transition-colors"
            title="Editar insumo"
          >
            <div>
              <div className="font-semibold hover:underline">{template.name}</div>
              {template.linha && <div className="text-xs text-muted-foreground">{template.linha}</div>}
            </div>
          </Link>
          <CollapsibleTrigger asChild>
            <button
              className="flex items-center gap-2 px-4 border-l hover:bg-muted/40 text-sm text-muted-foreground"
              title={open ? 'Ocultar cores' : 'Ver cores'}
            >
              {open && <Badge variant="secondary">{rows.length} cor(es)</Badge>}
              <span className="hidden sm:inline">Cores</span>
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar cor (ex: Branco)"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="max-w-[240px]"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newColor.trim()) return;
                  upsert.mutate({
                    item_template_id: template.id,
                    color_name: newColor.trim(),
                    cost_per_meter: null,
                    price_per_meter: null,
                  });
                  setNewColor('');
                }}
              >
                Adicionar cor
              </Button>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma cor cadastrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cor</TableHead>
                    <TableHead className="w-32">Custo/ml sugerido</TableHead>
                    <TableHead className="w-32">Preço/ml sugerido</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <AdminColorRow
                      key={r.color_name}
                      row={r}
                      onSave={(cost, price) => upsert.mutate({
                        item_template_id: template.id,
                        color_name: r.color_name,
                        cost_per_meter: cost,
                        price_per_meter: price,
                      })}
                      onRemove={() => r.id && remove.mutate(r.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function AdminColorRow({ row, onSave, onRemove }: {
  row: { color_name: string; cost_per_meter: number | null; price_per_meter: number | null };
  onSave: (cost: number | null, price: number | null) => void;
  onRemove: () => void;
}) {
  const [cost, setCost] = useState(row.cost_per_meter != null ? String(row.cost_per_meter) : '');
  const [price, setPrice] = useState(row.price_per_meter != null ? String(row.price_per_meter) : '');
  return (
    <TableRow>
      <TableCell className="font-medium">{row.color_name}</TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></TableCell>
      <TableCell className="text-right space-x-2">
        <Button size="sm" variant="default" onClick={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
          Remover
        </Button>
      </TableCell>
    </TableRow>
  );
}

/* ───── Vidros — preços sugeridos globais ───── */

function VidrosAdminTab() {
  const { data: glassColors = [] } = useAdminGlassColors();
  const { data: thicknesses = [] } = useAdminGlassThicknesses();
  const { data: prices = [], upsert } = useAdminSuggestedPrices();

  const getP = (color: string, mm: number) =>
    prices.find(p => p.kind === 'glass' && p.glass_color === color && p.thickness_mm === mm);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5" />Preços Sugeridos de Vidro (por m²)
        </CardTitle>
        <CardDescription>Fallback usado no orçamento quando a empresa não cadastra preço próprio.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead>Espessura</TableHead>
              <TableHead className="w-32">Custo/m²</TableHead>
              <TableHead className="w-32">Preço/m²</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {glassColors.filter(c => c.is_active).flatMap(c =>
              thicknesses.filter(t => t.is_active).map(t => {
                const p = getP(c.name, t.thickness_mm);
                return (
                  <VidroAdminRow
                    key={`${c.id}-${t.id}`}
                    colorName={c.name}
                    thicknessLabel={`${t.thickness_mm}mm`}
                    initialCost={p?.cost_per_sqm}
                    initialPrice={p?.price_per_sqm}
                    onSave={(cost, price) => upsert.mutate({
                      kind: 'glass', glass_color: c.name, thickness_mm: t.thickness_mm,
                      cost_per_sqm: cost, price_per_sqm: price,
                    })}
                  />
                );
              })
            )}
            {(glassColors.length === 0 || thicknesses.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Cadastre cores e espessuras antes.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function VidroAdminRow({ colorName, thicknessLabel, initialCost, initialPrice, onSave }: {
  colorName: string; thicknessLabel: string;
  initialCost?: number | null; initialPrice?: number | null;
  onSave: (cost: number | null, price: number | null) => void;
}) {
  const [cost, setCost] = useState(initialCost != null ? String(initialCost) : '');
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  return (
    <TableRow>
      <TableCell className="font-medium">{colorName}</TableCell>
      <TableCell><Badge variant="secondary">{thicknessLabel}</Badge></TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}>
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}
