import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Layers, Wrench, Sparkles, Loader2, Package, Percent, DollarSign,
} from 'lucide-react';
import { useStockByTemplate } from '@/hooks/useStockByTemplate';
import {
  useStockPricing,
  useUpdateItemPricing,
  useBulkAdjustCost,
  type StockPricingRow,
} from '@/hooks/useStockPricing';

const VIDROS_KEY = '__vidros__';
const GUARNICAO_REGEX = /guarn|borracha|veda|escova|felt|pel[uú]cia/i;

function computeFinal(cost: number | null | undefined, markup: number | null | undefined) {
  const c = Number(cost) || 0;
  const m = Number(markup) || 0;
  if (c <= 0) return 0;
  return Math.round(c * (1 + m / 100) * 100) / 100;
}

export default function MeusPrecosLinha() {
  const { linha: linhaParam = '' } = useParams();
  const linhaDecoded = decodeURIComponent(linhaParam);
  const isVidros = linhaDecoded === VIDROS_KEY;

  const { data: allItems = [], isLoading } = useStockPricing(
    isVidros ? { type: 'glass' } : { linha: linhaDecoded === 'Sem Linha' ? undefined : linhaDecoded },
  );

  const perfis = useMemo(() => allItems.filter(i => i.type === 'profile'), [allItems]);
  const acessorios = useMemo(
    () => allItems.filter(i => i.type === 'accessory' && !GUARNICAO_REGEX.test(i.name)),
    [allItems],
  );
  const guarnicoes = useMemo(
    () => allItems.filter(i => i.type === 'accessory' && GUARNICAO_REGEX.test(i.name)),
    [allItems],
  );
  const vidros = useMemo(() => allItems.filter(i => i.type === 'glass'), [allItems]);

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/meus-precos"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Link>
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <Layers className="w-6 h-6 text-primary" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{isVidros ? 'Vidros' : linhaDecoded}</h1>
              <p className="text-sm text-muted-foreground">
                Precificação centralizada no estoque: custo · markup · preço final.
                {' '}O preço final é calculado automaticamente.
              </p>
            </div>
            <BulkAdjustDialog
              linha={isVidros ? undefined : linhaDecoded}
              type={isVidros ? 'glass' : undefined}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isVidros ? (
          <PricingList items={vidros} emptyLabel="Nenhum vidro cadastrado no estoque." isGlass />
        ) : (
          <Tabs defaultValue="perfis">
            <TabsList>
              <TabsTrigger value="perfis"><Layers className="w-4 h-4 mr-1" />Perfis ({perfis.length})</TabsTrigger>
              <TabsTrigger value="acessorios"><Wrench className="w-4 h-4 mr-1" />Acessórios ({acessorios.length})</TabsTrigger>
              <TabsTrigger value="guarnicoes"><Sparkles className="w-4 h-4 mr-1" />Guarnições ({guarnicoes.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="perfis" className="space-y-2 mt-4">
              <PricingList items={perfis} emptyLabel="Nenhum perfil no estoque desta linha." />
            </TabsContent>
            <TabsContent value="acessorios" className="space-y-2 mt-4">
              <PricingList items={acessorios} emptyLabel="Nenhum acessório no estoque desta linha." />
            </TabsContent>
            <TabsContent value="guarnicoes" className="space-y-2 mt-4">
              <PricingList items={guarnicoes} emptyLabel="Nenhuma guarnição no estoque desta linha." />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

/* ───────── Lista ───────── */

function PricingList({
  items, emptyLabel, isGlass = false,
}: { items: StockPricingRow[]; emptyLabel: string; isGlass?: boolean }) {
  const { data: stockMap } = useStockByTemplate();
  if (items.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">{emptyLabel}</CardContent></Card>;
  }
  return (
    <div className="space-y-2">
      {items.map(it => (
        <PricingCard
          key={it.id}
          item={it}
          isGlass={isGlass || it.type === 'glass'}
          stock={it.item_template_id ? stockMap?.get(it.item_template_id) : undefined}
        />
      ))}
    </div>
  );
}

/* ───────── Card por item ───────── */

function PricingCard({
  item, isGlass, stock,
}: {
  item: StockPricingRow;
  isGlass: boolean;
  stock?: { quantity: number; unit: string | null };
}) {
  const perMeter = item.type === 'profile';
  const costField = perMeter ? item.cost_per_meter : item.cost;
  const finalField = perMeter ? item.sale_price_per_meter : item.sale_price;
  const unitLabel = perMeter ? '/ml' : isGlass ? '/m²' : `/${item.unit ?? 'un'}`;

  const [cost, setCost] = useState(costField != null ? String(costField) : '');
  const [markup, setMarkup] = useState(item.sale_margin_percent != null ? String(item.sale_margin_percent) : '');
  const [finalOverride, setFinalOverride] = useState(finalField != null ? String(finalField) : '');
  const [autoFinal, setAutoFinal] = useState(true);

  const update = useUpdateItemPricing();

  const computedFinal = computeFinal(
    cost ? parseFloat(cost) : null,
    markup ? parseFloat(markup) : null,
  );

  const qty = stock?.quantity ?? 0;
  const stockUnit = stock?.unit ?? item.unit ?? 'un';
  const hasStock = qty > 0;

  const save = () => {
    const patch: Parameters<typeof update.mutate>[0] = { id: item.id };
    const costNum = cost ? parseFloat(cost) : null;
    const markupNum = markup ? parseFloat(markup) : null;
    const overrideNum = !autoFinal && finalOverride ? parseFloat(finalOverride) : null;

    if (perMeter) patch.cost_per_meter = costNum;
    else patch.cost = costNum;
    patch.sale_margin_percent = markupNum;
    if (overrideNum != null) {
      if (perMeter) patch.sale_price_per_meter = overrideNum;
      else patch.sale_price = overrideNum;
    }
    update.mutate(patch);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-semibold truncate">{item.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              {item.linha && <span>{item.linha}</span>}
              {isGlass && item.glass_color && <span>· {item.glass_color}</span>}
              {isGlass && item.thickness_mm && <span>· {item.thickness_mm}mm</span>}
            </div>
          </div>
          <Badge variant={hasStock ? 'secondary' : 'outline'} className="gap-1 shrink-0">
            <Package className="w-3 h-3" />
            {hasStock ? `${qty} ${stockUnit} em estoque` : 'Sem estoque'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs">Custo unitário {unitLabel}</Label>
            <Input
              type="number" step="0.01" value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label className="text-xs">Markup %</Label>
            <Input
              type="number" step="0.01" value={markup}
              onChange={e => setMarkup(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-2">
              Preço final {unitLabel}
              <button
                type="button"
                onClick={() => setAutoFinal(v => !v)}
                className="text-[10px] underline text-muted-foreground hover:text-foreground"
              >
                {autoFinal ? 'Editar manualmente' : 'Calcular auto'}
              </button>
            </Label>
            {autoFinal ? (
              <div className="h-9 px-3 border rounded-md bg-muted/40 flex items-center text-sm font-medium">
                R$ {computedFinal.toFixed(2)}
              </div>
            ) : (
              <Input
                type="number" step="0.01"
                value={finalOverride}
                onChange={e => setFinalOverride(e.target.value)}
              />
            )}
          </div>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Bulk % dialog ───────── */

function BulkAdjustDialog({ linha, type }: { linha?: string; type?: string }) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState('7');
  const bulk = useBulkAdjustCost();

  const apply = () => {
    const p = parseFloat(percent);
    if (!Number.isFinite(p)) return;
    bulk.mutate({ percent: p, linha, type }, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Percent className="w-4 h-4" />Reajuste em lote
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />Reajuste percentual sobre o custo
          </DialogTitle>
          <DialogDescription>
            Aplica o percentual ao <strong>custo unitário</strong> de todos os itens ativos
            {linha ? <> da linha <strong>{linha}</strong></> : ''}
            {type ? <> (tipo <strong>{type}</strong>)</> : ''}.
            O preço final será recalculado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Percentual (%)</Label>
          <Input type="number" step="0.01" value={percent} onChange={e => setPercent(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Ex.: <code>7</code> aumenta 7%. Use <code>-5</code> para reduzir 5%.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={apply} disabled={bulk.isPending}>
            {bulk.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar reajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
