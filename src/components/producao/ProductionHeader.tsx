import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scissors, Tag, Ruler, Settings2, Layers } from 'lucide-react';
import { CuttingPlanFilters } from '@/components/plano-corte/CuttingPlanFilters';

interface ProductionHeaderProps {
  availableLinhas: string[];
  availableCategories: string[];
  filteredProducts: Array<{ id: string; name: string; image_url: string | null; description?: string | null; min_width?: number | null; max_width?: number | null; min_height?: number | null; max_height?: number | null; linha?: string | null }>;
  selectedLinha: string;
  selectedCategory: string;
  selectedProduct: string;
  onLinhaChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProductChange: (value: string) => void;
  width: number;
  height: number;
  quantity: number;
  folgaLargura: number;
  folgaVertical: number;
  acabamento: string;
  corComponentes: string;
  reforco: string;
  contramarco: string;
  corteContramarco: string;
  arremate: string;
  tipoVidro: string;
  espessuraVidro: string;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onQuantityChange: (value: number) => void;
  onFolgaLarguraChange: (value: number) => void;
  onFolgaVerticalChange: (value: number) => void;
  onAcabamentoChange: (value: string) => void;
  onCorComponentesChange: (value: string) => void;
  onReforcoChange: (value: string) => void;
  onContramarcoChange: (value: string) => void;
  onCorteContramarcoChange: (value: string) => void;
  onArremateChange: (value: string) => void;
  onTipoVidroChange: (value: string) => void;
  onEspessuraVidroChange: (value: string) => void;
  onCalcular: () => void;
  productImageUrl: string | null;
  productName: string | null;
}

const ACABAMENTO_OPTIONS = [
  'Branco Brilhante RAL900',
  'Preto Fosco RAL9005',
  'Bronze Anodizado',
  'Natural Anodizado',
  'Champagne',
];

const COR_COMPONENTES_OPTIONS = [
  'Branco',
  'Preto',
  'Cinza',
  'Bronze',
];

const REFORCO_OPTIONS = [
  'Sem Reforço',
  'Reforço Padrão',
  'Reforço Reforçado',
];

const CONTRAMARCO_OPTIONS = [
  { value: 'sem', label: 'Sem contramarco' },
  { value: 'CM200', label: 'Contramarco CM200' },
  { value: 'CMT74', label: 'Contramarco CMT74' },
  { value: 'CM063', label: 'Contramarco CM063' },
  { value: 'CM060', label: 'Contramarco CM060' },
];

const ARREMATE_OPTIONS = [
  { value: 'sem', label: 'Sem arremate' },
  { value: 'RM019', label: 'Arremate RM019' },
  { value: 'RM005', label: 'Arremate RM005' },
  { value: 'MP347', label: 'Arremate MP347' },
];

const TIPO_VIDRO_OPTIONS = [
  'Temperado',
  'Laminado',
  'Float',
  'Insulado',
];

const ESPESSURA_VIDRO_OPTIONS: Record<string, string[]> = {
  'Temperado': ['6mm', '8mm', '10mm', '12mm'],
  'Laminado': ['6mm', '8mm', '10mm'],
  'Float': ['3mm', '4mm', '5mm', '6mm'],
  'Insulado': ['20mm', '24mm'],
};

export function ProductionHeader({
  availableLinhas,
  availableCategories,
  filteredProducts,
  selectedLinha,
  selectedCategory,
  selectedProduct,
  onLinhaChange,
  onCategoryChange,
  onProductChange,
  width,
  height,
  quantity,
  folgaLargura,
  folgaVertical,
  acabamento,
  corComponentes,
  reforco,
  contramarco,
  corteContramarco,
  arremate,
  tipoVidro,
  espessuraVidro,
  onWidthChange,
  onHeightChange,
  onQuantityChange,
  onFolgaLarguraChange,
  onFolgaVerticalChange,
  onAcabamentoChange,
  onCorComponentesChange,
  onReforcoChange,
  onContramarcoChange,
  onCorteContramarcoChange,
  onArremateChange,
  onTipoVidroChange,
  onEspessuraVidroChange,
  onCalcular,
  productImageUrl,
  productName
}: ProductionHeaderProps) {
  const selectedProductData = filteredProducts.find(p => p.id === selectedProduct);
  const minW = selectedProductData?.min_width || 0;
  const maxW = selectedProductData?.max_width || 9999;
  const minH = selectedProductData?.min_height || 0;
  const maxH = selectedProductData?.max_height || 9999;

  const espessuraOptions = ESPESSURA_VIDRO_OPTIONS[tipoVidro] || [];

  return (
    <div className="space-y-4">
      {/* Product Selection Filters - Always on top */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <CuttingPlanFilters
            availableLinhas={availableLinhas}
            availableCategories={availableCategories}
            filteredProducts={filteredProducts}
            selectedLinha={selectedLinha}
            selectedCategory={selectedCategory}
            selectedProduct={selectedProduct}
            onLinhaChange={onLinhaChange}
            onCategoryChange={onCategoryChange}
            onProductChange={onProductChange}
          />
        </CardContent>
      </Card>

      {/* Two Column Layout - Only show when product selected */}
      {selectedProduct && selectedProductData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN - Product Card + Line Info */}
          <div className="space-y-4">
            {/* Product Preview Card */}
            <Card className="border shadow-sm overflow-hidden">
              <div className="aspect-[4/3] bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-6">
                {productImageUrl ? (
                  <img
                    src={productImageUrl}
                    alt={productName || 'Produto'}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-7xl text-primary/20">🪟</div>
                )}
              </div>
              <CardContent className="p-4 border-t bg-card">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {selectedProductData.description || productName}
                </p>
              </CardContent>
            </Card>

            {/* Line Info Card */}
            <Card className="border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Selecione a Linha</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold">
                    {selectedProductData.linha || 'Linha'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {selectedProductData.linha?.substring(0, 3)?.toUpperCase() || 'SUP'}
                  </Badge>
                </div>
                <div className="pt-2 border-t space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedProductData.linha || 'Linha'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="text-primary font-medium">Dimensões</span>
                      <p>Largura: {minW} - {maxW} mm</p>
                      <p>Altura: {minH} - {maxH} mm</p>
                    </div>
                    <div>
                      <span className="text-primary font-medium">Características</span>
                      {reforco !== 'Sem Reforço' && <p>• {reforco}</p>}
                      {contramarco !== 'sem' && <p>• Contramarco</p>}
                      {arremate !== 'sem' && <p>• Arremate</p>}
                      {reforco === 'Sem Reforço' && contramarco === 'sem' && arremate === 'sem' && (
                        <p>• Reforço</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - Configuration Form */}
          <div className="lg:col-span-2 space-y-5">
            {/* Dimensões Section */}
            <Card className="border shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Tag className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-base">Dimensões</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Largura (mm)</Label>
                    <Input
                      type="number"
                      placeholder="Largura do vão em milímetros"
                      value={width || ''}
                      onChange={e => onWidthChange(Number(e.target.value))}
                      className="h-10 bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Min: {minW} mm • Máx: {maxW} mm
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Altura (mm)</Label>
                    <Input
                      type="number"
                      placeholder="Altura do vão em milímetros"
                      value={height || ''}
                      onChange={e => onHeightChange(Number(e.target.value))}
                      className="h-10 bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Min: {minH} mm • Máx: {maxH} mm
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Folga Largura (mm)</Label>
                    <Input
                      type="number"
                      placeholder="Folga na largura"
                      value={folgaLargura || ''}
                      onChange={e => onFolgaLarguraChange(Number(e.target.value))}
                      className="h-10 bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Min: 0 mm • Máx: 10 mm
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Folga Vertical (mm)</Label>
                    <Input
                      type="number"
                      placeholder="Folga na largura"
                      value={folgaVertical || ''}
                      onChange={e => onFolgaVerticalChange(Number(e.target.value))}
                      className="h-10 bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Min: 0 mm • Máx: 10 mm
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Perfis e Opções Section */}
            <Card className="border shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Settings2 className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-base">Perfis e Opções</h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Acabamento do Perfil</Label>
                    <Select value={acabamento} onValueChange={onAcabamentoChange}>
                      <SelectTrigger className="h-10 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border bg-white" />
                          <SelectValue placeholder="Selecionar" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {ACABAMENTO_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Cor dos Componentes</Label>
                    <Select value={corComponentes} onValueChange={onCorComponentesChange}>
                      <SelectTrigger className="h-10 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border bg-white" />
                          <SelectValue placeholder="Selecionar" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {COR_COMPONENTES_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Reforço</Label>
                    <Select value={reforco} onValueChange={onReforcoChange}>
                      <SelectTrigger className="h-10 bg-muted/50">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {REFORCO_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Contramarco</Label>
                    <Select value={contramarco} onValueChange={onContramarcoChange}>
                      <SelectTrigger className="h-10 bg-muted/50">
                        <SelectValue placeholder="Sem contramarco" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRAMARCO_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Corte do contramarco</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant={corteContramarco === '45/45' ? 'default' : 'outline'}
                        className="flex-1 h-10 text-sm"
                        onClick={() => onCorteContramarcoChange('45/45')}
                        disabled={contramarco === 'sem'}
                      >
                        45°/45°
                      </Button>
                      <Button
                        type="button"
                        variant={corteContramarco === '90/90' ? 'default' : 'outline'}
                        className="flex-1 h-10 text-sm"
                        onClick={() => onCorteContramarcoChange('90/90')}
                        disabled={contramarco === 'sem'}
                      >
                        90°/90°
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Arremate</Label>
                    <Select value={arremate} onValueChange={onArremateChange}>
                      <SelectTrigger className="h-10 bg-muted/50">
                        <SelectValue placeholder="Sem arremate" />
                      </SelectTrigger>
                      <SelectContent>
                        {ARREMATE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vidros Section */}
            <Card className="border shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Layers className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-base">Vidros</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Tipo de Vidro</Label>
                    <Select value={tipoVidro} onValueChange={(v) => { onTipoVidroChange(v); onEspessuraVidroChange(''); }}>
                      <SelectTrigger className="h-10 bg-muted/50">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_VIDRO_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Espessura do Vidro</Label>
                    <Select value={espessuraVidro} onValueChange={onEspessuraVidroChange} disabled={!tipoVidro}>
                      <SelectTrigger className="h-10 bg-muted/50">
                        <SelectValue placeholder={tipoVidro ? 'Selecionar' : 'Selecione o tipo de vidro primeiro'} />
                      </SelectTrigger>
                      <SelectContent>
                        {espessuraOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Calcular Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={onCalcular} className="gap-2 px-6">
                    <Scissors className="w-4 h-4" />
                    Calcular Esquadria
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
