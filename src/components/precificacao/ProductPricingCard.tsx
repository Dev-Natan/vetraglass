import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronDown, ChevronUp, Save, Ruler, Weight, DollarSign,
  TrendingUp, Package, Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export interface CompositionItem {
  id: string;
  itemName: string;
  itemType: string;
  unit: string;
  imageUrl: string | null;
  quantityFormula: string;
  widthFormula: string | null;
  heightFormula: string | null;
  piecesQuantity: number;
  cutAngle: number | null;
  barLengthMm: number;
  weightKg: number;
  weightPerMeter: number;
  costPerBar: number;
  costPerKg: number;
  costPerMeter: number;
  salePricePerBar: number;
  salePricePerKg: number;
  salePricePerMeter: number;
  companyItemId: string | null;
  templateItemId: string | null;
}

interface ProductPricingCardProps {
  product: {
    id: string;
    commercial_name: string;
    linha: string | null;
    category: string | null;
    image_url: string | null;
    cost_per_sqm: number | null;
    price_per_sqm: number | null;
    margin_percent: number | null;
  };
  compositionItems: CompositionItem[];
  onSaved?: () => void;
}

const typeLabels: Record<string, string> = {
  profile: 'Perfis de Alumínio',
  glass: 'Vidros',
  accessory: 'Acessórios',
  component: 'Componentes',
  service: 'Serviços',
};

const typeIcons: Record<string, string> = {
  profile: '🔩', glass: '🪟', accessory: '⚙️', component: '🧩', service: '🔧',
};

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

const unitOptions = [
  { value: 'barra', label: 'Barra' },
  { value: 'metro', label: 'Metro (m)' },
  { value: 'kg', label: 'Quilo (kg)' },
  { value: 'm2', label: 'Metro² (m²)' },
  { value: 'un', label: 'Unidade (un)' },
  { value: 'pc', label: 'Peça (pç)' },
];

export function ProductPricingCard({ product, compositionItems, onSaved }: ProductPricingCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1200);
  const [marginPercent, setMarginPercent] = useState(product.margin_percent ?? 30);
  const [saving, setSaving] = useState(false);
  const [itemOverrides, setItemOverrides] = useState<Record<string, Partial<CompositionItem & { salePrice: number }>>>({});

  const getItem = useCallback((item: CompositionItem) => {
    return { ...item, ...(itemOverrides[item.id] || {}) };
  }, [itemOverrides]);

  const updateItemField = useCallback((itemId: string, field: string, value: number | string) => {
    setItemOverrides(prev => {
      const current = prev[itemId] || {};
      const item = compositionItems.find(i => i.id === itemId);
      if (!item) return prev;
      const merged: any = { ...item, ...current, [field]: value };

      // Auto-calc derived fields for profiles
      if (merged.itemType === 'profile' || merged.unit === 'barra' || merged.unit === 'metro') {
        const barLengthM = (merged.barLengthMm || 6000) / 1000;

        if (field === 'weightKg' || field === 'barLengthMm') {
          if (merged.weightKg > 0 && barLengthM > 0) {
            merged.weightPerMeter = merged.weightKg / barLengthM;
          }
        }
        if (['costPerBar', 'weightKg', 'barLengthMm'].includes(field)) {
          if (merged.costPerBar > 0 && merged.weightKg > 0) {
            merged.costPerKg = merged.costPerBar / merged.weightKg;
          }
          if (merged.costPerBar > 0 && barLengthM > 0) {
            merged.costPerMeter = merged.costPerBar / barLengthM;
          }
        }
        if (field === 'costPerKg') {
          if (typeof value === 'number' && value > 0 && merged.weightKg > 0) {
            merged.costPerBar = value * merged.weightKg;
            if (barLengthM > 0) merged.costPerMeter = merged.costPerBar / barLengthM;
          }
        }
        if (field === 'costPerMeter') {
          if (typeof value === 'number' && value > 0 && barLengthM > 0) {
            merged.costPerBar = value * barLengthM;
            if (merged.weightKg > 0) merged.costPerKg = merged.costPerBar / merged.weightKg;
          }
        }

        // Auto sale prices
        const mult = 1 + (marginPercent / 100);
        if (merged.costPerBar > 0) merged.salePricePerBar = merged.costPerBar * mult;
        if (merged.costPerKg > 0) merged.salePricePerKg = merged.costPerKg * mult;
        if (merged.costPerMeter > 0) merged.salePricePerMeter = merged.costPerMeter * mult;
      }

      return { ...prev, [itemId]: merged };
    });
  }, [compositionItems, marginPercent]);

  // Calculate component costs for simulation
  const calculatedItems = useMemo(() => {
    return compositionItems.map(raw => {
      const item = getItem(raw);
      const piecesQty = item.piecesQuantity || 1;

      if (item.itemType === 'glass') {
        const calcW = evaluateFormula(item.widthFormula || 'Largura', width, height);
        const calcH = evaluateFormula(item.heightFormula || 'Altura', width, height);
        const areaM2 = (calcW * calcH) / 1_000_000;
        const totalCost = (item.costPerMeter || 0) * areaM2 * piecesQty;
        const saleTotal = (item.salePricePerMeter || 0) * areaM2 * piecesQty;
        return { ...item, totalCost, saleTotal, displayMeasure: `${calcW.toFixed(0)} x ${calcH.toFixed(0)} mm`, calcValue: areaM2 };
      } else if (item.itemType === 'profile') {
        const length = item.heightFormula
          ? evaluateFormula(item.heightFormula, width, height)
          : item.widthFormula
            ? evaluateFormula(item.widthFormula, width, height)
            : width;
        const lengthM = length / 1000;
        const costPerMeter = item.barLengthMm > 0 ? item.costPerBar / (item.barLengthMm / 1000) : item.costPerMeter;
        const salePricePerMeter = item.barLengthMm > 0 ? item.salePricePerBar / (item.barLengthMm / 1000) : item.salePricePerMeter;
        const totalCost = costPerMeter * lengthM * piecesQty;
        const saleTotal = salePricePerMeter * lengthM * piecesQty;
        return { ...item, totalCost, saleTotal, displayMeasure: `${length.toFixed(0)} mm`, calcValue: length };
      } else {
        const totalCost = (item.costPerBar || item.costPerMeter || 0) * piecesQty;
        const saleTotal = (item.salePricePerBar || item.salePricePerMeter || 0) * piecesQty;
        return { ...item, totalCost, saleTotal, displayMeasure: `${piecesQty} un`, calcValue: piecesQty };
      }
    });
  }, [compositionItems, itemOverrides, width, height, getItem]);

  const totalCost = calculatedItems.reduce((s, c) => s + c.totalCost, 0);
  const totalSale = calculatedItems.reduce((s, c) => s + c.saleTotal, 0);
  const areaM2 = (width * height) / 1_000_000;
  const costPerSqm = areaM2 > 0 ? totalCost / areaM2 : 0;
  const pricePerSqm = areaM2 > 0 ? totalSale / areaM2 : 0;
  const profit = totalSale - totalCost;
  const realMargin = totalCost > 0 ? ((totalSale - totalCost) / totalCost) * 100 : 0;

  // Group by type
  const grouped = useMemo(() => {
    const g: Record<string, typeof calculatedItems> = {};
    calculatedItems.forEach(c => {
      if (!g[c.itemType]) g[c.itemType] = [];
      g[c.itemType].push(c);
    });
    return g;
  }, [calculatedItems]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save current product pricing
      const { error: prodError } = await supabase
        .from('company_products')
        .update({
          cost_per_sqm: costPerSqm,
          price_per_sqm: pricePerSqm,
          margin_percent: marginPercent,
        })
        .eq('id', product.id);

      if (prodError) throw prodError;

      // 2. Update each modified company_item (propagates to ALL products using this item)
      const updatedCompanyItemIds: string[] = [];

      for (const [itemId, overrides] of Object.entries(itemOverrides)) {
        const original = compositionItems.find(i => i.id === itemId);
        if (!original?.companyItemId) continue;

        const o = overrides as any;
        const updateData: Record<string, any> = {};
        
        if (o.barLengthMm !== undefined) updateData.bar_length_mm = o.barLengthMm;
        if (o.weightKg !== undefined) updateData.weight_kg = o.weightKg;
        if (o.weightPerMeter !== undefined) updateData.weight_per_meter = o.weightPerMeter;
        if (o.costPerBar !== undefined) updateData.cost = o.costPerBar;
        if (o.costPerKg !== undefined) updateData.cost_per_kg = o.costPerKg;
        if (o.costPerMeter !== undefined) updateData.cost_per_meter = o.costPerMeter;
        if (o.salePricePerBar !== undefined) updateData.sale_price = o.salePricePerBar;
        if (o.salePricePerKg !== undefined) updateData.sale_price_per_kg = o.salePricePerKg;
        if (o.salePricePerMeter !== undefined) updateData.sale_price_per_meter = o.salePricePerMeter;
        if (o.unit !== undefined) updateData.unit = o.unit;

        if (Object.keys(updateData).length === 0) continue;

        const { error: itemError } = await supabase
          .from('company_items')
          .update(updateData)
          .eq('id', original.companyItemId);

        if (itemError) throw itemError;
        updatedCompanyItemIds.push(original.companyItemId);
      }

      // 3. Update company_stock for modified items (sync sale_price)
      for (const companyItemId of updatedCompanyItemIds) {
        await supabase
          .from('company_stock')
          .update({ updated_at: new Date().toISOString() })
          .eq('company_item_id', companyItemId);
      }

      // 4. Find all OTHER products that use the same company_items and invalidate their cache
      if (updatedCompanyItemIds.length > 0) {
        const { data: affectedProducts } = await supabase
          .from('company_product_items')
          .select('company_product_id')
          .in('company_item_id', updatedCompanyItemIds)
          .neq('company_product_id', product.id);

        if (affectedProducts && affectedProducts.length > 0) {
          const uniqueProductIds = [...new Set(affectedProducts.map(p => p.company_product_id))];
          // Touch updated_at on affected products so UI knows they changed
          for (const pid of uniqueProductIds) {
            await supabase
              .from('company_products')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', pid);
          }
          toast.info(`${uniqueProductIds.length} outro(s) produto(s) atualizado(s) automaticamente.`);
        }
      }

      toast.success('Preços salvos com sucesso!');
      onSaved?.();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={cn("transition-all", expanded && "ring-1 ring-primary/30")}>
      {/* Header */}
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {product.image_url ? (
              <div className="w-14 h-14 rounded-lg border bg-background p-1 flex items-center justify-center shrink-0">
                <img src={product.image_url} alt={product.commercial_name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <CardTitle className="text-sm font-semibold">{product.commercial_name}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {product.linha && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{product.linha}</Badge>}
                {product.category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{categoryLabels[product.category] || product.category}</Badge>}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">{compositionItems.length} itens</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-muted-foreground">Custo/m²</span>
                <p className="font-semibold">{formatCurrency(costPerSqm)}</p>
              </div>
              <div className="text-right">
                <span className="text-primary">Venda/m²</span>
                <p className="font-semibold text-primary">{formatCurrency(pricePerSqm)}</p>
              </div>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5 pt-0">
          {/* Simulation controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Largura (mm)
              </Label>
              <Input type="number" min={100} step={10} value={width} onChange={e => setWidth(parseInt(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Altura (mm)
              </Label>
              <Input type="number" min={100} step={10} value={height} onChange={e => setHeight(parseInt(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Margem (%)
              </Label>
              <Input type="number" min={0} step={1} value={marginPercent} onChange={e => setMarginPercent(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Área</Label>
              <div className="h-8 flex items-center text-sm font-medium">{areaM2.toFixed(4)} m²</div>
            </div>
          </div>

          {/* KPI summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="p-2 rounded-md bg-muted/30 text-center">
              <span className="text-[10px] text-muted-foreground">Custo Total</span>
              <p className="text-sm font-bold">{formatCurrency(totalCost)}</p>
            </div>
            <div className="p-2 rounded-md bg-primary/10 text-center">
              <span className="text-[10px] text-primary">Venda Total</span>
              <p className="text-sm font-bold text-primary">{formatCurrency(totalSale)}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/30 text-center">
              <span className="text-[10px] text-muted-foreground">Custo/m²</span>
              <p className="text-sm font-bold">{formatCurrency(costPerSqm)}</p>
            </div>
            <div className="p-2 rounded-md bg-primary/10 text-center">
              <span className="text-[10px] text-primary">Venda/m²</span>
              <p className="text-sm font-bold text-primary">{formatCurrency(pricePerSqm)}</p>
            </div>
            <div className={cn("p-2 rounded-md text-center", profit >= 0 ? "bg-emerald-500/10" : "bg-destructive/10")}>
              <span className="text-[10px] text-muted-foreground">Lucro ({realMargin.toFixed(1)}%)</span>
              <p className={cn("text-sm font-bold", profit >= 0 ? "text-emerald-600" : "text-destructive")}>{formatCurrency(profit)}</p>
            </div>
          </div>

          {/* Components List by Type */}
          {['profile', 'glass', 'accessory', 'component', 'service'].map(type => {
            const items = grouped[type];
            if (!items || items.length === 0) return null;
            const typeCost = items.reduce((s, c) => s + c.totalCost, 0);
            const typeSale = items.reduce((s, c) => s + c.saleTotal, 0);

            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <span>{typeIcons[type]}</span>
                    {typeLabels[type] || type}
                    <Badge variant="secondary" className="text-[9px] ml-1">{items.length}</Badge>
                  </h4>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Custo: {formatCurrency(typeCost)}</span>
                    <span className="text-primary font-medium">Venda: {formatCurrency(typeSale)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {items.map(item => {
                    const merged = getItem(item);
                    return (
                      <div key={item.id} className="border rounded-lg p-3 bg-card space-y-3">
                        {/* Item header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <div className="w-10 h-10 rounded border bg-background p-0.5 flex items-center justify-center shrink-0">
                                <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-contain rounded-sm" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted/60 flex items-center justify-center shrink-0 text-base">
                                {typeIcons[item.itemType] || '📦'}
                              </div>
                            )}
                            <div>
                              <span className="text-sm font-medium">{item.itemName}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {item.cutAngle && <Badge variant="outline" className="text-[9px] py-0">{item.cutAngle}°</Badge>}
                                <Badge variant="secondary" className="text-[9px] py-0">{merged.unit || 'un'}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">{item.displayMeasure}</span>
                            <Badge variant="outline" className="text-[10px]">×{item.piecesQuantity}</Badge>
                          </div>
                        </div>

                        {/* Editable fields grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {/* Unit of measure */}
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Unidade</Label>
                            <Select
                              value={merged.unit || 'un'}
                              onValueChange={v => updateItemField(item.id, 'unit', v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {unitOptions.map(o => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Bar Length / Comprimento */}
                          {(type === 'profile' || merged.unit === 'barra' || merged.unit === 'metro') && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Ruler className="h-3 w-3" /> Comprimento (mm)
                              </Label>
                              <Input
                                type="number" min={0} step={1}
                                value={merged.barLengthMm || ''}
                                onChange={e => updateItemField(item.id, 'barLengthMm', parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs" placeholder="6000"
                              />
                            </div>
                          )}

                          {/* Weight */}
                          {(type === 'profile' || merged.unit === 'kg') && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Weight className="h-3 w-3" /> Peso (kg)
                              </Label>
                              <Input
                                type="number" min={0} step={0.001}
                                value={merged.weightKg || ''}
                                onChange={e => updateItemField(item.id, 'weightKg', parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs" placeholder="0,000"
                              />
                            </div>
                          )}

                          {/* Weight per meter (auto-calculated, read-only) */}
                          {type === 'profile' && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Peso/m (kg)</Label>
                              <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/30 rounded-md px-2">
                                {merged.weightPerMeter > 0 ? merged.weightPerMeter.toFixed(3) : '-'}
                              </div>
                            </div>
                          )}

                          {/* Glass dimensions */}
                          {type === 'glass' && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Largura (fórmula)</Label>
                                <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/30 rounded-md px-2">
                                  {item.widthFormula || 'Largura'}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Altura (fórmula)</Label>
                                <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/30 rounded-md px-2">
                                  {item.heightFormula || 'Altura'}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Pricing fields */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-dashed">
                          {/* Cost per bar / unit */}
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {type === 'profile' ? 'Custo/Barra' : type === 'glass' ? 'Custo/m²' : 'Custo/Un'}
                            </Label>
                            <Input
                              type="number" min={0} step={0.01}
                              value={type === 'glass' ? (merged.costPerMeter || '') : (merged.costPerBar || '')}
                              onChange={e => updateItemField(item.id, type === 'glass' ? 'costPerMeter' : 'costPerBar', parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs" placeholder="0,00"
                            />
                          </div>

                          {/* Cost per kg (profiles) */}
                          {type === 'profile' && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Custo/Kg</Label>
                              <Input
                                type="number" min={0} step={0.01}
                                value={merged.costPerKg || ''}
                                onChange={e => updateItemField(item.id, 'costPerKg', parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs" placeholder="0,00"
                              />
                            </div>
                          )}

                          {/* Cost per meter (profiles) */}
                          {type === 'profile' && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Custo/Metro</Label>
                              <Input
                                type="number" min={0} step={0.01}
                                value={merged.costPerMeter || ''}
                                onChange={e => updateItemField(item.id, 'costPerMeter', parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs" placeholder="0,00"
                              />
                            </div>
                          )}

                          {/* Sale price per bar / unit */}
                          <div className="space-y-1">
                            <Label className="text-[10px] text-primary flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {type === 'profile' ? 'Venda/Barra' : type === 'glass' ? 'Venda/m²' : 'Venda/Un'}
                            </Label>
                            <Input
                              type="number" min={0} step={0.01}
                              value={type === 'glass' ? (merged.salePricePerMeter || '') : (merged.salePricePerBar || '')}
                              onChange={e => updateItemField(item.id, type === 'glass' ? 'salePricePerMeter' : 'salePricePerBar', parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs border-primary/30" placeholder="0,00"
                            />
                          </div>

                          {/* Sale per kg */}
                          {type === 'profile' && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-primary">Venda/Kg</Label>
                              <div className="h-8 flex items-center text-xs text-primary bg-primary/5 rounded-md px-2">
                                {merged.salePricePerKg > 0 ? formatCurrency(merged.salePricePerKg) : '-'}
                              </div>
                            </div>
                          )}

                          {/* Sale per meter */}
                          {type === 'profile' && (
                            <div className="space-y-1">
                              <Label className="text-[10px] text-primary">Venda/Metro</Label>
                              <div className="h-8 flex items-center text-xs text-primary bg-primary/5 rounded-md px-2">
                                {merged.salePricePerMeter > 0 ? formatCurrency(merged.salePricePerMeter) : '-'}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Item totals */}
                        <div className="flex items-center justify-end gap-4 text-xs pt-1">
                          <span className="text-muted-foreground">Custo: <strong>{formatCurrency(item.totalCost)}</strong></span>
                          <span className="text-primary">Venda: <strong>{formatCurrency(item.saleTotal)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* No items */}
          {compositionItems.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              Este produto não possui composição cadastrada.
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-3 border-t">
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar Preços'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
