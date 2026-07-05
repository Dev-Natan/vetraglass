import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft, Layers, Palette, Wrench, Sparkles, Loader2,
  ChevronDown, ChevronRight, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminGlassColors,
  useAdminGlassThicknesses,
  useAdminSuggestedPrices,
} from '@/hooks/useAdminPricingLists';
import {
  useItemTemplateColorPrices,
  useCompanyItemColorPrices,
} from '@/hooks/useItemColorPrices';
import { useStockByTemplate } from '@/hooks/useStockByTemplate';
import { useGlassStockByColorThickness, glassStockKey } from '@/hooks/useGlassStockByColorThickness';

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

/* ───────── Company suggested prices (glass) ───────── */
interface CompanySuggestedPrice {
  id?: string;
  company_id: string;
  kind: 'glass' | 'aluminum';
  glass_color: string | null;
  thickness_mm: number | null;
  aluminum_color: string | null;
  cost_per_sqm: number | null;
  price_per_sqm: number | null;
  cost_per_meter: number | null;
  price_per_meter: number | null;
}

function useCompanySuggestedPrices() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['company-suggested-prices', companyId],
    queryFn: async () => {
      if (!companyId) return [] as CompanySuggestedPrice[];
      const { data, error } = await sb
        .from('company_suggested_prices')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as CompanySuggestedPrice[];
    },
    enabled: !!companyId,
  });

  const upsert = useMutation({
    mutationFn: async (input: Omit<CompanySuggestedPrice, 'company_id' | 'id'>) => {
      if (!companyId) throw new Error('Sem empresa ativa');
      const payload = { ...input, company_id: companyId };
      const onConflict = input.kind === 'glass'
        ? 'company_id,glass_color,thickness_mm'
        : 'company_id,aluminum_color';
      const { error } = await sb.from('company_suggested_prices').upsert(payload, { onConflict });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-suggested-prices', companyId] });
      toast.success('Preço salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert };
}

/* ───────── Page ───────── */

export default function MeusPrecosLinha() {
  const { linha: linhaParam = '' } = useParams();
  const linhaDecoded = decodeURIComponent(linhaParam);
  const isVidros = linhaDecoded === VIDROS_KEY;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['meus-precos-linha-templates', linhaDecoded],
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
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/meus-precos"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Link>
          </Button>
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{isVidros ? 'Vidros' : linhaDecoded}</h1>
              <p className="text-sm text-muted-foreground">
                {isVidros
                  ? 'Preços por combinação de cor e espessura.'
                  : 'Edite preços por cor, verifique estoque e mantenha seus insumos organizados.'}
              </p>
            </div>
          </div>
        </div>

        {isVidros ? (
          <VidrosTab />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="perfis">
            <TabsList>
              <TabsTrigger value="perfis">
                <Layers className="w-4 h-4 mr-1" />Perfis ({perfis.length})
              </TabsTrigger>
              <TabsTrigger value="acessorios">
                <Wrench className="w-4 h-4 mr-1" />Acessórios ({acessorios.length})
              </TabsTrigger>
              <TabsTrigger value="guarnicoes">
                <Sparkles className="w-4 h-4 mr-1" />Guarnições ({guarnicoes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="perfis" className="space-y-2 mt-4">
              <TemplateListByColor items={perfis} emptyLabel="Nenhum perfil nesta linha." />
            </TabsContent>
            <TabsContent value="acessorios" className="space-y-2 mt-4">
              <TemplateListByColor items={acessorios} emptyLabel="Nenhum acessório nesta linha." />
            </TabsContent>
            <TabsContent value="guarnicoes" className="space-y-2 mt-4">
              <TemplateListByColor items={guarnicoes} emptyLabel="Nenhuma guarnição nesta linha." />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

/* ───────── Lista de templates com edição de preço por cor + badge de estoque ───────── */

function TemplateListByColor({ items, emptyLabel }: { items: Template[]; emptyLabel: string }) {
  const { data: stockMap } = useStockByTemplate();
  if (items.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground">{emptyLabel}</CardContent></Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map(t => (
        <TemplateCard key={t.id} template={t} stock={stockMap?.get(t.id)} />
      ))}
    </div>
  );
}

function TemplateCard({
  template, stock,
}: {
  template: Template;
  stock?: { quantity: number; unit: string | null };
}) {
  const [open, setOpen] = useState(false);
  const { data: adminRows = [] } = useItemTemplateColorPrices(open ? template.id : undefined);
  const { data: companyRows = [], upsert } = useCompanyItemColorPrices(open ? template.id : undefined);
  const getCompany = (color: string) => companyRows.find(r => r.color_name === color);

  const qty = stock?.quantity ?? 0;
  const unit = stock?.unit ?? 'un';
  const hasStock = qty > 0;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 text-left">
            <div className="flex items-center gap-3">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <div>
                <div className="font-semibold">{template.name}</div>
                {template.linha && <div className="text-xs text-muted-foreground">{template.linha}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={hasStock ? 'secondary' : 'outline'} className="gap-1">
                <Package className="w-3 h-3" />
                {hasStock ? `${qty} ${unit} em estoque` : 'Sem estoque'}
              </Badge>
              {open && <Badge variant="secondary">{adminRows.length} cor(es)</Badge>}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {adminRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                O Admin ainda não cadastrou cores para este item.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cor</TableHead>
                    <TableHead className="w-32">Meu Custo/ml</TableHead>
                    <TableHead className="w-32">Meu Preço/ml</TableHead>
                    <TableHead>Sugerido</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminRows.map(ar => {
                    const cr = getCompany(ar.color_name);
                    return (
                      <ColorRow
                        key={ar.color_name}
                        colorName={ar.color_name}
                        initialCost={cr?.cost_per_meter}
                        initialPrice={cr?.price_per_meter}
                        suggested={
                          `${ar.cost_per_meter != null ? `Custo R$ ${ar.cost_per_meter}` : ''}` +
                          `${ar.price_per_meter != null ? ` · Preço R$ ${ar.price_per_meter}` : ''}`
                          || '—'
                        }
                        onSave={(cost, price) => upsert.mutate({
                          item_template_id: template.id,
                          color_name: ar.color_name,
                          cost_per_meter: cost,
                          price_per_meter: price,
                        })}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ColorRow({ colorName, initialCost, initialPrice, suggested, onSave }: {
  colorName: string;
  initialCost?: number | null;
  initialPrice?: number | null;
  suggested: string;
  onSave: (cost: number | null, price: number | null) => void;
}) {
  const [cost, setCost] = useState(initialCost != null ? String(initialCost) : '');
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  const isSet = cost !== '' || price !== '';
  return (
    <TableRow>
      <TableCell className="font-medium">{colorName}</TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{suggested}</TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant={isSet ? 'default' : 'outline'}
          onClick={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}>
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}

/* ───────── Vidros (cross-linha) ───────── */

function VidrosTab() {
  const { data: glassColors = [] } = useAdminGlassColors();
  const { data: thicknesses = [] } = useAdminGlassThicknesses();
  const { data: adminPrices = [] } = useAdminSuggestedPrices();
  const { data: companyPrices = [], upsert } = useCompanySuggestedPrices();
  const { data: glassStockMap } = useGlassStockByColorThickness();

  const getCompanyGlass = (color: string, thick: number) =>
    companyPrices.find(p => p.kind === 'glass' && p.glass_color === color && p.thickness_mm === thick);
  const getAdminGlass = (color: string, thick: number) =>
    adminPrices.find(p => p.kind === 'glass' && p.glass_color === color && p.thickness_mm === thick);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Palette className="w-5 h-5" />Preços de Vidro (por m²)</CardTitle>
        <CardDescription>Combinações de cor × espessura cadastradas pelo Admin.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead>Espessura</TableHead>
              <TableHead className="w-40">Em Estoque</TableHead>
              <TableHead className="w-32">Meu Custo/m²</TableHead>
              <TableHead className="w-32">Meu Preço/m²</TableHead>
              <TableHead>Sugerido</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {glassColors.filter(c => c.is_active).flatMap(c =>
              thicknesses.filter(t => t.is_active).map(t => {
                const cp = getCompanyGlass(c.name, t.thickness_mm);
                const ap = getAdminGlass(c.name, t.thickness_mm);
                const stock = glassStockMap?.get(glassStockKey(c.name, t.thickness_mm));
                const qty = stock?.quantity ?? 0;
                const unit = stock?.unit ?? 'm²';
                const hasStock = qty > 0;
                return (
                  <GlassRow
                    key={`${c.id}-${t.id}`}
                    colorName={c.name}
                    thicknessLabel={`${t.thickness_mm}mm`}
                    stockLabel={hasStock ? `${qty} ${unit}` : 'Sem estoque'}
                    hasStock={hasStock}
                    initialCost={cp?.cost_per_sqm}
                    initialPrice={cp?.price_per_sqm}
                    suggested={
                      `${ap?.cost_per_sqm != null ? `Custo R$ ${ap.cost_per_sqm}` : ''}` +
                      `${ap?.price_per_sqm != null ? ` · Preço R$ ${ap.price_per_sqm}` : ''}`
                      || '—'
                    }
                    onSave={(cost, price) => upsert.mutate({
                      kind: 'glass', glass_color: c.name, thickness_mm: t.thickness_mm,
                      aluminum_color: null,
                      cost_per_sqm: cost, price_per_sqm: price,
                      cost_per_meter: null, price_per_meter: null,
                    })}
                  />
                );
              })
            )}
            {(glassColors.length === 0 || thicknesses.length === 0) && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                O Admin ainda não cadastrou cores ou espessuras.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GlassRow({ colorName, thicknessLabel, stockLabel, hasStock, initialCost, initialPrice, suggested, onSave }: {
  colorName: string; thicknessLabel: string;
  stockLabel: string; hasStock: boolean;
  initialCost?: number | null; initialPrice?: number | null;
  suggested: string;
  onSave: (cost: number | null, price: number | null) => void;
}) {
  const [cost, setCost] = useState(initialCost != null ? String(initialCost) : '');
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  const isSet = cost !== '' || price !== '';
  return (
    <TableRow>
      <TableCell className="font-medium">{colorName}</TableCell>
      <TableCell><Badge variant="secondary">{thicknessLabel}</Badge></TableCell>
      <TableCell>
        <Badge variant={hasStock ? 'secondary' : 'outline'} className="gap-1">
          <Package className="w-3 h-3" />{stockLabel}
        </Badge>
      </TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{suggested}</TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant={isSet ? 'default' : 'outline'}
          onClick={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}>
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}
