import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChevronDown, ChevronUp, Save, Ruler, Weight, DollarSign,
  TrendingUp, Package, Layers, BarChart3, Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CompositionItem {
  id: string;
  itemName: string;
  itemType: string;
  unit: string;
  quantityFormula: string;
  widthFormula: string | null;
  heightFormula: string | null;
  piecesQuantity: number;
  cutAngle: number | null;
  // pricing from company_items or item_templates
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
  profile: '🔩',
  glass: '🪟',
  accessory: '⚙️',
  component: '🧩',
  service: '🔧',
};

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

export function ProductPricingCard({ product, compositionItems, onSaved }: ProductPricingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1200);
  const [marginPercent, setMarginPercent] = useState(product.margin_percent ?? 30);
  const [saving, setSaving] = useState(false);

  // Local editable item costs
  const [itemOverrides, setItemOverrides] = useState<Record<string, Partial<CompositionItem>>>({});

  const getItem = useCallback((item: CompositionItem) => {
    return { ...item, ...(itemOverrides[item.id] || {}) };
  }, [itemOverrides]);

  const updateItemField = (itemId: string, field: string, value: number) => {
    setItemOverrides(prev => {
      const current = prev[itemId] || {};
      const item = compositionItems.find(i => i.id === itemId);
      if (!item) return prev;
      const merged = { ...item, ...current, [field]: value };

      // Auto-calculate derived fields
      const barLengthM = merged.barLengthMm / 1000;

      if (field === 'weightKg' || field === 'barLengthMm') {
        if (merged.weightKg > 0 && barLengthM > 0) {
          merged.weightPerMeter = merged.weightKg / barLengthM;
        }
      }

      if (field === 'costPerBar' || field === 'weightKg' || field === 'barLengthMm') {
        if (merged.costPerBar > 0 && merged.weightKg > 0) {
          merged.costPerKg = merged.costPerBar / merged.weightKg;
        }
        if (merged.costPerBar > 0 && barLengthM > 0) {
          merged.costPerMeter = merged.costPerBar / barLengthM;
        }
      }

      if (field === 'costPerKg') {
        if (value > 0 && merged.weightKg > 0) {
          merged.costPerBar = value * merged.weightKg;
          if (barLengthM > 0) merged.costPerMeter = merged.costPerBar / barLengthM;
        }
      }

      // Auto-calculate sale prices with margin
      const mult = 1 + marginPercent / 100;
      if (merged.costPerBar > 0) merged.salePricePerBar = merged.costPerBar * mult;
      if (merged.costPerKg > 0) merged.salePricePerKg = merged.costPerKg * mult;
      if (merged.costPerMeter > 0) merged.salePricePerMeter = merged.costPerMeter * mult;

      return { ...prev, [itemId]: merged };
    });
  };

  // Calculate component costs for simulation
  const calculatedItems = useMemo(() => {
    return compositionItems.map(raw => {
      const item = getItem(raw);
      const piecesQty = item.piecesQuantity || 1;

      if (item.itemType === 'glass') {
        const calcW = evaluateFormula(item.widthFormula || 'Largura', width, height);
        const calcH = evaluateFormula(item.heightFormula || 'Altura', width, height);
        const areaM2 = (calcW * calcH) / 1_000_000;
        // Glass uses cost per m2 - use costPerMeter as placeholder for $/m²
        const totalCost = (item.costPerMeter || 0) * areaM2 * piecesQty;
        return { ...item, totalCost, displayMeasure: `${areaM2.toFixed(4)} m²`, calcValue: areaM2 };
      } else if (item.itemType === 'profile') {
        const length = item.heightFormula
          ? evaluateFormula(item.heightFormula, width, height)
          : item.widthFormula
            ? evaluateFormula(item.widthFormula, width, height)
            : width;
        const lengthM = length / 1000;
        const costPerMeter = item.barLengthMm > 0 ? item.costPerBar / (item.barLengthMm / 1000) : item.costPerMeter;
        const totalCost = costPerMeter * lengthM * piecesQty;
        const weightTotal = item.weightPerMeter * lengthM * piecesQty;
        return {
          ...item, totalCost,
          displayMeasure: `${length.toFixed(0)} mm (${weightTotal.toFixed(3)} kg)`,
          calcValue: length,
        };
      } else {
        const totalCost = (item.costPerBar || item.costPerMeter || 0) * piecesQty;
        return { ...item, totalCost, displayMeasure: `${piecesQty} un`, calcValue: piecesQty };
      }
    });
  }, [compositionItems, itemOverrides, width, height, marginPercent, getItem]);

  const totalCost = calculatedItems.reduce((s, c) => s + c.totalCost, 0);
  const areaM2 = (width * height) / 1_000_000;
  const costPerSqm = areaM2 > 0 ? totalCost / areaM2 : 0;
  const pricePerSqm = costPerSqm * (1 + marginPercent / 100);
  const totalPrice = totalCost * (1 + marginPercent / 100);

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
      // Save product pricing
      const { error: prodError } = await supabase
        .from('company_products')
        .update({
          cost_per_sqm: costPerSqm,
          price_per_sqm: pricePerSqm,
          margin_percent: marginPercent,
        })
        .eq('id', product.id);

      if (prodError) throw prodError;

      // Save item overrides to company_items
      for (const [itemId, overrides] of Object.entries(itemOverrides)) {
        const original = compositionItems.find(i => i.id === itemId);
        if (!original?.companyItemId) continue;

        const { error: itemError } = await supabase
          .from('company_items')
          .update({
            bar_length_mm: (overrides as any).barLengthMm,
            weight_kg: (overrides as any).weightKg,
            weight_per_meter: (overrides as any).weightPerMeter,
            cost: (overrides as any).costPerBar,
            cost_per_kg: (overrides as any).costPerKg,
            cost_per_meter: (overrides as any).costPerMeter,
            sale_price: (overrides as any).salePricePerBar,
            sale_price_per_kg: (overrides as any).salePricePerKg,
            sale_price_per_meter: (overrides as any).salePricePerMeter,
          })
          .eq('id', original.companyItemId);

        if (itemError) throw itemError;
      }

      toast.success('Preços salvos com sucesso!');
      onSaved?.();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(itemOverrides).length > 0;

  return (
    <Card className={cn("transition-all", expanded && "ring-1 ring-primary/30")}>
      {/* Header - always visible */}
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="w-10 h-10 rounded object-cover" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <CardTitle className="text-sm font-semibold">{product.commercial_name}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {product.linha && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{product.linha}</Badge>
                )}
                {product.category && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {categoryLabels[product.category] || product.category}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  {compositionItems.length} itens
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick pricing summary */}
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

      {/* Expanded content */}
      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Simulation controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Largura (mm)
              </Label>
              <Input
                type="number" min={100} step={10} value={width}
                onChange={e => setWidth(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Altura (mm)
              </Label>
              <Input
                type="number" min={100} step={10} value={height}
                onChange={e => setHeight(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Margem (%)
              </Label>
              <Input
                type="number" min={0} step={1} value={marginPercent}
                onChange={e => setMarginPercent(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Área</Label>
              <div className="h-8 flex items-center text-sm font-medium">
                {areaM2.toFixed(4)} m²
              </div>
            </div>
          </div>

          {/* KPI summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-md bg-muted/30 text-center">
              <span className="text-[10px] text-muted-foreground">Custo Total</span>
              <p className="text-sm font-bold">{formatCurrency(totalCost)}</p>
            </div>
            <div className="p-2 rounded-md bg-primary/10 text-center">
              <span className="text-[10px] text-primary">Venda Total</span>
              <p className="text-sm font-bold text-primary">{formatCurrency(totalPrice)}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/30 text-center">
              <span className="text-[10px] text-muted-foreground">Custo/m²</span>
              <p className="text-sm font-bold">{formatCurrency(costPerSqm)}</p>
            </div>
            <div className="p-2 rounded-md bg-primary/10 text-center">
              <span className="text-[10px] text-primary">Venda/m²</span>
              <p className="text-sm font-bold text-primary">{formatCurrency(pricePerSqm)}</p>
            </div>
          </div>

          {/* Composition grouped by type */}
          {['profile', 'glass', 'accessory', 'component', 'service'].map(type => {
            const items = grouped[type];
            if (!items || items.length === 0) return null;
            const typeCost = items.reduce((s, c) => s + c.totalCost, 0);

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <span>{typeIcons[type]}</span>
                    {typeLabels[type] || type}
                    <Badge variant="secondary" className="text-[9px] ml-1">{items.length}</Badge>
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    Subtotal: {formatCurrency(typeCost)}
                  </span>
                </div>

                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px]">
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs w-16">Peças</TableHead>
                        {type === 'profile' && (
                          <>
                            <TableHead className="text-xs w-20">Barra (mm)</TableHead>
                            <TableHead className="text-xs w-20">Peso (kg)</TableHead>
                            <TableHead className="text-xs w-20">Peso/m</TableHead>
                            <TableHead className="text-xs w-24">R$/Barra</TableHead>
                            <TableHead className="text-xs w-20">R$/Kg</TableHead>
                            <TableHead className="text-xs w-20">R$/Metro</TableHead>
                          </>
                        )}
                        {type === 'glass' && (
                          <>
                            <TableHead className="text-xs w-24">R$/m²</TableHead>
                          </>
                        )}
                        {type !== 'profile' && type !== 'glass' && (
                          <TableHead className="text-xs w-24">R$/Un</TableHead>
                        )}
                        <TableHead className="text-xs text-center">Medida</TableHead>
                        <TableHead className="text-xs text-right">Custo Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => {
                        const merged = getItem(item);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs font-medium">
                              {item.itemName}
                              {item.cutAngle && (
                                <span className="text-[9px] text-muted-foreground ml-1">({item.cutAngle}°)</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{item.piecesQuantity}</TableCell>

                            {type === 'profile' && (
                              <>
                                <TableCell>
                                  <Input
                                    type="number" min={0} step={1}
                                    value={merged.barLengthMm || ''}
                                    onChange={e => updateItemField(item.id, 'barLengthMm', parseFloat(e.target.value) || 0)}
                                    className="h-7 w-20 text-[11px]"
                                    placeholder="6000"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number" min={0} step={0.001}
                                    value={merged.weightKg || ''}
                                    onChange={e => updateItemField(item.id, 'weightKg', parseFloat(e.target.value) || 0)}
                                    className="h-7 w-20 text-[11px]"
                                    placeholder="0,000"
                                  />
                                </TableCell>
                                <TableCell className="text-[11px] text-muted-foreground">
                                  {merged.weightPerMeter > 0 ? `${merged.weightPerMeter.toFixed(3)}` : '-'}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number" min={0} step={0.01}
                                    value={merged.costPerBar || ''}
                                    onChange={e => updateItemField(item.id, 'costPerBar', parseFloat(e.target.value) || 0)}
                                    className="h-7 w-24 text-[11px]"
                                    placeholder="0,00"
                                  />
                                </TableCell>
                                <TableCell className="text-[11px] text-muted-foreground">
                                  {merged.costPerKg > 0 ? formatCurrency(merged.costPerKg) : '-'}
                                </TableCell>
                                <TableCell className="text-[11px] text-muted-foreground">
                                  {merged.costPerMeter > 0 ? formatCurrency(merged.costPerMeter) : '-'}
                                </TableCell>
                              </>
                            )}

                            {type === 'glass' && (
                              <TableCell>
                                <Input
                                  type="number" min={0} step={0.01}
                                  value={merged.costPerMeter || ''}
                                  onChange={e => updateItemField(item.id, 'costPerMeter', parseFloat(e.target.value) || 0)}
                                  className="h-7 w-24 text-[11px]"
                                  placeholder="0,00"
                                />
                              </TableCell>
                            )}

                            {type !== 'profile' && type !== 'glass' && (
                              <TableCell>
                                <Input
                                  type="number" min={0} step={0.01}
                                  value={merged.costPerBar || ''}
                                  onChange={e => updateItemField(item.id, 'costPerBar', parseFloat(e.target.value) || 0)}
                                  className="h-7 w-24 text-[11px]"
                                  placeholder="0,00"
                                />
                              </TableCell>
                            )}

                            <TableCell className="text-center text-[11px] text-muted-foreground">
                              {item.displayMeasure}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold">
                              {formatCurrency(item.totalCost)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}

          {/* Sale prices preview */}
          {compositionItems.some(i => i.itemType === 'profile') && (
            <div className="p-3 bg-accent/20 rounded-lg space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Preços de Venda (Margem {marginPercent}%)
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                {calculatedItems.filter(i => i.itemType === 'profile').map(item => (
                  <div key={item.id} className="p-2 bg-background rounded text-center">
                    <span className="text-[9px] text-muted-foreground line-clamp-1">{item.itemName}</span>
                    <p className="font-semibold text-primary mt-0.5">
                      {formatCurrency(item.salePricePerBar)}/barra
                    </p>
                    {item.salePricePerMeter > 0 && (
                      <p className="text-[9px] text-muted-foreground">
                        {formatCurrency(item.salePricePerMeter)}/m
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-2 border-t">
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
