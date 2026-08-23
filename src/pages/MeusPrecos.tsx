import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { StockPricingRow, useStockPricing } from '@/hooks/useStockPricing';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

type Variant = Database['public']['Tables']['company_item_variants']['Row'];
type Product = Pick<Database['public']['Tables']['company_products']['Row'], 'id' | 'commercial_name' | 'pricing_type' | 'price_per_sqm'>;
type ProductSnapshot = {
  totals: { cost: number; sale_price: number; profit: number; margin_percent: number | null };
  warnings: Array<{ code: string; item_name?: string }>;
  materials: Array<{ company_item_id: string; item_name: string; material_type: string; quantity: number; unit: string; unit_cost: number; unit_sale_price: number; cost: number; sale_price: number }>;
};
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (value: string) => { const parsed = Number(value.replace(',', '.')); return Number.isFinite(parsed) ? parsed : null; };

export default function MeusPrecos() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const { canEdit, canSeeCosts, canSeePrices } = usePermissions();
  const itemsQuery = useStockPricing();
  const [priceItem, setPriceItem] = useState<StockPricingRow | null>(null);
  const [variantItem, setVariantItem] = useState<StockPricingRow | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const stockQuery = useQuery({
    queryKey: ['phase3e-stock', companyId], enabled: !!companyId,
    queryFn: async () => { const { data, error } = await supabase.from('company_stock').select('company_item_id,quantity').eq('company_id', companyId!); if (error) throw error; return data; },
  });
  const reservationQuery = useQuery({
    queryKey: ['phase3e-reservations', companyId], enabled: !!companyId,
    queryFn: async () => { const { data, error } = await supabase.from('stock_reservations').select('company_item_id,quantity_reserved').eq('company_id', companyId!).eq('status', 'reserved'); if (error) throw error; return data; },
  });
  const variantQuery = useQuery({
    queryKey: ['phase3e-variants', companyId], enabled: !!companyId,
    queryFn: async () => { const { data, error } = await supabase.from('company_item_variants').select('*').eq('company_id', companyId!).eq('is_active', true); if (error) throw error; return data; },
  });
  const productQuery = useQuery({
    queryKey: ['phase3e-products', companyId], enabled: !!companyId,
    queryFn: async () => { const { data, error } = await supabase.from('company_products').select('id,commercial_name,pricing_type,price_per_sqm').eq('company_id', companyId!).eq('is_active', true).order('commercial_name'); if (error) throw error; return data as Product[]; },
  });

  const stock = useMemo(() => new Map((stockQuery.data ?? []).map(row => [row.company_item_id, Number(row.quantity)])), [stockQuery.data]);
  const reserved = useMemo(() => { const map = new Map<string, number>(); for (const row of reservationQuery.data ?? []) map.set(row.company_item_id, (map.get(row.company_item_id) ?? 0) + Number(row.quantity_reserved)); return map; }, [reservationQuery.data]);
  const variantCount = useMemo(() => { const map = new Map<string, number>(); for (const row of variantQuery.data ?? []) map.set(row.company_item_id, (map.get(row.company_item_id) ?? 0) + 1); return map; }, [variantQuery.data]);
  const items = itemsQuery.data ?? [];
  const missingCost = items.filter(row => !row.cost || row.cost <= 0).length;
  const missingPrice = items.filter(row => !row.sale_price || row.sale_price <= 0).length;
  const incomplete = items.filter(row => !row.cost || row.cost <= 0 || !row.sale_price || row.sale_price <= 0).length;
  const mayEdit = canEdit('estoque') || canEdit('produtos');

  if (!companyId) return <MainLayout><div className="p-6">Selecione uma empresa.</div></MainLayout>;
  return <MainLayout><div className="mx-auto max-w-7xl space-y-6 p-6">
    <div><h1 className="text-2xl font-bold">Meus Preços</h1><p className="text-sm text-muted-foreground">Central canônica: itens empresariais, variações e produtos sem fallback legado.</p></div>
    <div className="grid gap-3 md:grid-cols-4"><Metric label="Itens prontos" value={`${items.length - incomplete}/${items.length}`} ok={!incomplete} /><Metric label="Sem custo" value={String(missingCost)} ok={!missingCost} /><Metric label="Sem preço" value={String(missingPrice)} ok={!missingPrice} /><Metric label="Variações" value={String(variantQuery.data?.length ?? 0)} ok={(variantQuery.data?.length ?? 0) > 0} /></div>
    <Tabs defaultValue="materials"><TabsList><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="materials">Materiais</TabsTrigger><TabsTrigger value="products">Produtos</TabsTrigger></TabsList>
      <TabsContent value="overview"><Card><CardContent className="space-y-3 p-5 text-sm"><p><strong>Fonte única:</strong> <code>company_items</code> para custo, markup e venda; <code>company_item_variants</code> para vidro/perfil.</p><p>Markup é calculado sobre custo. Margem é lucro dividido pela venda.</p>{(missingCost > 0 || missingPrice > 0) && <div className="flex gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900"><AlertTriangle className="h-5 w-5" />Itens incompletos bloqueiam o preço definitivo, mas estoque zero gera somente aviso.</div>}</CardContent></Card></TabsContent>
      <TabsContent value="materials"><Card><CardHeader><CardTitle>Materiais</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">{itemsQuery.isLoading ? <Loading /> : <table className="w-full text-sm"><thead className="border-y bg-muted/40 text-left"><tr><th className="p-3">Item</th><th className="p-3">Unidade</th>{canSeeCosts() && <th className="p-3">Custo</th>}{canSeePrices() && <><th className="p-3">Markup</th><th className="p-3">Venda</th></>}{canSeeCosts() && canSeePrices() && <><th className="p-3">Lucro</th><th className="p-3">Margem</th></>}<th className="p-3">Estoque</th><th className="p-3">Variações</th><th /></tr></thead><tbody>{items.map(item => {
        const physical = stock.get(item.id) ?? 0; const held = reserved.get(item.id) ?? 0; const cost = Number(item.cost ?? 0); const sale = Number(item.sale_price ?? 0); const profit = sale - cost; const margin = sale > 0 ? profit / sale * 100 : null;
        const variants = (variantQuery.data ?? []).filter(row => row.company_item_id === item.id);
        return <tr key={item.id} className="border-b"><td className="p-3"><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.type} · {item.linha ?? 'sem linha'}</div></td><td className="p-3">{item.pricing_unit ?? item.unit}</td>{canSeeCosts() && <td className="p-3">{cost > 0 ? brl.format(cost) : <Missing text="Sem custo" />}</td>}{canSeePrices() && <><td className="p-3">{item.markup_percent == null ? '—' : `${Number(item.markup_percent).toFixed(2)}%`}</td><td className="p-3">{sale > 0 ? brl.format(sale) : <Missing text="Sem preço" />}</td></>}{canSeeCosts() && canSeePrices() && <><td className="p-3">{cost > 0 && sale > 0 ? brl.format(profit) : '—'}</td><td className="p-3">{margin == null ? '—' : `${margin.toFixed(2)}%`}</td></>}<td className="p-3 whitespace-nowrap">Físico {physical}<div className="text-xs text-muted-foreground">Reservado {held} · Disponível {physical - held}</div></td><td className="p-3"><Badge variant="outline">{variants.length}</Badge>{variants.slice(0, 2).map(row => <div key={row.id} className="mt-1 text-[10px] text-muted-foreground">{row.variant_type === 'GLASS' ? `${row.glass_type ?? ''} ${row.glass_color ?? ''} ${row.glass_thickness_mm ?? ''}mm` : `${row.profile_color ?? ''} ${row.profile_finish ?? ''}`}</div>)}</td><td className="p-3"><div className="flex justify-end">{mayEdit && <><Button size="icon" variant="ghost" onClick={() => setPriceItem(item)} title="Editar preço"><Pencil className="h-4 w-4" /></Button>{['glass', 'profile'].includes(item.type.toLowerCase()) && <Button size="icon" variant="ghost" onClick={() => setVariantItem(item)} title="Adicionar ou atualizar variação"><Plus className="h-4 w-4" /></Button>}</>}</div></td></tr>;
      })}</tbody></table>}</CardContent></Card></TabsContent>
      <TabsContent value="products"><Card><CardHeader><CardTitle>Produtos</CardTitle></CardHeader><CardContent className="space-y-2">{productQuery.isLoading ? <Loading /> : productQuery.data?.map(row => <ProductPricingRow key={row.id} product={row} companyId={companyId} mayEdit={mayEdit} showCost={canSeeCosts()} showPrice={canSeePrices()} onEdit={() => setProduct(row)} />)}</CardContent></Card></TabsContent>
    </Tabs>
  </div><PricingDialog item={priceItem} companyId={companyId} onClose={() => setPriceItem(null)} /><VariantDialog item={variantItem} companyId={companyId} onClose={() => setVariantItem(null)} /><ProductDialog product={product} companyId={companyId} onClose={() => setProduct(null)} /></MainLayout>;
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div>{ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}</CardContent></Card>; }
function Missing({ text }: { text: string }) { return <Badge variant="destructive">{text}</Badge>; }
function Loading() { return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>; }

function ProductPricingRow({ product, companyId, mayEdit, showCost, showPrice, onEdit }: { product: Product; companyId: string; mayEdit: boolean; showCost: boolean; showPrice: boolean; onEdit: () => void }) {
  const [width, setWidth] = useState('1000');
  const [height, setHeight] = useState('1000');
  const [glassType, setGlassType] = useState('');
  const [glassColor, setGlassColor] = useState('');
  const [glassThickness, setGlassThickness] = useState('');
  const [profileColor, setProfileColor] = useState('');
  const [profileFinish, setProfileFinish] = useState('');
  const composition = useQuery({
    queryKey: ['phase3e-product-items', product.id],
    queryFn: async () => { const { data, error } = await supabase.from('company_product_items').select('company_item_id').eq('company_product_id', product.id); if (error) throw error; return (data ?? []).map(row => row.company_item_id).filter((id): id is string => !!id); },
  });
  const variants = useQuery({
    queryKey: ['phase3e-product-simulator-variants', companyId, composition.data], enabled: !!composition.data?.length,
    queryFn: async () => { const { data, error } = await supabase.from('company_item_variants').select('*').eq('company_id', companyId).eq('is_active', true).in('company_item_id', composition.data!); if (error) throw error; return data as Variant[]; },
  });
  const rows = variants.data ?? [];
  const values = (selector: (row: Variant) => string | number | null) => Array.from(new Set(rows.map(selector).filter((value): value is string | number => value != null && value !== ''))).map(String).sort();
  const glassTypes = values(row => row.variant_type === 'GLASS' ? row.glass_type : null);
  const glassColors = values(row => row.variant_type === 'GLASS' ? row.glass_color : null);
  const glassThicknesses = values(row => row.variant_type === 'GLASS' ? row.glass_thickness_mm : null).sort((a, b) => Number(a) - Number(b));
  const profileColors = values(row => row.variant_type === 'PROFILE' ? row.profile_color : null);
  const profileFinishes = values(row => row.variant_type === 'PROFILE' ? row.profile_finish : null);
  const variantPayload = { glass_type: glassType || null, glass_color: glassColor || null, glass_thickness_mm: glassThickness ? Number(glassThickness) : null, profile_color: profileColor || null, profile_finish: profileFinish || null };
  const pricing = useQuery({
    queryKey: ['phase3e-product-preview', companyId, product.id, width, height, variantPayload], retry: false,
    queryFn: async () => { const { data, error } = await supabase.rpc('resolve_company_product_pricing', { _company_id: companyId, _company_product_id: product.id, _width_mm: Number(width), _height_mm: Number(height), _quantity: 1, _variants: variantPayload }); if (error) throw error; return data as unknown as ProductSnapshot; },
    enabled: Number(width) > 0 && Number(height) > 0,
  });
  const totals = pricing.data?.totals;
  return <div className="rounded border p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{product.commercial_name}</div><div className="text-xs text-muted-foreground">Simulador comercial · não cria orçamento</div></div><div className="flex gap-2"><Badge>{product.pricing_type}</Badge>{mayEdit && <Button size="sm" variant="outline" onClick={onEdit}>Configurar</Button>}</div></div>
    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-7"><Field label="Largura (mm)"><Input type="number" value={width} onChange={event => setWidth(event.target.value)} /></Field><Field label="Altura (mm)"><Input type="number" value={height} onChange={event => setHeight(event.target.value)} /></Field>{glassTypes.length > 0 && <Choice label="Tipo vidro" value={glassType} options={glassTypes} onChange={setGlassType} />}{glassColors.length > 0 && <Choice label="Cor vidro" value={glassColor} options={glassColors} onChange={setGlassColor} />}{glassThicknesses.length > 0 && <Choice label="Espessura" value={glassThickness} options={glassThicknesses} onChange={setGlassThickness} />}{profileColors.length > 0 && <Choice label="Cor perfil" value={profileColor} options={profileColors} onChange={setProfileColor} />}{profileFinishes.length > 0 && <Choice label="Acabamento" value={profileFinish} options={profileFinishes} onChange={setProfileFinish} />}</div>
    {pricing.isLoading ? <div className="mt-2 text-xs text-muted-foreground">Calculando prontidão…</div> : pricing.error ? <div className="mt-2 flex items-center gap-2 text-xs text-amber-700"><AlertTriangle className="h-4 w-4" />Incompleto: {(pricing.error as Error).message}</div> : totals && <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{showCost && <div>Custo <strong className="block">{brl.format(totals.cost)}</strong></div>}{showPrice && <div>Venda <strong className="block">{brl.format(totals.sale_price)}</strong></div>}{showCost && showPrice && <><div>Lucro <strong className="block">{brl.format(totals.profit)}</strong></div><div>Margem <strong className="block">{totals.margin_percent == null ? '—' : `${totals.margin_percent.toFixed(2)}%`}</strong></div></>}</div>}
    {pricing.data?.materials?.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-1">Composição</th><th>Qtd.</th>{showCost && <th>Custo</th>}{showPrice && <th>Venda</th>}</tr></thead><tbody>{pricing.data.materials.map(material => <tr key={material.company_item_id} className="border-b last:border-0"><td className="py-1">{material.item_name}<span className="ml-1 text-muted-foreground">({material.material_type})</span></td><td>{material.quantity} {material.unit}</td>{showCost && <td>{brl.format(material.cost)}</td>}{showPrice && <td>{brl.format(material.sale_price)}</td>}</tr>)}</tbody></table></div> : null}
  </div>;
}
function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <Field label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></Field>; }

function PricingDialog({ item, companyId, onClose }: { item: StockPricingRow | null; companyId: string; onClose: () => void }) {
  const qc = useQueryClient(); const [cost, setCost] = useState(''); const [basis, setBasis] = useState<'MARKUP' | 'SALE_PRICE'>('MARKUP'); const [value, setValue] = useState(''); const [unit, setUnit] = useState('');
  const load = () => { setCost(item?.cost?.toString() ?? ''); setBasis('MARKUP'); setValue(item?.markup_percent?.toString() ?? ''); setUnit(item?.pricing_unit ?? item?.unit ?? 'un'); };
  const save = useMutation({ mutationFn: async () => { const c = num(cost); const v = num(value); if (!item || !c || v == null) throw new Error('Informe custo e valor válidos.'); const { error } = await supabase.rpc('save_company_item_pricing', { _company_id: companyId, _company_item_id: item.id, _cost: c, _basis: basis, _value: v, _pricing_unit: unit }); if (error) throw error; }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['stock-pricing'] }); toast.success('Precificação salva.'); onClose(); }, onError: (error: Error) => toast.error(error.message) });
  const c = num(cost) ?? 0; const v = num(value) ?? 0; const sale = basis === 'MARKUP' ? c * (1 + v / 100) : v; const markup = basis === 'SALE_PRICE' && c > 0 ? (sale / c - 1) * 100 : v; const margin = sale > 0 ? (sale - c) / sale * 100 : 0;
  return <Dialog open={!!item} onOpenChange={open => !open && onClose()}><DialogContent onOpenAutoFocus={load}><DialogHeader><DialogTitle>Precificar {item?.name}</DialogTitle></DialogHeader><div className="grid gap-3"><Field label="Custo"><Input type="number" value={cost} onChange={e => setCost(e.target.value)} /></Field><Field label="Editar por"><Select value={basis} onValueChange={next => { setBasis(next as typeof basis); setValue(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MARKUP">Markup sobre custo</SelectItem><SelectItem value="SALE_PRICE">Preço de venda</SelectItem></SelectContent></Select></Field><Field label={basis === 'MARKUP' ? 'Markup (%)' : 'Preço de venda'}><Input type="number" value={value} onChange={e => setValue(e.target.value)} /></Field><Field label="Unidade de precificação"><Input value={unit} onChange={e => setUnit(e.target.value)} /></Field><div className="rounded bg-muted p-3 text-sm">Venda <strong>{brl.format(sale)}</strong> · Markup {markup.toFixed(2)}% · Lucro {brl.format(sale - c)} · Margem {margin.toFixed(2)}%</div></div><DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button></DialogFooter></DialogContent></Dialog>;
}

function VariantDialog({ item, companyId, onClose }: { item: StockPricingRow | null; companyId: string; onClose: () => void }) {
  const qc = useQueryClient(); const glass = item?.type.toLowerCase() === 'glass'; const [color, setColor] = useState(''); const [detail, setDetail] = useState(''); const [thickness, setThickness] = useState(''); const [cost, setCost] = useState(''); const [markup, setMarkup] = useState('');
  const save = useMutation({ mutationFn: async () => { const c = num(cost); const m = num(markup); if (!item || !c || m == null || !color || (glass && !num(thickness))) throw new Error('Preencha os campos obrigatórios.'); const attributes: Json = glass ? { glass_type: detail || null, glass_color: color, glass_thickness_mm: num(thickness) } : { profile_color: color, profile_finish: detail || null }; const { error } = await supabase.rpc('save_company_item_variant', { _company_id: companyId, _company_item_id: item.id, _variant_type: glass ? 'GLASS' : 'PROFILE', _attributes: attributes, _cost: c, _basis: 'MARKUP', _value: m }); if (error) throw error; }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['phase3e-variants'] }); toast.success('Variação salva.'); onClose(); }, onError: (error: Error) => toast.error(error.message) });
  return <Dialog open={!!item} onOpenChange={open => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>Variação · {item?.name}</DialogTitle></DialogHeader><div className="grid gap-3"><Field label={glass ? 'Cor do vidro' : 'Cor do perfil'}><Input value={color} onChange={e => setColor(e.target.value)} /></Field>{glass && <Field label="Espessura (mm)"><Input type="number" value={thickness} onChange={e => setThickness(e.target.value)} /></Field>}<Field label={glass ? 'Tipo do vidro (opcional)' : 'Acabamento (opcional)'}><Input value={detail} onChange={e => setDetail(e.target.value)} /></Field><Field label="Custo"><Input type="number" value={cost} onChange={e => setCost(e.target.value)} /></Field><Field label="Markup (%)"><Input type="number" value={markup} onChange={e => setMarkup(e.target.value)} /></Field></div><DialogFooter><Button onClick={() => save.mutate()}>Salvar variação</Button></DialogFooter></DialogContent></Dialog>;
}

function ProductDialog({ product, companyId, onClose }: { product: Product | null; companyId: string; onClose: () => void }) {
  const qc = useQueryClient(); const [mode, setMode] = useState<'COMPOSITION' | 'FIXED_PER_SQM'>('COMPOSITION'); const [price, setPrice] = useState(''); const load = () => { setMode(product?.pricing_type === 'FIXED_PER_SQM' ? 'FIXED_PER_SQM' : 'COMPOSITION'); setPrice(product?.price_per_sqm?.toString() ?? ''); };
  const save = useMutation({ mutationFn: async () => { if (!product) return; const fixed = mode === 'FIXED_PER_SQM' ? num(price) : undefined; const { error } = await supabase.rpc('save_company_product_pricing', { _company_id: companyId, _company_product_id: product.id, _pricing_type: mode, _fixed_price_per_sqm: fixed }); if (error) throw error; }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['phase3e-products'] }); toast.success('Método salvo.'); onClose(); }, onError: (error: Error) => toast.error(error.message) });
  return <Dialog open={!!product} onOpenChange={open => !open && onClose()}><DialogContent onOpenAutoFocus={load}><DialogHeader><DialogTitle>Método · {product?.commercial_name}</DialogTitle></DialogHeader><div className="grid gap-3"><Field label="Método comercial"><Select value={mode} onValueChange={next => setMode(next as typeof mode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COMPOSITION">Por composição</SelectItem><SelectItem value="FIXED_PER_SQM">Preço fixo por m²</SelectItem></SelectContent></Select></Field>{mode === 'FIXED_PER_SQM' && <Field label="Preço de venda por m²"><Input type="number" value={price} onChange={e => setPrice(e.target.value)} /><p className="text-xs text-muted-foreground">O custo continua vindo da composição.</p></Field>}</div><DialogFooter><Button onClick={() => save.mutate()}>Salvar</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label>{children}</div>; }
