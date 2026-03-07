import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Weight, Ruler, TrendingUp, Calculator, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ItemPricingData {
  barLengthMm: string;
  weightKg: string;
  weightPerMeter: string;
  costPerBar: string;
  costPerKg: string;
  costPerMeter: string;
  salePricePerBar: string;
  salePricePerKg: string;
  salePricePerMeter: string;
  saleMarginPercent: string;
}

interface ItemPricingFieldsProps {
  data: ItemPricingData;
  onChange: (data: ItemPricingData) => void;
  itemType?: string;
}

export const defaultPricingData: ItemPricingData = {
  barLengthMm: '',
  weightKg: '',
  weightPerMeter: '',
  costPerBar: '',
  costPerKg: '',
  costPerMeter: '',
  salePricePerBar: '',
  salePricePerKg: '',
  salePricePerMeter: '',
  saleMarginPercent: '30',
};

function safeNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function ItemPricingFields({ data, onChange, itemType }: ItemPricingFieldsProps) {
  const barLengthM = safeNum(data.barLengthMm) / 1000;
  const weightKg = safeNum(data.weightKg);
  const costPerBar = safeNum(data.costPerBar);
  const costPerKg = safeNum(data.costPerKg);
  const margin = safeNum(data.saleMarginPercent);

  // Auto-calculate derived values
  useEffect(() => {
    const updates: Partial<ItemPricingData> = {};

    // Weight per meter = total weight / bar length in meters
    if (weightKg > 0 && barLengthM > 0) {
      updates.weightPerMeter = (weightKg / barLengthM).toFixed(3);
    }

    // Cost per meter from bar
    if (costPerBar > 0 && barLengthM > 0) {
      updates.costPerMeter = (costPerBar / barLengthM).toFixed(2);
    } else if (costPerKg > 0 && weightKg > 0 && barLengthM > 0) {
      const totalCostFromKg = costPerKg * weightKg;
      updates.costPerMeter = (totalCostFromKg / barLengthM).toFixed(2);
      if (!costPerBar) {
        updates.costPerBar = totalCostFromKg.toFixed(2);
      }
    }

    // Cost per kg from bar
    if (costPerBar > 0 && weightKg > 0 && !costPerKg) {
      updates.costPerKg = (costPerBar / weightKg).toFixed(2);
    }

    // Sale prices from margin
    if (margin > 0) {
      const multiplier = 1 + margin / 100;
      const cBar = safeNum(updates.costPerBar || data.costPerBar);
      const cKg = safeNum(updates.costPerKg || data.costPerKg);
      const cMeter = safeNum(updates.costPerMeter || data.costPerMeter);

      if (cBar > 0) updates.salePricePerBar = (cBar * multiplier).toFixed(2);
      if (cKg > 0) updates.salePricePerKg = (cKg * multiplier).toFixed(2);
      if (cMeter > 0) updates.salePricePerMeter = (cMeter * multiplier).toFixed(2);
    }

    if (Object.keys(updates).length > 0) {
      onChange({ ...data, ...updates });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.barLengthMm, data.weightKg, data.costPerBar, data.costPerKg, data.saleMarginPercent]);

  const update = (field: keyof ItemPricingData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const costMeter = safeNum(data.costPerMeter);
  const saleMeter = safeNum(data.salePricePerMeter);
  const profitPerMeter = saleMeter - costMeter;

  return (
    <div className="space-y-4">
      {/* Dimensões do Perfil */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Dimensões do Perfil</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho da Barra (mm) </Label>
            <Input
              type="number" min="0" step="1"
              value={data.barLengthMm}
              onChange={(e) => update('barLengthMm', e.target.value)}
              placeholder="Ex: 6000"
              className="h-9"
            />
            {barLengthM > 0 && (
              <p className="text-[10px] text-muted-foreground">{barLengthM.toFixed(2)}m</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Weight className="h-3 w-3" /> Peso da Barra (Kg)
            </Label>
            <Input
              type="number" min="0" step="0.001"
              value={data.weightKg}
              onChange={(e) => update('weightKg', e.target.value)}
              placeholder="0,000"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Peso/Metro (Kg/m)</Label>
            <Input
              type="number" readOnly
              value={data.weightPerMeter}
              className="h-9 bg-muted/50"
              placeholder="Auto"
            />
          </div>
        </div>
      </div>

      {/* Preços de Custo */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Preços de Custo</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Custo por Barra (R$)</Label>
            <Input
              type="number" min="0" step="0.01"
              value={data.costPerBar}
              onChange={(e) => update('costPerBar', e.target.value)}
              placeholder="0,00"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Custo por Kg (R$)</Label>
            <Input
              type="number" min="0" step="0.01"
              value={data.costPerKg}
              onChange={(e) => update('costPerKg', e.target.value)}
              placeholder="0,00"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Custo por Metro (R$)</Label>
            <Input
              type="number" readOnly
              value={data.costPerMeter}
              className="h-9 bg-muted/50"
              placeholder="Auto"
            />
          </div>
        </div>
      </div>

      {/* Margem e Preços de Venda */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Margem e Preços de Venda</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Margem de Lucro (%)</Label>
            <Input
              type="number" min="0" step="0.1"
              value={data.saleMarginPercent}
              onChange={(e) => update('saleMarginPercent', e.target.value)}
              placeholder="30"
              className="h-9 border-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Venda/Barra (R$)</Label>
            <Input
              type="number"
              value={data.salePricePerBar}
              onChange={(e) => update('salePricePerBar', e.target.value)}
              className="h-9 bg-muted/50"
              placeholder="Auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Venda/Kg (R$)</Label>
            <Input
              type="number"
              value={data.salePricePerKg}
              onChange={(e) => update('salePricePerKg', e.target.value)}
              className="h-9 bg-muted/50"
              placeholder="Auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Venda/Metro (R$)</Label>
            <Input
              type="number"
              value={data.salePricePerMeter}
              onChange={(e) => update('salePricePerMeter', e.target.value)}
              className="h-9 bg-muted/50"
              placeholder="Auto"
            />
          </div>
        </div>
      </div>

      {/* Summary Card */}
      {costMeter > 0 && saleMeter > 0 && (
        <div className={cn(
          "rounded-lg border p-3 space-y-1",
          profitPerMeter >= 0 ? "bg-accent/30 border-accent" : "bg-destructive/10 border-destructive/20"
        )}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Custo/metro</span>
            <div className="flex items-center gap-2">
              <span>R$ {costMeter.toFixed(2)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">R$ {saleMeter.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Lucro/metro</span>
            <Badge variant={profitPerMeter >= 0 ? "secondary" : "destructive"} className="text-[10px]">
              R$ {profitPerMeter.toFixed(2)} ({margin.toFixed(1)}%)
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
