import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, Layers3, Loader2, Pencil, Plus, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { operationalErrorMessage } from '@/utils/operationalError';

type PricingMethod = 'COMPOSITION' | 'LINE_PRICE_PER_M2' | 'LEGACY_FIXED_PER_SQM';
type LineSummary = {
  id: string;
  slug: string;
  name: string;
  band_count: number;
  min_price: number | null;
  max_price: number | null;
  line_product_count: number;
};
type ProductSummary = {
  id: string;
  name: string;
  catalog_origin: string | null;
  product_template_id: string | null;
  line_id: string | null;
  line_name: string | null;
  line_slug: string | null;
  method: PricingMethod;
};
type Workspace = { labor_percent: number; lines: LineSummary[]; products: ProductSummary[] };
type GlassOption = { id: string; type: string; color: string; thickness_mm: number; finish: string };
type ProfileColor = { id: string; code: string; name: string; hex_color: string | null; catalog_origin: string };
type LineOptions = { glass_variants: GlassOption[]; profile_colors: ProfileColor[]; profile_finishes: string[] };
type PriceBand = {
  id: string;
  description: string;
  price_per_m2: number;
  is_active: boolean;
  glass_variant_definition_ids: string[];
  company_color_ids: string[];
  profile_finishes: string[];
  glass_labels: string[];
  profile_color_labels: string[];
};

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinalProductsPricing({ companyId, mayEdit }: { companyId: string; mayEdit: boolean }) {
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const workspace = usePricingWorkspace(companyId);
  const selectedLine = workspace.data?.lines.find((line) => line.id === selectedLineId) ?? null;

  if (workspace.isLoading) return <Loading />;
  if (workspace.error) return <ErrorCard error={workspace.error} />;
  if (selectedLine) {
    return (
      <LinePricingDetail
        companyId={companyId}
        line={selectedLine}
        mayEdit={mayEdit}
        onBack={() => setSelectedLineId(null)}
      />
    );
  }

  const products = workspace.data?.products ?? [];
  const compositionCount = products.filter((product) => product.method === 'COMPOSITION').length;
  const lineCount = products.filter((product) => product.method === 'LINE_PRICE_PER_M2').length;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Preço por linha / m²</h2>
          <p className="text-sm text-muted-foreground">
            Uma faixa cobre várias combinações sem criar preços duplicados.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(workspace.data?.lines ?? []).map((line) => (
            <Card key={line.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{line.name}</span>
                  <Layers3 className="h-5 w-5 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={line.band_count > 0 ? 'default' : 'outline'}>
                    {line.band_count} {line.band_count === 1 ? 'faixa' : 'faixas'}
                  </Badge>
                  <Badge variant="secondary">{line.line_product_count} produtos</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {line.min_price == null
                    ? 'Nenhum preço configurado.'
                    : `${money(Number(line.min_price))} — ${money(Number(line.max_price))}/m²`}
                </p>
                <Button className="mt-auto" variant="outline" onClick={() => setSelectedLineId(line.id)}>
                  Configurar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Método dos produtos finais</h2>
          <p className="text-sm text-muted-foreground">
            Cada produto usa composição ou uma faixa da linha, nunca os dois ao mesmo tempo.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryCard icon={<Layers3 className="h-5 w-5" />} label="Preço por linha" value={lineCount} />
          <SummaryCard icon={<Calculator className="h-5 w-5" />} label="Preço por composição" value={compositionCount} />
        </div>
        {products.length === 0 ? (
          <Empty text="Nenhum produto final ativo nesta empresa." />
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <ProductMethodRow
                key={product.id}
                companyId={companyId}
                product={product}
                lines={workspace.data?.lines ?? []}
                mayEdit={mayEdit}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function CompositionLaborCard({ companyId, mayEdit }: { companyId: string; mayEdit: boolean }) {
  const queryClient = useQueryClient();
  const workspace = usePricingWorkspace(companyId);
  const [value, setValue] = useState('0');
  useEffect(() => {
    if (workspace.data) setValue(String(workspace.data.labor_percent ?? 0));
  }, [workspace.data]);
  const numericValue = Number(value.replace(',', '.'));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_company_composition_labor_percent', {
        _company_id: companyId,
        _labor_percent: numericValue,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pricing-workspace', companyId] });
      toast.success('Percentual de mão de obra atualizado.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível salvar a mão de obra.')),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" />Mão de obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Aplicada uma única vez após a soma comercial dos componentes de produtos por composição.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:max-w-48">
            <Label htmlFor="composition-labor">Percentual da empresa</Label>
            <div className="relative">
              <Input
                id="composition-labor"
                inputMode="decimal"
                value={value}
                disabled={!mayEdit}
                onChange={(event) => setValue(event.target.value)}
                className="pr-9"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
            </div>
          </div>
          {mayEdit ? (
            <Button
              disabled={!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 1000 || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar
            </Button>
          ) : null}
        </div>
        <div className="rounded-md bg-muted p-3 text-sm">
          Exemplo: componentes {money(1000)} + {Number.isFinite(numericValue) ? numericValue : 0}% ={' '}
          <strong>{money(1000 * (1 + (Number.isFinite(numericValue) ? numericValue : 0) / 100))}</strong>
        </div>
      </CardContent>
    </Card>
  );
}

function usePricingWorkspace(companyId: string) {
  return useQuery({
    queryKey: ['pricing-workspace', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_pricing_workspace', { _company_id: companyId });
      if (error) throw error;
      return data as unknown as Workspace;
    },
  });
}

function ProductMethodRow({ companyId, product, lines, mayEdit }: {
  companyId: string;
  product: ProductSummary;
  lines: LineSummary[];
  mayEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PricingMethod>(product.method);
  const [lineId, setLineId] = useState(product.line_id ?? '');
  useEffect(() => {
    setMethod(product.method);
    setLineId(product.line_id ?? '');
  }, [product.line_id, product.method]);
  const save = useMutation({
    mutationFn: async () => {
      if (method === 'LEGACY_FIXED_PER_SQM') throw new Error('Escolha um método canônico.');
      const { error } = await supabase.rpc('save_company_product_pricing_method', {
        _company_id: companyId,
        _company_product_id: product.id,
        _method: method,
        _line_id: method === 'LINE_PRICE_PER_M2' ? lineId : undefined,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pricing-workspace', companyId] });
      toast.success('Método do produto atualizado.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível alterar o método.')),
  });
  return (
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(210px,0.8fr)_minmax(180px,0.7fr)_auto] lg:items-end">
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.product_template_id ? 'Catálogo global materializado' : 'Produto privado'}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Método comercial</Label>
          <Select value={method} disabled={!mayEdit} onValueChange={(value) => setMethod(value as PricingMethod)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPOSITION">Por composição</SelectItem>
              <SelectItem value="LINE_PRICE_PER_M2">Por linha / m²</SelectItem>
              {product.method === 'LEGACY_FIXED_PER_SQM' ? (
                <SelectItem value="LEGACY_FIXED_PER_SQM" disabled>Fixo/m² legado</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Linha</Label>
          <Select
            value={lineId}
            disabled={!mayEdit || method !== 'LINE_PRICE_PER_M2'}
            onValueChange={setLineId}
          >
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {lines.map((line) => <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {mayEdit ? (
          <Button disabled={save.isPending || method === 'LEGACY_FIXED_PER_SQM' || (method === 'LINE_PRICE_PER_M2' && !lineId)} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LinePricingDetail({ companyId, line, mayEdit, onBack }: {
  companyId: string;
  line: LineSummary;
  mayEdit: boolean;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<PriceBand | 'NEW' | null>(null);
  const bands = useQuery({
    queryKey: ['line-price-bands', companyId, line.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_company_line_price_bands', {
        _company_id: companyId,
        _line_id: line.id,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, price_per_m2: Number(row.price_per_m2) })) as PriceBand[];
    },
  });
  const options = useQuery({
    queryKey: ['line-pricing-options', companyId, line.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_line_pricing_options', {
        _company_id: companyId,
        _line_id: line.id,
      });
      if (error) throw error;
      return data as unknown as LineOptions;
    },
  });
  if (bands.isLoading || options.isLoading) return <Loading />;
  if (bands.error || options.error) return <ErrorCard error={bands.error ?? options.error} />;
  return (
    <div className="space-y-5">
      <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Produtos finais</Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{line.name}</h2>
          <p className="text-sm text-muted-foreground">Faixas comerciais exclusivas da empresa atual.</p>
        </div>
        {mayEdit ? <Button onClick={() => setEditing('NEW')}><Plus className="mr-2 h-4 w-4" />Nova faixa</Button> : null}
      </div>
      {(bands.data ?? []).filter((band) => band.is_active).length === 0 ? (
        <Empty text="Nenhuma faixa ativa nesta linha." />
      ) : (
        <div className="space-y-3">
          {(bands.data ?? []).filter((band) => band.is_active).map((band) => (
            <Card key={band.id}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(200px,0.8fr)_minmax(260px,1.5fr)_auto] lg:items-center">
                <div>
                  <p className="font-semibold">{money(band.price_per_m2)}/m²</p>
                  <p className="text-sm text-muted-foreground">{band.description}</p>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">Vidro:</strong> {band.glass_labels.join(', ')}</p>
                  <p><strong className="text-foreground">Perfil:</strong> {band.profile_color_labels.join(', ')}</p>
                  <p><strong className="text-foreground">Acabamento:</strong> {band.profile_finishes.join(', ')}</p>
                </div>
                {mayEdit ? (
                  <div className="flex gap-2 lg:justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditing(band)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                    <DeactivateBand companyId={companyId} lineId={line.id} bandId={band.id} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <BandDialog
        companyId={companyId}
        line={line}
        band={editing}
        options={options.data ?? { glass_variants: [], profile_colors: [], profile_finishes: ['PADRAO'] }}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function BandDialog({ companyId, line, band, options, onClose }: {
  companyId: string;
  line: LineSummary;
  band: PriceBand | 'NEW' | null;
  options: LineOptions;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const existing = band && band !== 'NEW' ? band : null;
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [glassIds, setGlassIds] = useState<string[]>([]);
  const [colorIds, setColorIds] = useState<string[]>([]);
  const [finishes, setFinishes] = useState<string[]>(['PADRAO']);
  useEffect(() => {
    if (!band) return;
    setDescription(existing?.description ?? '');
    setPrice(existing ? String(existing.price_per_m2) : '');
    setGlassIds(existing?.glass_variant_definition_ids ?? []);
    setColorIds(existing?.company_color_ids ?? []);
    setFinishes(existing?.profile_finishes ?? ['PADRAO']);
  }, [band, existing]);
  const numericPrice = Number(price.replace(',', '.'));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_company_line_price_band', {
        _company_id: companyId,
        _line_id: line.id,
        _description: description.trim(),
        _price_per_m2: numericPrice,
        _glass_variant_definition_ids: glassIds,
        _company_color_ids: colorIds,
        _profile_finishes: finishes,
        _price_line_id: existing?.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['line-price-bands', companyId, line.id] }),
        queryClient.invalidateQueries({ queryKey: ['pricing-workspace', companyId] }),
      ]);
      toast.success('Faixa de preço salva.');
      onClose();
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível salvar a faixa.')),
  });
  const toggle = (values: string[], value: string, checked: boolean) => checked
    ? Array.from(new Set([...values, value]))
    : values.filter((item) => item !== value);
  return (
    <Dialog open={band != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar faixa' : 'Nova faixa'} · {line.name}</DialogTitle>
          <DialogDescription>Selecione as combinações cobertas por um único preço final por m².</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição"><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Padrão Incolor" /></Field>
            <Field label="Preço por m²"><Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="1300,00" /></Field>
          </div>
          <OptionGroup title="Vidros habilitados">
            {options.glass_variants.map((option) => (
              <CheckOption
                key={option.id}
                checked={glassIds.includes(option.id)}
                label={`${option.type} · ${option.color} · ${option.thickness_mm} mm${option.finish !== 'PADRAO' ? ` · ${option.finish}` : ''}`}
                onChecked={(checked) => setGlassIds((current) => toggle(current, option.id, checked))}
              />
            ))}
          </OptionGroup>
          <OptionGroup title="Cores do perfil">
            {options.profile_colors.map((option) => (
              <CheckOption
                key={option.id}
                checked={colorIds.includes(option.id)}
                label={option.name}
                swatch={option.hex_color}
                onChecked={(checked) => setColorIds((current) => toggle(current, option.id, checked))}
              />
            ))}
          </OptionGroup>
          <OptionGroup title="Acabamentos do perfil">
            {options.profile_finishes.map((finish) => (
              <CheckOption
                key={finish}
                checked={finishes.includes(finish)}
                label={finish}
                onChecked={(checked) => setFinishes((current) => toggle(current, finish, checked))}
              />
            ))}
          </OptionGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={save.isPending || !description.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0 || glassIds.length === 0 || colorIds.length === 0 || finishes.length === 0}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar faixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateBand({ companyId, lineId, bandId }: { companyId: string; lineId: string; bandId: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('deactivate_company_line_price_band', {
        _company_id: companyId,
        _price_line_id: bandId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['line-price-bands', companyId, lineId] }),
        queryClient.invalidateQueries({ queryKey: ['pricing-workspace', companyId] }),
      ]);
      toast.success('Faixa desativada.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível desativar a faixa.')),
  });
  return <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate()}><PowerOff className="mr-2 h-4 w-4" />Desativar</Button>;
}

function CheckOption({ checked, label, swatch, onChecked }: { checked: boolean; label: string; swatch?: string | null; onChecked: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={(value) => onChecked(value === true)} />
      {swatch ? <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: swatch }} /> : null}
      <span>{label}</span>
    </label>
  );
}
function OptionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">{title}</legend><div className="grid gap-2 sm:grid-cols-2">{children}</div></fieldset>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <Card><CardContent className="flex items-center gap-4 p-4"><span className="rounded-md bg-primary/10 p-2 text-primary">{icon}</span><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div></CardContent></Card>; }
function Loading() { return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function ErrorCard({ error }: { error: unknown }) { return <Card><CardContent className="p-6 text-sm text-destructive">{operationalErrorMessage(error, 'Não foi possível carregar a precificação.')}</CardContent></Card>; }
function Empty({ text }: { text: string }) { return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
