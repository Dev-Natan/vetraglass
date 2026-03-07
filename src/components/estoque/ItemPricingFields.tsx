import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler, Weight, Calculator, TrendingUp } from 'lucide-react';

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

export function ItemPricingFields({ data, onChange }: ItemPricingFieldsProps) {
  const barLengthM = safeNum(data.barLengthMm) / 1000;
  const weightKg = safeNum(data.weightKg);
  const costPerBar = safeNum(data.costPerBar);
  const costPerKg = safeNum(data.costPerKg);
  const margin = safeNum(data.saleMarginPercent);

  useEffect(() => {
    const updates: Partial<ItemPricingData> = {};

    if (weightKg > 0 && barLengthM > 0) {
      updates.weightPerMeter = (weightKg / barLengthM).toFixed(3);
    }

    if (costPerBar > 0 && barLengthM > 0) {
      updates.costPerMeter = (costPerBar / barLengthM).toFixed(2);
    } else if (costPerKg > 0 && weightKg > 0 && barLengthM > 0) {
      const totalCost = costPerKg * weightKg;
      updates.costPerMeter = (totalCost / barLengthM).toFixed(2);
      if (!costPerBar) updates.costPerBar = totalCost.toFixed(2);
    }

    if (costPerBar > 0 && weightKg > 0 && !costPerKg) {
      updates.costPerKg = (costPerBar / weightKg).toFixed(2);
    }

    if (margin > 0) {
      const mult = 1 + margin / 100;
      const cBar = safeNum(updates.costPerBar || data.costPerBar);
      const cKg = safeNum(updates.costPerKg || data.costPerKg);
      const cMeter = safeNum(updates.costPerMeter || data.costPerMeter);
      if (cBar > 0) updates.salePricePerBar = (cBar * mult).toFixed(2);
      if (cKg > 0) updates.salePricePerKg = (cKg * mult).toFixed(2);
      if (cMeter > 0) updates.salePricePerMeter = (cMeter * mult).toFixed(2);
    }

    if (Object.keys(updates).length > 0) {
      onChange({ ...data, ...updates });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.barLengthMm, data.weightKg, data.costPerBar, data.costPerKg, data.saleMarginPercent]);

  const update = (field: keyof ItemPricingData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-3">
      {/* Dimensões do Perfil */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Dimensões do Perfil</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Tamanho da Barra (mm)</Label>
            <Input type="number" min="0" step="1" value={data.barLengthMm} onChange={(e) => update('barLengthMm', e.target.value)} placeholder="Ex: 6000" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" /> Peso da Barra (Kg)</Label>
            <Input type="number" min="0" step="0.001" value={data.weightKg} onChange={(e) => update('weightKg', e.target.value)} placeholder="0,000" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Peso/Metro (Kg/m)</Label>
            <Input type="number" readOnly value={data.weightPerMeter} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
          </div>
        </div>
      </div>

      {/* Preços de Custo */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Preços de Custo</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Custo por Barra (R$)</Label>
            <Input type="number" min="0" step="0.01" value={data.costPerBar} onChange={(e) => update('costPerBar', e.target.value)} placeholder="0,00" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Custo por Kg (R$)</Label>
            <Input type="number" min="0" step="0.01" value={data.costPerKg} onChange={(e) => update('costPerKg', e.target.value)} placeholder="0,00" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Custo por Metro (R$)</Label>
            <Input type="number" readOnly value={data.costPerMeter} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
          </div>
        </div>
      </div>

      {/* Margem e Preços de Venda */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Margem e Preços de Venda</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Margem de Lucro (%)</Label>
            <Input type="number" min="0" step="0.1" value={data.saleMarginPercent} onChange={(e) => update('saleMarginPercent', e.target.value)} placeholder="30" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Venda/Barra (R$)</Label>
            <Input type="number" readOnly value={data.salePricePerBar} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Venda/Kg (R$)</Label>
            <Input type="number" readOnly value={data.salePricePerKg} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Venda/Metro (R$)</Label>
            <Input type="number" readOnly value={data.salePricePerMeter} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
