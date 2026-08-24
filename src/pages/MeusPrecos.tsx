import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Layers3,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { operationalErrorMessage } from '@/utils/operationalError';

type AreaItem = Pick<
  Database['public']['Tables']['company_items']['Row'],
  | 'id'
  | 'company_id'
  | 'name'
  | 'type'
  | 'pricing_basis'
  | 'pricing_unit'
  | 'variant_attribute_schema'
  | 'is_active'
  | 'is_commercial_area_material'
  | 'commercial_material_family'
>;
type AreaVariant = Database['public']['Tables']['company_item_variants']['Row'];

type AttributeDefinition = {
  key: string;
  label: string;
  kind: 'select' | 'text' | 'number';
  catalog?: string;
  required?: boolean;
};

type CatalogOption = {
  value: string;
  label: string;
};

type EditorState = {
  item: AreaItem;
  variant: AreaVariant | null;
};

type Catalogs = Record<string, CatalogOption[]>;

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAttributeSchema(value: Json): AttributeDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const key = typeof entry.key === 'string' ? entry.key : '';
    const label = typeof entry.label === 'string' ? entry.label : key;
    const kind = entry.kind;
    if (!key || !['select', 'text', 'number'].includes(String(kind))) return [];
    return [{
      key,
      label,
      kind: kind as AttributeDefinition['kind'],
      catalog: typeof entry.catalog === 'string' ? entry.catalog : undefined,
      required: entry.required === true,
    }];
  });
}

function categoryLabel(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === 'glass') return 'Vidros';
  if (normalized === 'mirror' || normalized === 'espelho') return 'Espelhos';
  if (normalized === 'acm') return 'ACM';
  return type.trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function uniqueOptions(options: CatalogOption[]): CatalogOption[] {
  return Array.from(new Map(options.map((option) => [option.value, option])).values());
}

function attributeLabel(
  attributes: Json,
  schema: AttributeDefinition[],
  catalogs: Catalogs,
): string {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return 'Atributos não informados';
  }
  const values = attributes as Record<string, Json | undefined>;
  const labels = schema.flatMap((definition) => {
    const value = values[definition.key];
    if (value == null || value === '') return [];
    const option = definition.catalog
      ? catalogs[definition.catalog]?.find((entry) => entry.value === String(value))
      : null;
    const formatted = definition.key === 'thickness_mm'
      ? `${String(value)} mm`
      : option?.label ?? String(value);
    return [formatted];
  });
  return labels.length > 0 ? labels.join(' · ') : 'Atributos incompletos';
}

function priceMetrics(variant: AreaVariant) {
  const cost = variant.cost == null ? null : Number(variant.cost);
  const sale = variant.sale_price == null ? null : Number(variant.sale_price);
  const profit = cost != null && sale != null ? sale - cost : null;
  const margin = profit != null && sale != null && sale > 0
    ? (profit / sale) * 100
    : null;
  return { cost, sale, profit, margin };
}

export default function MeusPrecos() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const { canEdit, canSeeCosts, canSeePrices } = usePermissions();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);

  const pricingQuery = useQuery({
    queryKey: ['phase4a-area-pricing', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: items, error: itemsError } = await supabase
        .from('company_items')
        .select(
          'id,company_id,name,type,pricing_basis,pricing_unit,variant_attribute_schema,is_active,is_commercial_area_material,commercial_material_family',
        )
        .eq('company_id', companyId!)
        .eq('pricing_basis', 'AREA')
        .eq('is_commercial_area_material', true)
        .eq('is_active', true)
        .order('type')
        .order('name');
      if (itemsError) throw itemsError;

      const itemIds = (items ?? []).map((item) => item.id);
      if (itemIds.length === 0) {
        return { items: [] as AreaItem[], variants: [] as AreaVariant[] };
      }
      const { data: variants, error: variantsError } = await supabase
        .from('company_item_variants')
        .select('*')
        .eq('company_id', companyId!)
        .eq('pricing_basis', 'AREA')
        .eq('is_active', true)
        .in('company_item_id', itemIds)
        .order('created_at');
      if (variantsError) throw variantsError;
      return {
        items: (items ?? []) as AreaItem[],
        variants: (variants ?? []) as AreaVariant[],
      };
    },
  });

  const catalogsQuery = useQuery({
    queryKey: ['phase4a-area-pricing-catalogs'],
    queryFn: async (): Promise<Catalogs> => {
      const [types, colors, thicknesses, aluminumColors] = await Promise.all([
        supabase
          .from('glass_types')
          .select('slug,name')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('admin_glass_colors')
          .select('slug,name')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('admin_glass_thicknesses')
          .select('thickness_mm,label')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('admin_aluminum_colors')
          .select('slug,name')
          .eq('is_active', true)
          .order('sort_order'),
      ]);
      const error = types.error ?? colors.error ?? thicknesses.error ?? aluminumColors.error;
      if (error) throw error;
      return {
        glass_types: uniqueOptions((types.data ?? []).map((row) => ({
          value: row.slug.toUpperCase().replace(/^VIDRO_/, ''),
          label: row.name,
        }))),
        admin_glass_colors: (colors.data ?? []).map((row) => ({
          value: row.slug.toUpperCase(),
          label: row.name,
        })),
        admin_glass_thicknesses: (thicknesses.data ?? []).map((row) => ({
          value: String(row.thickness_mm),
          label: row.label,
        })),
        admin_aluminum_colors: (aluminumColors.data ?? []).map((row) => ({
          value: row.slug.toUpperCase(),
          label: row.name,
        })),
      };
    },
    staleTime: 5 * 60_000,
  });

  const items = useMemo(
    () => pricingQuery.data?.items ?? [],
    [pricingQuery.data?.items],
  );
  const variants = useMemo(
    () => pricingQuery.data?.variants ?? [],
    [pricingQuery.data?.variants],
  );
  const catalogs = catalogsQuery.data ?? {};
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.type))).sort(),
    [items],
  );
  const selectedCategory = categories.includes(activeCategory)
    ? activeCategory
    : categories[0] ?? '';
  const variantsByItem = useMemo(() => {
    const map = new Map<string, AreaVariant[]>();
    for (const variant of variants) {
      const current = map.get(variant.company_item_id) ?? [];
      current.push(variant);
      map.set(variant.company_item_id, current);
    }
    return map;
  }, [variants]);

  const missingCost = variants.filter((variant) => variant.cost == null).length;
  const missingPrice = variants.filter((variant) => variant.sale_price == null).length;
  const mayEdit = (canEdit('estoque') || canEdit('produtos'))
    && canSeeCosts()
    && canSeePrices();

  const closeEditor = () => setEditor(null);
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['phase4a-area-pricing', companyId] });
  };

  if (!companyId) {
    return (
      <MainLayout>
        <div className="p-6">Selecione uma empresa.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold">Meus Preços</h1>
          <p className="text-sm text-muted-foreground">
            Materiais precificados por área, com custo e venda por m².
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Materiais por área" value={String(items.length)} ok={items.length > 0} />
          <Metric label="Variantes" value={String(variants.length)} ok={variants.length > 0} />
          <Metric label="Sem custo" value={String(missingCost)} ok={missingCost === 0} />
          <Metric label="Sem preço" value={String(missingPrice)} ok={missingPrice === 0} />
        </div>

        <Card>
          <CardContent className="flex gap-3 p-4 text-sm">
            <Layers3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Uma fonte empresarial por combinação</p>
              <p className="text-muted-foreground">
                Material + tipo + cor + espessura + acabamento definem uma variante.
                Os valores pertencem somente à empresa selecionada. Perfis, papéis técnicos
                e acessórios são tratados fora desta tela.
              </p>
            </div>
          </CardContent>
        </Card>

        {pricingQuery.isLoading || catalogsQuery.isLoading ? (
          <Loading />
        ) : pricingQuery.error || catalogsQuery.error ? (
          <ErrorState
            message={operationalErrorMessage(
              pricingQuery.error ?? catalogsQuery.error,
              'Não foi possível carregar os preços.',
            )}
          />
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum material com base de precificação AREA está ativo nesta empresa.
            </CardContent>
          </Card>
        ) : (
          <Tabs value={selectedCategory} onValueChange={setActiveCategory}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="shrink-0">
                  {categoryLabel(category)}
                </TabsTrigger>
              ))}
            </TabsList>
            {categories.map((category) => (
              <TabsContent key={category} value={category} className="space-y-4">
                {items
                  .filter((item) => item.type === category)
                  .map((item) => (
                    <AreaMaterialCard
                      key={item.id}
                      item={item}
                      variants={variantsByItem.get(item.id) ?? []}
                      catalogs={catalogs}
                      canSeeCosts={canSeeCosts()}
                      canSeePrices={canSeePrices()}
                      mayEdit={mayEdit}
                      onAdd={() => setEditor({ item, variant: null })}
                      onEdit={(variant) => setEditor({ item, variant })}
                    />
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {editor ? (
        <AreaPriceDialog
          key={editor.variant?.id ?? `new-${editor.item.id}`}
          editor={editor}
          catalogs={catalogs}
          onClose={closeEditor}
          onSaved={invalidate}
        />
      ) : null}
    </MainLayout>
  );
}

function Metric({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        {ok ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        )}
      </CardContent>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex justify-center p-10">
      <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex gap-2 p-5 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        {message}
      </CardContent>
    </Card>
  );
}

function AreaMaterialCard({
  item,
  variants,
  catalogs,
  canSeeCosts,
  canSeePrices,
  mayEdit,
  onAdd,
  onEdit,
}: {
  item: AreaItem;
  variants: AreaVariant[];
  catalogs: Catalogs;
  canSeeCosts: boolean;
  canSeePrices: boolean;
  mayEdit: boolean;
  onAdd: () => void;
  onEdit: (variant: AreaVariant) => void;
}) {
  const schema = parseAttributeSchema(item.variant_attribute_schema);
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">{item.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {categoryLabel(item.type)} · preço por {item.pricing_unit ?? 'm²'}
          </p>
        </div>
        {mayEdit ? (
          <Button onClick={onAdd} size="sm" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Nova variante
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma variante com preço configurado.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {variants.map((variant) => {
              const metrics = priceMetrics(variant);
              return (
                <div key={variant.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {attributeLabel(variant.attributes, schema, catalogs)}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {variant.pricing_basis}
                      </Badge>
                    </div>
                    {mayEdit ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Editar preço da variante"
                        onClick={() => onEdit(variant)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    {canSeeCosts ? (
                      <PriceValue
                        label="Custo/m²"
                        value={metrics.cost}
                        missing="Sem custo"
                      />
                    ) : null}
                    {canSeePrices ? (
                      <PriceValue
                        label="Venda/m²"
                        value={metrics.sale}
                        missing="Sem preço"
                      />
                    ) : null}
                    {canSeeCosts && canSeePrices ? (
                      <>
                        <PriceValue label="Lucro/m²" value={metrics.profit} missing="—" />
                        <div>
                          <p className="text-xs text-muted-foreground">Margem</p>
                          <p className="font-semibold">
                            {metrics.margin == null ? '—' : `${metrics.margin.toFixed(2)}%`}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                  {canSeePrices ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Markup sobre custo:{' '}
                      {variant.markup_percent == null
                        ? 'indisponível sem custo'
                        : `${Number(variant.markup_percent).toFixed(2)}%`}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriceValue({
  label,
  value,
  missing,
}: {
  label: string;
  value: number | null;
  missing: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value == null ? missing : brl.format(value)}</p>
    </div>
  );
}

function AreaPriceDialog({
  editor,
  catalogs,
  onClose,
  onSaved,
}: {
  editor: EditorState;
  catalogs: Catalogs;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const schema = parseAttributeSchema(editor.item.variant_attribute_schema);
  const existingAttributes =
    editor.variant?.attributes
    && typeof editor.variant.attributes === 'object'
    && !Array.isArray(editor.variant.attributes)
      ? editor.variant.attributes as Record<string, Json | undefined>
      : {};
  const [attributes, setAttributes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      schema.map((definition) => [
        definition.key,
        existingAttributes[definition.key] == null
          ? ''
          : String(existingAttributes[definition.key]),
      ]),
    ),
  );
  const [cost, setCost] = useState(
    editor.variant?.cost == null ? '' : String(editor.variant.cost),
  );
  const [basis, setBasis] = useState<'MARKUP' | 'SALE_PRICE'>('MARKUP');
  const [value, setValue] = useState(
    editor.variant?.markup_percent == null
      ? ''
      : String(editor.variant.markup_percent),
  );

  const costNumber = parseNumber(cost);
  const valueNumber = parseNumber(value);
  const sale = costNumber != null && valueNumber != null
    ? basis === 'MARKUP'
      ? costNumber * (1 + valueNumber / 100)
      : valueNumber
    : null;
  const markup = costNumber != null && costNumber > 0 && sale != null
    ? ((sale / costNumber) - 1) * 100
    : null;
  const profit = costNumber != null && sale != null ? sale - costNumber : null;
  const margin = profit != null && sale != null && sale > 0
    ? (profit / sale) * 100
    : null;
  const missingRequired = !editor.variant && schema.some(
    (definition) => definition.required && !attributes[definition.key]?.trim(),
  );
  const invalidPricing = costNumber == null
    || costNumber <= 0
    || valueNumber == null
    || (basis === 'MARKUP' ? valueNumber < 0 : valueNumber <= 0)
    || (sale != null && sale < costNumber);

  const save = useMutation({
    mutationFn: async () => {
      if (missingRequired) {
        throw new Error('Preencha todos os atributos obrigatórios.');
      }
      if (invalidPricing) {
        throw new Error('Informe custo e preço/markup válidos.');
      }
      const payload = Object.fromEntries(
        Object.entries(attributes)
          .filter(([, attributeValue]) => attributeValue.trim() !== '')
          .map(([key, attributeValue]) => [
            key,
            key === 'thickness_mm' ? Number(attributeValue) : attributeValue,
          ]),
      );
      const { error } = await supabase.rpc('save_company_item_variant', {
        _company_id: editor.item.company_id,
        _company_item_id: editor.item.id,
        _variant_type: editor.variant?.variant_type ?? editor.item.type.toUpperCase(),
        _attributes: payload,
        _cost: costNumber!,
        _basis: basis,
        _value: valueNumber!,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await onSaved();
      toast.success('Preço por área salvo.');
      onClose();
    },
    onError: (error) => {
      toast.error(operationalErrorMessage(error, 'Não foi possível salvar o preço.'));
    },
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editor.variant ? 'Editar variante' : 'Nova variante'} · {editor.item.name}
          </DialogTitle>
          <DialogDescription>
            A combinação de atributos identifica este preço por m².
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {schema.map((definition) => (
            <AttributeField
              key={definition.key}
              definition={definition}
              value={attributes[definition.key] ?? ''}
              options={definition.catalog ? catalogs[definition.catalog] ?? [] : []}
              disabled={!!editor.variant}
              onChange={(next) => {
                setAttributes((current) => ({ ...current, [definition.key]: next }));
              }}
            />
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Custo/m²">
              <Input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </Field>
            <Field label="Editar por">
              <Select
                value={basis}
                onValueChange={(next) => {
                  setBasis(next as typeof basis);
                  setValue('');
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKUP">Markup sobre custo</SelectItem>
                  <SelectItem value="SALE_PRICE">Preço de venda</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={basis === 'MARKUP' ? 'Markup (%)' : 'Venda/m²'}>
            <Input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-4 text-sm">
            <PreviewValue label="Venda/m²" value={sale} currency />
            <PreviewValue label="Markup" value={markup} suffix="%" />
            <PreviewValue label="Lucro/m²" value={profit} currency />
            <PreviewValue label="Margem sobre venda" value={margin} suffix="%" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={missingRequired || invalidPricing || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttributeField({
  definition,
  value,
  options,
  disabled,
  onChange,
}: {
  definition: AttributeDefinition;
  value: string;
  options: CatalogOption[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const label = `${definition.label}${definition.required ? ' *' : ''}`;
  if (definition.kind === 'select') {
    return (
      <Field label={label}>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <Input
        value={value}
        disabled={disabled}
        type={definition.kind === 'number' ? 'number' : 'text'}
        inputMode={definition.kind === 'number' ? 'decimal' : undefined}
        min={definition.kind === 'number' ? '0' : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PreviewValue({
  label,
  value,
  currency = false,
  suffix = '',
}: {
  label: string;
  value: number | null;
  currency?: boolean;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">
        {value == null
          ? 'Indisponível'
          : currency
            ? brl.format(value)
            : `${value.toFixed(2)}${suffix}`}
      </p>
    </div>
  );
}
