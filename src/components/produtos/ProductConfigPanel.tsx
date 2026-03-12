import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings2, Ruler, Palette, Shield, Frame, Scissors } from 'lucide-react';

export interface ProductConfigData {
  acabamento: string;
  cor_componentes: string;
  reforco: string;
  contramarco: string;
  corte_contramarco: string;
  arremate: string;
}

interface ProductConfigPanelProps {
  config: ProductConfigData;
  onChange: (config: ProductConfigData) => void;
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
}

const acabamentoOptions = [
  'Branco Brilhante RAL900',
  'Branco Fosco',
  'Preto Fosco',
  'Bronze',
  'Champagne',
  'Amadeirado',
  'Anodizado Natural',
  'Anodizado Bronze',
  'Pintura Eletrostática',
];

const corComponentesOptions = [
  'Branco',
  'Preto',
  'Cinza',
  'Bronze',
  'Champagne',
];

const reforcoOptions = [
  'Sem Reforço',
  'Reforço Simples',
  'Reforço Duplo',
  'Reforço Triplo',
];

const contramarcoOptions = [
  'Sem contramarco',
  'CM-200',
  'CM-250',
  'Contramarco Padrão',
];

const corteContramarcoOptions = [
  '45°/45°',
  '90°/90°',
  '45°/90°',
];

const arremateOptions = [
  'Sem arremate',
  'Arremate Interno',
  'Arremate Externo',
  'Arremate Duplo',
];

export function ProductConfigPanel({
  config,
  onChange,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
}: ProductConfigPanelProps) {
  const updateField = (field: keyof ProductConfigData, value: string) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Perfis e Opções
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dimensions info */}
        {(minWidth || maxWidth || minHeight || maxHeight) && (
          <div className="grid grid-cols-2 gap-4 pb-3 border-b">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Ruler className="w-3 h-3" /> Largura
              </Label>
              <p className="text-xs text-muted-foreground">
                {minWidth ? `Min: ${minWidth} mm` : ''} {maxWidth ? `• Máx: ${maxWidth} mm` : ''}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Ruler className="w-3 h-3" /> Altura
              </Label>
              <p className="text-xs text-muted-foreground">
                {minHeight ? `Min: ${minHeight} mm` : ''} {maxHeight ? `• Máx: ${maxHeight} mm` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Config fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              Acabamento do Perfil
            </Label>
            <Select value={config.acabamento || ''} onValueChange={(v) => updateField('acabamento', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {acabamentoOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              Cor dos Componentes
            </Label>
            <Select value={config.cor_componentes || ''} onValueChange={(v) => updateField('cor_componentes', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {corComponentesOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Reforço
            </Label>
            <Select value={config.reforco || ''} onValueChange={(v) => updateField('reforco', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem Reforço" />
              </SelectTrigger>
              <SelectContent>
                {reforcoOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Frame className="w-3.5 h-3.5 text-primary" />
              Contramarco
            </Label>
            <Select value={config.contramarco || ''} onValueChange={(v) => updateField('contramarco', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem contramarco" />
              </SelectTrigger>
              <SelectContent>
                {contramarcoOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-primary" />
              Corte do Contramarco
            </Label>
            <div className="flex gap-2">
              {corteContramarcoOptions.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updateField('corte_contramarco', opt)}
                  className={`flex-1 text-xs py-2 px-2 rounded-md border transition-colors ${
                    config.corte_contramarco === opt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 hover:bg-muted border-border'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Frame className="w-3.5 h-3.5 text-primary" />
              Arremate
            </Label>
            <Select value={config.arremate || ''} onValueChange={(v) => updateField('arremate', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem arremate" />
              </SelectTrigger>
              <SelectContent>
                {arremateOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
