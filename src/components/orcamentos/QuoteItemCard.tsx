import { memo } from 'react';
import { resolveImageUrl, resolveProductImageUrl } from '@/utils/imageUrl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Package, Layers, Palette, Maximize2, Plus, X } from 'lucide-react';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';
import { useItemTypes } from '@/hooks/useItemTypes';
import { GLASS_COLOR_PRESETS, GLASS_THICKNESS_PRESETS } from '@/utils/glassName';
import type { QuoteItem, QuoteComponent } from './_novo-orcamento/types';


const glassColorLabels: Record<string, string> = {
  incolor: 'Incolor',
  verde: 'Verde',
  fume: 'Fumê',
};

interface QuoteItemCardProps {
  item: QuoteItem;
  index: number;
  onUpdate: (index: number, field: keyof QuoteItem, value: unknown) => void;
  onRemove: (index: number) => void;
  formatCurrency: (value: number) => string;
}

export const QuoteItemCard = memo(function QuoteItemCard({ item, index, onUpdate, onRemove, formatCurrency }: QuoteItemCardProps) {
  const { labels: categoryLabels } = useProductCategoryLabels();
  const { data: itemTypes } = useItemTypes();
  
  const getProductImage = (imageUrl: string | null | undefined) => {
    if (item.item_type === 'item') {
      return resolveImageUrl(imageUrl ?? null, 'item-templates');
    }
    return resolveProductImageUrl(imageUrl ?? null);
  };
  
  const getItemTypeLabel = (type: string) => {
    const found = itemTypes?.find(t => t.slug === type);
    return found?.name || type;
  };

  const imageUrl = getProductImage(item.image_url);
  const area = item.width && item.height ? (((item.width + (item.width_b || 0)) / 1000) * (item.height / 1000)).toFixed(2) : null;
  const isItem = item.item_type === 'item';
  const isParametric = item.composition_mode === 'parametric';

  const addComponent = () => {
    const components = [...(item.components || [])];
    components.push({
      description: '',
      quantity: 1,
      unit_price: 0
    });
    onUpdate(index, 'components', components);
  };

  const removeComponent = (compIndex: number) => {
    const components = item.components?.filter((_, i) => i !== compIndex);
    onUpdate(index, 'components', components);
  };

  const updateComponent = (compIndex: number, field: keyof QuoteComponent, value: unknown) => {
    const components = item.components?.map((comp, i) => {
      if (i === compIndex) {
        return { ...comp, [field]: value };
      }
      return comp;
    });
    onUpdate(index, 'components', components);
  };

  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="w-20 h-20 shrink-0 rounded-lg bg-muted overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.description}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isItem ? (
                <Layers className="w-8 h-8 text-muted-foreground/30" />
              ) : (
                <Package className="w-8 h-8 text-muted-foreground/30" />
              )}
            </div>
          )}
        </div>

        {/* Product Info & Controls */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{item.description || 'Produto não selecionado'}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isItem && (
                  <Badge variant="secondary" className="text-xs bg-warning/20 text-warning-foreground dark:bg-warning/20">
                    Item Avulso
                  </Badge>
                )}
                {item.linha && (
                  <Badge variant="secondary" className="text-xs">{item.linha}</Badge>
                )}
                {isParametric && (
                  <Badge variant="outline" className="text-xs">
                    PARAMETRIC · snapshot v{item.parametric_snapshot_version || 1}
                  </Badge>
                )}
                {item.category && (
                  <Badge variant="outline" className="text-xs">
                    {isItem ? getItemTypeLabel(item.category) : (categoryLabels[item.category] || item.category)}
                  </Badge>
                )}
                {item.has_glass && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={item.glass_color || ''}
                      onValueChange={(v) => onUpdate(index, 'glass_color', v)}
                      disabled={isParametric}
                    >
                      <SelectTrigger className="h-7 text-xs w-[120px] bg-primary/10 border-primary/30 text-primary">
                        <SelectValue placeholder="Cor" />
                      </SelectTrigger>
                      <SelectContent>
                        {GLASS_COLOR_PRESETS.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={item.glass_thickness ? String(item.glass_thickness).replace('mm', '') : ''}
                      onValueChange={(v) => onUpdate(index, 'glass_thickness', `${v}mm`)}
                      disabled={isParametric}
                    >
                      <SelectTrigger className="h-7 text-xs w-[100px] bg-success/10 border-success/30 text-success">
                        <SelectValue placeholder="Espessura" />
                      </SelectTrigger>
                      <SelectContent>
                        {GLASS_THICKNESS_PRESETS.map(t => (
                          <SelectItem key={t} value={t}>{t}mm</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {item.aluminum_color && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
                    <Palette className="w-3 h-3 mr-1" />
                    {item.aluminum_color}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              className="text-destructive hover:text-destructive shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Dimensions & Quantity - Different layout for items vs products */}
          {isItem ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {item.unit === 'm2' && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Largura (mm)</label>
                    <Input
                      type="number"
                      value={item.width || ''}
                      onChange={(e) => onUpdate(index, 'width', Number(e.target.value))}
                      placeholder="1000"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Altura (mm)</label>
                    <Input
                      type="number"
                      value={item.height || ''}
                      onChange={(e) => onUpdate(index, 'height', Number(e.target.value))}
                      placeholder="1000"
                      className="h-9"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Qtd ({item.unit || 'un'})</label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', Number(e.target.value))}
                  min={1}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Preço {item.unit === 'm2' ? 'm²' : 'Unit.'}</label>
                <Input
                  type="number"
                  value={item.unit_price || ''}
                  onChange={(e) => {
                    const newPrice = Number(e.target.value);
                    onUpdate(index, 'unit_price', newPrice);
                    onUpdate(index, 'base_price_m2', newPrice);
                    onUpdate(index, 'total_price', newPrice * (item.width && item.height ? (item.width/1000)*(item.height/1000) : 1) * item.quantity);
                  }}
                  min={0}
                  step={0.01}
                  className="h-9"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {item.vao_width && item.vao_height && (
                <div className="col-span-full bg-primary/5 p-2 rounded border border-primary/20 text-[10px] text-primary font-medium flex items-center gap-2">
                  <Maximize2 className="w-3.5 h-3.5" />
                  Vão original: {item.vao_width} x {item.vao_height} mm
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Largura (mm)</label>
                <Input
                  type="number"
                  value={item.width || ''}
                  onChange={(e) => onUpdate(index, 'width', Number(e.target.value))}
                  placeholder="1200"
                  min={0}
                  disabled={isParametric}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Altura (mm)</label>
                <Input
                  type="number"
                  value={item.height || ''}
                  onChange={(e) => onUpdate(index, 'height', Number(e.target.value))}
                  placeholder="1500"
                  min={0}
                  disabled={isParametric}
                  className="h-9"
                />
              </div>

              {item.width_b !== undefined && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Largura Lado B (mm)</label>
                    <Input
                      type="number"
                      value={item.width_b || ''}
                      onChange={(e) => onUpdate(index, 'width_b', Number(e.target.value))}
                      placeholder="1200"
                      min={0}
                      disabled={isParametric}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Altura Lado B (mm)</label>
                    <Input
                      type="number"
                      value={item.height_b || ''}
                      onChange={(e) => onUpdate(index, 'height_b', Number(e.target.value))}
                      placeholder="1500"
                      min={0}
                      disabled={isParametric}
                      className="h-9"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Qtd</label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', Number(e.target.value))}
                  min={1}
                  disabled={isParametric}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Preço/{item.commercial_unit === 'UNIT' ? 'un' : 'm²'}
                </label>
                <Input
                  type="number"
                  value={item.applied_unit_price ?? item.base_price_m2 ?? ''}
                  onChange={(e) => onUpdate(index, 'applied_unit_price', Number(e.target.value))}
                  min={0}
                  step={0.01}
                  disabled={isParametric}
                  className="h-9"
                />
              </div>
            </div>
          )}

          {isParametric && (
            <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Medidas, variantes e preço estão congelados no snapshot. Para recalcular, remova o item e adicione-o novamente.
            </p>
          )}

          {/* Components / Accessories */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Componentes / Acessórios</h5>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px]"
                onClick={addComponent}
                disabled={isParametric}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            
            {item.components && item.components.length > 0 && (
              <div className="space-y-2">
                {item.components.map((comp, compIndex) => (
                  <div key={compIndex} className="flex gap-2 items-end bg-muted/30 p-2 rounded-lg border border-dashed">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground block mb-1">Descrição</label>
                      <Input
                        value={comp.description}
                        onChange={(e) => updateComponent(compIndex, 'description', e.target.value)}
                        placeholder="Ex: Puxador, Motor..."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="w-16">
                      <label className="text-[10px] text-muted-foreground block mb-1">Qtd</label>
                      <Input
                        type="number"
                        value={comp.quantity}
                        onChange={(e) => updateComponent(compIndex, 'quantity', Number(e.target.value))}
                        min={1}
                        className="h-8 text-xs px-1"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] text-muted-foreground block mb-1">Preço Unit.</label>
                      <Input
                        type="number"
                        value={comp.unit_price}
                        onChange={(e) => updateComponent(compIndex, 'unit_price', Number(e.target.value))}
                        min={0}
                        step={0.01}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeComponent(compIndex)}
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Price Summary */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {isItem 
                ? `${item.quantity} ${item.unit || 'un'} × ${formatCurrency(item.unit_price)}`
                : area && `${area} m² ${item.width_b ? '(Lado A+B) ' : ''}× ${item.quantity} un`
              }
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-bold text-primary">{formatCurrency(item.total_price)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
