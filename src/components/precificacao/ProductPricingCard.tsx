import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronUp, Save, Ruler, DollarSign,
  TrendingUp, Package, AlertCircle, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';
import { calculatePricing, type CompositionItemInput, type PricingInput } from '@/utils/pricingEngine';
import { usePricingPolicy } from '@/hooks/usePricingPolicy';
import { CalculationMemory } from './CalculationMemory';

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

/**
 * Returns the PRIMARY cost for an item based on its type.
 * - profile: cost per kg (most common in aluminum industry)
 * - glass: cost per m²
 * - accessory/component/service: cost per unit
 */
function getPrimaryCost(item: CompositionItem): number {
  if (item.itemType === 'profile') return item.costPerKg;
  if (item.itemType === 'glass') return item.costPerMeter; // m²
  return item.costPerBar || item.costPerMeter || 0; // unit cost
}

function getPrimaryCostLabel(type: string): string {
  if (type === 'profile') return 'Custo/Kg';
  if (type === 'glass') return 'Custo/m²';
  return 'Custo/Un';
}

/** Derive all cost fields from the primary cost input */
function deriveCosts(item: CompositionItem, primaryCost: number): Partial<CompositionItem> {
  const barLengthM = (item.barLengthMm || 6000) / 1000;

  if (item.itemType === 'profile') {
    // Primary = costPerKg
    const costPerKg = primaryCost;
    const costPerBar = costPerKg * (item.weightKg || 0);
    const costPerMeter = barLengthM > 0 ? costPerBar / barLengthM : 0;
    return { costPerKg, costPerBar, costPerMeter };
  }
  if (item.itemType === 'glass') {
    // Primary = costPerMeter (which is cost/m² for glass)
    return { costPerMeter: primaryCost };
  }
  // accessory/component/service: unit cost
  return { costPerBar: primaryCost };
}

export function ProductPricingCard({ product, compositionItems, onSaved }: ProductPricingCardProps) {
  const queryClient = useQueryClient();
  const { policy } = usePricingPolicy();
  const [expanded, setExpanded] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1200);
  const [marginPercent, setMarginPercent] = useState(product.margin_percent ?? policy.defaultMargin);
  const [saving, setSaving] = useState(false);
  // Store only the primary cost override per item
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});

  const getEffectiveCost = useCallback((item: CompositionItem) => {
    if (costOverrides[item.id] !== undefined) return costOverrides[item.id];
    return getPrimaryCost(item);
  }, [costOverrides]);

  const updateCost = useCallback((itemId: string, value: number) => {
    setCostOverrides(prev => ({ ...prev, [itemId]: value }));
  }, []);

  // Calculate component costs for simulation
  const calculatedItems = useMemo(() => {
    const mult = 1 + (marginPercent / 100);

    return compositionItems.map(raw => {
      const primaryCost = getEffectiveCost(raw);
      const derived = deriveCosts(raw, primaryCost);
      const item = { ...raw, ...derived };
      const piecesQty = item.piecesQuantity || 1;

      if (item.itemType === 'glass') {
        const calcW = evaluateFormula(item.widthFormula || 'Largura', width, height);
        const calcH = evaluateFormula(item.heightFormula || 'Altura', width, height);
        const areaM2 = (calcW * calcH) / 1_000_000;
        const totalCost = (item.costPerMeter || 0) * areaM2 * piecesQty;
        const saleTotal = totalCost * mult;
        return { ...item, totalCost, saleTotal, displayMeasure: `${calcW.toFixed(0)} × ${calcH.toFixed(0)} mm`, calcValue: areaM2, primaryCost };
      } else if (item.itemType === 'profile') {
        const length = item.heightFormula
          ? evaluateFormula(item.heightFormula, width, height)
          : item.widthFormula
            ? evaluateFormula(item.widthFormula, width, height)
            : width;
        const lengthM = length / 1000;
        const costPerMeter = item.barLengthMm > 0 ? item.costPerBar / (item.barLengthMm / 1000) : item.costPerMeter;
        const totalCost = costPerMeter * lengthM * piecesQty;
        const saleTotal = totalCost * mult;
        return { ...item, totalCost, saleTotal, displayMeasure: `${length.toFixed(0)} mm`, calcValue: length, primaryCost };
      } else {
        const unitCost = item.costPerBar || item.costPerMeter || 0;
        const totalCost = unitCost * piecesQty;
        const saleTotal = totalCost * mult;
        return { ...item, totalCost, saleTotal, displayMeasure: `${piecesQty} un`, calcValue: piecesQty, primaryCost };
      }
    });
  }, [compositionItems, costOverrides, width, height, marginPercent, getEffectiveCost]);

  const totalCost = calculatedItems.reduce((s, c) => s + c.totalCost, 0);
  const totalSale = calculatedItems.reduce((s, c) => s + c.saleTotal, 0);
  const areaM2 = (width * height) / 1_000_000;
  const costPerSqm = areaM2 > 0 ? totalCost / areaM2 : 0;
  const pricePerSqm = areaM2 > 0 ? totalSale / areaM2 : 0;
  const profit = totalSale - totalCost;

  // Engine-based calculation for memory display
  const engineResult = useMemo(() => {
    if (compositionItems.length === 0) return null;
    const engineItems: CompositionItemInput[] = compositionItems.map(raw => {
      const primaryCost = getEffectiveCost(raw);
      return {
        id: raw.id,
        itemName: raw.itemName,
        itemType: raw.itemType as any,
        unit: raw.unit,
        imageUrl: raw.imageUrl,
        widthFormula: raw.widthFormula,
        heightFormula: raw.heightFormula,
        quantityFormula: raw.quantityFormula,
        piecesQuantity: raw.piecesQuantity,
        cutAngle: raw.cutAngle,
        lossPercent: policy.defaultLossPercent,
        barLengthMm: raw.barLengthMm,
        weightPerMeter: raw.weightPerMeter,
        costPerBar: raw.itemType === 'profile' ? (raw.costPerKg > 0 ? raw.costPerKg * (raw.weightKg || 0) : raw.costPerBar) : raw.costPerBar,
        costPerKg: raw.costPerKg,
        costPerMeter: raw.costPerMeter,
        costPerUnit: raw.costPerBar || raw.costPerMeter || 0,
      };
    });
    const input: PricingInput = { vaoLargura: width, vaoAltura: height, quantity: 1 };
    return calculatePricing(engineItems, input, policy, marginPercent);
  }, [compositionItems, width, height, marginPercent, policy, getEffectiveCost]);

  // Group by type
  const grouped = useMemo(() => {
    const g: Record<string, typeof calculatedItems> = {};
    calculatedItems.forEach(c => {
      if (!g[c.itemType]) g[c.itemType] = [];
      g[c.itemType].push(c);
    });
    return g;
  }, [calculatedItems]);

  const hasChanges = Object.keys(costOverrides).length > 0 || marginPercent !== (product.margin_percent ?? 30);

  const handleSave = async () => {
    setSaving(true);
    try {
      const mult = 1 + (marginPercent / 100);

      // 1. Save product pricing
      const { error: prodError } = await supabase
        .from('company_products')
        .update({
          cost_per_sqm: costPerSqm,
          price_per_sqm: pricePerSqm,
          margin_percent: marginPercent,
        })
        .eq('id', product.id);
      if (prodError) throw prodError;

      // 2. Update each modified company_item
      const updatedCompanyItemIds: string[] = [];

      for (const [itemId, primaryCost] of Object.entries(costOverrides)) {
        const original = compositionItems.find(i => i.id === itemId);
        if (!original?.companyItemId) continue;

        const derived = deriveCosts(original, primaryCost);
        const barLengthM = (original.barLengthMm || 6000) / 1000;

        const updateData: Record<string, any> = {};

        if (original.itemType === 'profile') {
          updateData.cost_per_kg = derived.costPerKg;
          updateData.cost = derived.costPerBar;
          updateData.cost_per_meter = derived.costPerMeter;
          updateData.sale_price_per_kg = (derived.costPerKg || 0) * mult;
          updateData.sale_price = (derived.costPerBar || 0) * mult;
          updateData.sale_price_per_meter = (derived.costPerMeter || 0) * mult;
        } else if (original.itemType === 'glass') {
          updateData.cost_per_meter = derived.costPerMeter;
          updateData.sale_price_per_meter = (derived.costPerMeter || 0) * mult;
        } else {
          updateData.cost = derived.costPerBar;
          updateData.sale_price = (derived.costPerBar || 0) * mult;
        }

        const { error: itemError } = await supabase
          .from('company_items')
          .update(updateData)
          .eq('id', original.companyItemId);
        if (itemError) throw itemError;
        updatedCompanyItemIds.push(original.companyItemId);
      }

      // 3. Propagate to other products using same items
      if (updatedCompanyItemIds.length > 0) {
        const { data: affectedProducts } = await supabase
          .from('company_product_items')
          .select('company_product_id')
          .in('company_item_id', updatedCompanyItemIds)
          .neq('company_product_id', product.id);

        if (affectedProducts && affectedProducts.length > 0) {
          const uniqueProductIds = [...new Set(affectedProducts.map(p => p.company_product_id))];
          for (const pid of uniqueProductIds) {
            await supabase
              .from('company_products')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', pid);
          }
          toast.info(`${uniqueProductIds.length} outro(s) produto(s) atualizado(s) automaticamente.`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['company-items'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      queryClient.invalidateQueries({ queryKey: ['precificacao-products'] });

      toast.success('Preços salvos com sucesso!');
      setCostOverrides({});
      onSaved?.();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const noPricing = compositionItems.length > 0 && totalCost === 0;

  return (
    <Card className={cn("transition-all", expanded && "ring-1 ring-primary/20")}>
      {/* Collapsed Header */}
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {product.image_url ? (
              <div className="w-12 h-12 rounded-lg border bg-background p-1 flex items-center justify-center shrink-0">
                <img src={product.image_url} alt={product.commercial_name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <CardTitle className="text-sm font-semibold">{product.commercial_name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                {product.linha && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{product.linha}</Badge>}
                {product.category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{categoryLabels[product.category] || product.category}</Badge>}
                <span className="text-[10px] text-muted-foreground">{compositionItems.length} itens</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {noPricing && !expanded && (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <div className="hidden sm:flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-muted-foreground">Custo/m²</span>
                <p className="font-semibold">{costPerSqm > 0 ? formatCurrency(costPerSqm) : '—'}</p>
              </div>
              <div className="text-right">
                <span className="text-primary">Venda/m²</span>
                <p className="font-semibold text-primary">{pricePerSqm > 0 ? formatCurrency(pricePerSqm) : '—'}</p>
              </div>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Simulation + Margin */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg">
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
              <Label className="text-[10px] text-primary font-semibold flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Margem (%)
              </Label>
              <Input
                type="number" min={0} step={1}
                value={marginPercent}
                onChange={e => setMarginPercent(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm border-primary/30 font-semibold"
              />
            </div>
            <div className="hidden sm:block space-y-1">
              <Label className="text-[10px] text-muted-foreground">Área</Label>
              <div className="h-8 flex items-center text-sm font-medium">{areaM2.toFixed(3)} m²</div>
            </div>
          </div>

          {/* KPI Summary - simplified to 3 cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg bg-muted/40 text-center">
              <span className="text-[10px] text-muted-foreground block">Custo/m²</span>
              <p className="text-sm font-bold mt-0.5">{costPerSqm > 0 ? formatCurrency(costPerSqm) : '—'}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 text-center">
              <span className="text-[10px] text-primary block">Venda/m²</span>
              <p className="text-sm font-bold text-primary mt-0.5">{pricePerSqm > 0 ? formatCurrency(pricePerSqm) : '—'}</p>
            </div>
            <div className={cn("p-2.5 rounded-lg text-center", profit >= 0 ? "bg-emerald-500/10" : "bg-destructive/10")}>
              <span className="text-[10px] text-muted-foreground block">Lucro</span>
              <p className={cn("text-sm font-bold mt-0.5", profit >= 0 ? "text-emerald-600" : "text-destructive")}>
                {formatCurrency(profit)}
              </p>
            </div>
          </div>

          {/* Components grouped by type - SIMPLIFIED */}
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
                    Subtotal: <strong>{formatCurrency(typeCost)}</strong>
                  </span>
                </div>

                <div className="space-y-1.5">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/20 transition-colors">
                      {/* Icon */}
                      <div className="w-8 h-8 rounded bg-muted/60 flex items-center justify-center shrink-0 text-sm overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-contain" />
                        ) : (
                          <span>{typeIcons[item.itemType] || '📦'}</span>
                        )}
                      </div>

                      {/* Name + measure */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.itemName}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{item.displayMeasure}</span>
                          {item.piecesQuantity > 1 && <span>× {item.piecesQuantity}</span>}
                          {item.cutAngle && <span>({item.cutAngle}°)</span>}
                        </div>
                      </div>

                      {/* ONE cost input */}
                      <div className="w-24 shrink-0">
                        <Label className="text-[9px] text-muted-foreground block mb-0.5">{getPrimaryCostLabel(type)}</Label>
                        <Input
                          type="number" min={0} step={0.01}
                          value={costOverrides[item.id] !== undefined ? costOverrides[item.id] : (item.primaryCost || '')}
                          onChange={e => updateCost(item.id, parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs"
                          placeholder="0,00"
                        />
                      </div>

                      {/* Auto-calculated total */}
                      <div className="w-20 text-right shrink-0">
                        <span className="text-[9px] text-muted-foreground block">Total</span>
                        <p className="text-xs font-semibold">{formatCurrency(item.totalCost)}</p>
                      </div>
                    </div>
                  ))}
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
          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-[10px] text-muted-foreground">
              {hasChanges ? 'Alterações não salvas' : 'Nenhuma alteração pendente'}
            </p>
            <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar Preços'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
