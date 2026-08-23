import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler, Weight, Calculator, TrendingUp, Layers, Box, Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GLASS_THICKNESS_PRESETS, GLASS_COLOR_PRESETS } from '@/utils/glassName';


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
  // ── Atributos específicos de vidro (m²) ──
  thicknessMm: string;         // espessura em mm
  color: string;               // cor (Incolor, Verde, ...)

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
  thicknessMm: '',
  color: '',
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
      // Sincroniza comprimento linear (novo) → barLengthMm (legado)
      const compLinear = safeNum(data.comprimentoLinearMm);
      if (compLinear > 0 && safeNum(data.barLengthMm) !== compLinear) {
        updates.barLengthMm = String(compLinear);
      }
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
      if (costSqm > 0) {
        updates.costPerMeter = costSqm.toFixed(2);
        updates.salePricePerMeter = (costSqm * mult).toFixed(2);
      }
    } else {
      // Unit-based — usa precoUnitario (novo) como fonte primária
      const precoUnit = safeNum(data.precoUnitario) || safeNum(data.costPerUnit);
      if (precoUnit > 0) {
        if (data.costPerUnit !== precoUnit.toFixed(2)) updates.costPerUnit = precoUnit.toFixed(2);
        if (margin > 0) updates.salePricePerUnit = (precoUnit * mult).toFixed(2);
        updates.costPerBar = precoUnit.toFixed(2);
        updates.salePricePerBar = (precoUnit * mult).toFixed(2);
      }
    }

    const hasChanges = Object.entries(updates).some(([key, value]) => {
      return data[key as keyof ItemPricingData] !== value;
    });

    if (hasChanges) {
      onChange({ ...data, ...updates });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.barLengthMm, data.weightKg, data.costPerBar, data.costPerKg, data.saleMarginPercent, data.costPerUnit, data.costPerSqm, data.precoUnitario, data.comprimentoLinearMm, isProfile, isGlass, isUnit]);

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
                <Label className="text-xs">Comprimento da Barra (mm)</Label>
                <Input type="number" min="0" step="1" value={data.comprimentoLinearMm || data.barLengthMm} onChange={(e) => onChange({ ...data, comprimentoLinearMm: e.target.value, barLengthMm: e.target.value })} placeholder="Ex: 6000" className="h-8 text-sm" />
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

          {/* Markup e venda */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Markup sobre custo e preços de venda</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Markup sobre custo (%)</Label>
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

      {/* ═══ GLASS / m² FIELDS ═══ */}
      {isGlass && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Dimensões da Chapa (referência)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Altura (mm)</Label>
                <Input type="number" min="0" step="1" value={data.alturaMm} onChange={(e) => update('alturaMm', e.target.value)} placeholder="Ex: 2200" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Largura (mm)</Label>
                <Input type="number" min="0" step="1" value={data.larguraMm} onChange={(e) => update('larguraMm', e.target.value)} placeholder="Ex: 3210" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Área (m²)</Label>
                <Input type="number" readOnly value={((safeNum(data.alturaMm) * safeNum(data.larguraMm)) / 1_000_000 || 0).toFixed(3)} className="h-8 text-sm bg-muted/50" />
              </div>
            </div>
          </div>
          {/* Atributos do Vidro: Espessura + Cor */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Atributos do Vidro</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Espessura (mm)</Label>
                <div className="flex gap-1">
                  <Select
                    value={GLASS_THICKNESS_PRESETS.includes(data.thicknessMm) ? data.thicknessMm : (data.thicknessMm ? '__custom__' : '')}
                    onValueChange={(v) => update('thicknessMm', v === '__custom__' ? (data.thicknessMm && !GLASS_THICKNESS_PRESETS.includes(data.thicknessMm) ? data.thicknessMm : '') : v)}
                  >
                    <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {GLASS_THICKNESS_PRESETS.map((t) => (
                        <SelectItem key={t} value={t}>{t}mm</SelectItem>
                      ))}
                      <SelectItem value="__custom__">Outro…</SelectItem>
                    </SelectContent>
                  </Select>
                  {(!GLASS_THICKNESS_PRESETS.includes(data.thicknessMm) && data.thicknessMm !== '') && (
                    <Input type="number" min="0" step="0.1" value={data.thicknessMm} onChange={(e) => update('thicknessMm', e.target.value)} placeholder="mm" className="h-8 text-sm w-20" />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor</Label>
                <div className="flex gap-1">
                  <Select
                    value={GLASS_COLOR_PRESETS.includes(data.color) ? data.color : (data.color ? '__custom__' : '')}
                    onValueChange={(v) => update('color', v === '__custom__' ? (data.color && !GLASS_COLOR_PRESETS.includes(data.color) ? data.color : '') : v)}
                  >
                    <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {GLASS_COLOR_PRESETS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">Outra…</SelectItem>
                    </SelectContent>
                  </Select>
                  {(!GLASS_COLOR_PRESETS.includes(data.color) && data.color !== '') && (
                    <Input value={data.color} onChange={(e) => update('color', e.target.value)} placeholder="Cor" className="h-8 text-sm w-24" />
                  )}
                </div>
              </div>
            </div>
          </div>

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
                <Label className="text-xs">Markup sobre custo (%)</Label>
                <Input type="number" min="0" step="0.1" value={data.saleMarginPercent} onChange={(e) => update('saleMarginPercent', e.target.value)} placeholder="30" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Venda/m² (R$)</Label>
                <Input type="number" readOnly value={data.salePricePerSqm} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
              </div>
            </div>
            {/* Resumo da chapa: Largura × Altura × Custo/m² (+ margem) */}
            {(() => {
              const alturaMm = safeNum(data.alturaMm);
              const larguraMm = safeNum(data.larguraMm);
              const areaM2 = (alturaMm * larguraMm) / 1_000_000;
              const custoSqm = safeNum(data.costPerSqm);
              const margem = safeNum(data.saleMarginPercent);
              if (areaM2 <= 0 || custoSqm <= 0) return null;
              const custoTotal = areaM2 * custoSqm;
              const vendaSqm = custoSqm * (1 + margem / 100);
              const vendaTotal = areaM2 * vendaSqm;
              const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              return (
                <div className="mt-2 rounded-md border border-dashed border-primary/30 bg-primary/5 p-2 text-xs space-y-1">
                  <div className="text-[11px] text-muted-foreground">
                    Chapa {larguraMm} × {alturaMm} mm · <strong>{areaM2.toFixed(3)} m²</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      <span className="text-muted-foreground">Custo total:</span>{' '}
                      <strong className="text-foreground">{fmt(custoTotal)}</strong>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        ({larguraMm}×{alturaMm}×{fmt(custoSqm)}/m²)
                      </span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Preço de venda:</span>{' '}
                      <strong className="text-primary">{fmt(vendaTotal)}</strong>
                      {margem > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1">(+{margem}% margem)</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>


        </>
      )}

      {/* ═══ UNIT / KIT FIELDS ═══ */}
      {isUnit && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Box className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {group === 'kit' ? 'Preço por Kit' : 'Preço por Unidade'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Valor por {group === 'kit' ? 'Kit' : 'Unidade'} (R$)</Label>
              <Input type="number" min="0" step="0.01" value={data.precoUnitario || data.costPerUnit} onChange={(e) => update('precoUnitario', e.target.value)} placeholder="0,00" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Markup sobre custo (%)</Label>
              <Input type="number" min="0" step="0.1" value={data.saleMarginPercent} onChange={(e) => update('saleMarginPercent', e.target.value)} placeholder="30" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Venda {group === 'kit' ? 'Kit' : 'Unitária'} (R$)</Label>
              <Input type="number" readOnly value={data.salePricePerUnit} className="h-8 text-sm bg-muted/50" placeholder="Auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
