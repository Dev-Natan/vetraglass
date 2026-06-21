import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler, Weight, Calculator, TrendingUp, Layers, Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  // Unit-based (accessories, components, services)
  costPerUnit: string;
  salePricePerUnit: string;
  // Glass (m²)
  costPerSqm: string;
  salePricePerSqm: string;
  // ── Campos estruturados por unidade (novo) ──
  alturaMm: string;           // m² (chapa)
  larguraMm: string;          // m² (chapa)
  comprimentoLinearMm: string; // ml (barra)
  precoUnitario: string;       // un / kit
}

interface ItemPricingFieldsProps {
  data: ItemPricingData;
  onChange: (data: ItemPricingData) => void;
  itemType?: string;
  /** Unidade selecionada no formulário (m², ml, un, kit...). Quando informada, controla os campos exibidos. */
  unit?: string;
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
  costPerUnit: '',
  salePricePerUnit: '',
  costPerSqm: '',
  salePricePerSqm: '',
  alturaMm: '',
  larguraMm: '',
  comprimentoLinearMm: '',
  precoUnitario: '',
};

function safeNum(v: string): number {
  if (!v) return 0;
  const normalized = v.trim().replace(/\s/g, '');
  const safeValue = normalized.includes(',') && normalized.includes('.')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(',', '.');
  const n = Number.parseFloat(safeValue);
  return Number.isFinite(n) ? n : 0;
}

const typeConfig: Record<string, { label: string; icon: string; color: string }> = {
  profile: { label: 'Perfil', icon: '🔩', color: 'text-blue-600' },
  glass: { label: 'Vidro', icon: '🪟', color: 'text-cyan-600' },
  accessory: { label: 'Acessório', icon: '⚙️', color: 'text-amber-600' },
  component: { label: 'Componente', icon: '🧩', color: 'text-purple-600' },
  service: { label: 'Serviço', icon: '🔧', color: 'text-emerald-600' },
};

/** Normaliza unidade → grupo de cálculo. */
function unitGroup(unit?: string, itemType?: string): 'm2' | 'ml' | 'un' | 'kit' {
  const u = String(unit || '').toLowerCase().trim();
  if (u === 'm²' || u === 'm2') return 'm2';
  if (u === 'ml' || u === 'm') return 'ml';
  if (u === 'kit') return 'kit';
  if (u === 'un' || u === 'pç' || u === 'par' || u === 'jg' || u === 'cx') return 'un';
  // Fallback por tipo (compat)
  if (itemType === 'glass') return 'm2';
  if (itemType === 'profile') return 'ml';
  return 'un';
}

export function ItemPricingFields({ data, onChange, itemType = 'profile', unit }: ItemPricingFieldsProps) {
  // Quando `unit` é informada, ela controla qual bloco aparece (m²/ml/un/kit).
  // Caso contrário, cai no comportamento legado por itemType.
  const group = unitGroup(unit, itemType);
  const isProfile = group === 'ml';
  const isGlass = group === 'm2';
  const isUnit = group === 'un' || group === 'kit';

  const barLengthM = safeNum(data.barLengthMm) / 1000;
  const weightKg = safeNum(data.weightKg);
  const costPerBar = safeNum(data.costPerBar);
  const costPerKg = safeNum(data.costPerKg);
  const margin = safeNum(data.saleMarginPercent);

  useEffect(() => {
    const updates: Partial<ItemPricingData> = {};
    const mult = margin > 0 ? 1 + margin / 100 : 1;

    if (isProfile) {
      // Weight per meter
      if (weightKg > 0 && barLengthM > 0) {
        updates.weightPerMeter = (weightKg / barLengthM).toFixed(3);
      }
      // Derive costs
      let derivedCostPerKg = costPerKg;
      let derivedCostPerBar = costPerBar;
      if (costPerBar > 0 && weightKg > 0) {
        derivedCostPerKg = costPerBar / weightKg;
        updates.costPerKg = derivedCostPerKg.toFixed(2);
      } else if (costPerKg > 0 && weightKg > 0) {
        derivedCostPerBar = costPerKg * weightKg;
        updates.costPerBar = derivedCostPerBar.toFixed(2);
      }
      if (derivedCostPerBar > 0 && barLengthM > 0) {
        updates.costPerMeter = (derivedCostPerBar / barLengthM).toFixed(2);
      }
      // Sale prices
      if (margin > 0) {
        const cBar = safeNum(updates.costPerBar ?? data.costPerBar);
        const cKg = safeNum(updates.costPerKg ?? data.costPerKg);
        const cMeter = safeNum(updates.costPerMeter ?? data.costPerMeter);
        if (cBar > 0) updates.salePricePerBar = (cBar * mult).toFixed(2);
        if (cKg > 0) updates.salePricePerKg = (cKg * mult).toFixed(2);
        if (cMeter > 0) updates.salePricePerMeter = (cMeter * mult).toFixed(2);
      }
    } else if (isGlass) {
      const costSqm = safeNum(data.costPerSqm);
      if (costSqm > 0 && margin > 0) {
        updates.salePricePerSqm = (costSqm * mult).toFixed(2);
      }
      // Sync to costPerMeter for DB compatibility
      if (costSqm > 0) {
        updates.costPerMeter = costSqm.toFixed(2);
        updates.salePricePerMeter = (costSqm * mult).toFixed(2);
      }
    } else {
      // Unit-based
      const costUnit = safeNum(data.costPerUnit);
      if (costUnit > 0 && margin > 0) {
        updates.salePricePerUnit = (costUnit * mult).toFixed(2);
      }
      // Sync to costPerBar/salePrice for DB compatibility
      if (costUnit > 0) {
        updates.costPerBar = costUnit.toFixed(2);
        updates.salePricePerBar = (costUnit * mult).toFixed(2);
      }
    }

    const hasChanges = Object.entries(updates).some(([key, value]) => {
      return data[key as keyof ItemPricingData] !== value;
    });

    if (hasChanges) {
      onChange({ ...data, ...updates });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.barLengthMm, data.weightKg, data.costPerBar, data.costPerKg, data.saleMarginPercent, data.costPerUnit, data.costPerSqm, itemType]);

  const update = (field: keyof ItemPricingData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const config = typeConfig[itemType] || typeConfig.accessory;

  return (
    <div className="space-y-3">
      {/* Type indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm">{config.icon}</span>
        <Badge variant="outline" className="text-[10px]">
          {config.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {isProfile ? 'Preço por barra, kg ou metro' : isGlass ? 'Preço por m²' : 'Preço por unidade'}
        </span>
      </div>

      {/* ═══ PROFILE FIELDS ═══ */}
      {isProfile && (
        <>
          {/* Dimensões */}
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

          {/* Custo */}
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

          {/* Margem e Venda */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Margem e Preços de Venda</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Margem (%)</Label>
                <Input type="number" min="0" step="0.1" value={data.saleMarginPercent} onChange={(e) => update('saleMarginPercent', e.target.value)} placeholder="30" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Venda/Barra</Label>
                <Input type="number" readOnly value={data.salePricePerBar} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Venda/Kg</Label>
                <Input type="number" readOnly value={data.salePricePerKg} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Venda/Metro</Label>
                <Input type="number" readOnly value={data.salePricePerMeter} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ GLASS FIELDS ═══ */}
      {isGlass && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Preço por Metro Quadrado</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Custo por m² (R$)</Label>
              <Input type="number" min="0" step="0.01" value={data.costPerSqm} onChange={(e) => update('costPerSqm', e.target.value)} placeholder="0,00" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Margem (%)</Label>
              <Input type="number" min="0" step="0.1" value={data.saleMarginPercent} onChange={(e) => update('saleMarginPercent', e.target.value)} placeholder="30" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Venda/m² (R$)</Label>
              <Input type="number" readOnly value={data.salePricePerSqm} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ UNIT-BASED FIELDS (accessory, component, service) ═══ */}
      {isUnit && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Box className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Preço por Unidade</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Custo Unitário (R$)</Label>
              <Input type="number" min="0" step="0.01" value={data.costPerUnit} onChange={(e) => update('costPerUnit', e.target.value)} placeholder="0,00" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Margem (%)</Label>
              <Input type="number" min="0" step="0.1" value={data.saleMarginPercent} onChange={(e) => update('saleMarginPercent', e.target.value)} placeholder="30" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Venda Unitária (R$)</Label>
              <Input type="number" readOnly value={data.salePricePerUnit} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
