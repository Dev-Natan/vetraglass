import { useState, useEffect, useMemo } from 'react';
import { useGlassColors, useGlassThicknesses, useGlassColorMutations, useGlassThicknessMutations } from '@/hooks/useGlassPricing';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface GlassPriceEntry {
  colorId: string;
  thicknessId: string;
  cost: number;
  price: number;
}

interface GlassPricingMatrixProps {
  prices: GlassPriceEntry[];
  onPricesChange: (prices: GlassPriceEntry[]) => void;
  compact?: boolean;
}

export function GlassPricingMatrix({ prices, onPricesChange, compact = false }: GlassPricingMatrixProps) {
  const { data: colors = [], isLoading: loadingColors } = useGlassColors();
  const { data: thicknesses = [], isLoading: loadingThicknesses } = useGlassThicknesses();
  const { createMutation: createColor, initializeDefaultColors } = useGlassColorMutations();
  const { createMutation: createThickness } = useGlassThicknessMutations();
  
  const [newColorName, setNewColorName] = useState('');
  const [newThickness, setNewThickness] = useState('');
  const [showAddColor, setShowAddColor] = useState(false);
  const [showAddThickness, setShowAddThickness] = useState(false);

  // Initialize default colors if none exist
  useEffect(() => {
    if (!loadingColors && colors.length === 0) {
      initializeDefaultColors.mutate();
    }
  }, [loadingColors, colors.length]);

  // Get price entry for a specific color/thickness combination
  const getPrice = (colorId: string, thicknessId: string): GlassPriceEntry | undefined => {
    return prices.find(p => p.colorId === colorId && p.thicknessId === thicknessId);
  };

  // Update a specific price entry
  const updatePrice = (colorId: string, thicknessId: string, field: 'cost' | 'price', value: number) => {
    const newPrices = [...prices];
    const existingIndex = newPrices.findIndex(p => p.colorId === colorId && p.thicknessId === thicknessId);
    
    if (existingIndex >= 0) {
      newPrices[existingIndex] = {
        ...newPrices[existingIndex],
        [field]: value,
      };
    } else {
      newPrices.push({
        colorId,
        thicknessId,
        cost: field === 'cost' ? value : 0,
        price: field === 'price' ? value : 0,
      });
    }
    
    onPricesChange(newPrices);
  };

  const handleAddColor = async () => {
    if (!newColorName.trim()) return;
    
    const slug = newColorName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    
    await createColor.mutateAsync({ 
      slug, 
      name: newColorName.trim() 
    });
    
    setNewColorName('');
    setShowAddColor(false);
  };

  const handleAddThickness = async () => {
    if (!newThickness.trim()) return;
    
    const thicknessMm = parseFloat(newThickness.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (isNaN(thicknessMm)) {
      toast.error('Espessura inválida');
      return;
    }
    
    await createThickness.mutateAsync({
      thickness: `${thicknessMm}mm`,
      thickness_mm: thicknessMm,
    });
    
    setNewThickness('');
    setShowAddThickness(false);
  };

  if (loadingColors || loadingThicknesses) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (colors.length === 0 || thicknesses.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
        <p className="text-muted-foreground text-sm mb-3">
          Configure as cores e espessuras de vidro disponíveis
        </p>
        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => initializeDefaultColors.mutate()}
            disabled={initializeDefaultColors.isPending}
          >
            {initializeDefaultColors.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Inicializar cores padrão
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Colors chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Cores disponíveis
          </span>
          {!showAddColor && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowAddColor(true)}
            >
              <Plus className="w-3 h-3" />
              Nova cor
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {colors.map(color => (
            <Badge
              key={color.id}
              variant="secondary"
              className="text-xs py-1 px-2.5"
              style={color.hex_color ? { 
                backgroundColor: `${color.hex_color}20`,
                borderColor: color.hex_color,
                borderWidth: 1,
              } : undefined}
            >
              {color.name}
            </Badge>
          ))}
          {showAddColor && (
            <div className="flex items-center gap-2">
              <Input
                value={newColorName}
                onChange={e => setNewColorName(e.target.value)}
                placeholder="Nome da cor"
                className="h-7 w-32 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleAddColor()}
              />
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddColor}
                disabled={createColor.isPending}
              >
                {createColor.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Adicionar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowAddColor(false)}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Thicknesses chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Espessuras disponíveis
          </span>
          {!showAddThickness && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowAddThickness(true)}
            >
              <Plus className="w-3 h-3" />
              Nova espessura
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {thicknesses.map(t => (
            <Badge key={t.id} variant="outline" className="text-xs py-1 px-2.5">
              {t.thickness}
            </Badge>
          ))}
          {showAddThickness && (
            <div className="flex items-center gap-2">
              <Input
                value={newThickness}
                onChange={e => setNewThickness(e.target.value)}
                placeholder="Ex: 6mm"
                className="h-7 w-24 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleAddThickness()}
              />
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddThickness}
                disabled={createThickness.isPending}
              >
                {createThickness.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Adicionar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowAddThickness(false)}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Matrix Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground min-w-[100px]">
                  Cor / Espessura
                </th>
                {thicknesses.map(t => (
                  <th key={t.id} className="text-center p-2 text-xs font-medium text-muted-foreground min-w-[120px]">
                    {t.thickness}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((color, colorIdx) => (
                <tr 
                  key={color.id} 
                  className={cn(colorIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20')}
                >
                  <td className="p-2 font-medium text-xs whitespace-nowrap">
                    <span 
                      className="inline-flex items-center gap-1.5"
                      style={color.hex_color ? { color: color.hex_color } : undefined}
                    >
                      {color.hex_color && (
                        <span 
                          className="w-3 h-3 rounded-full border"
                          style={{ backgroundColor: color.hex_color }}
                        />
                      )}
                      {color.name}
                    </span>
                  </td>
                  {thicknesses.map(thickness => {
                    const entry = getPrice(color.id, thickness.id);
                    return (
                      <td key={thickness.id} className="p-1.5">
                        <div className={cn(
                          "space-y-1",
                          compact ? "" : "min-w-[100px]"
                        )}>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground w-5">C:</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry?.cost || ''}
                              onChange={e => updatePrice(color.id, thickness.id, 'cost', parseFloat(e.target.value) || 0)}
                              placeholder="0,00"
                              className="h-7 text-xs px-2"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground w-5">V:</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry?.price || ''}
                              onChange={e => updatePrice(color.id, thickness.id, 'price', parseFloat(e.target.value) || 0)}
                              placeholder="0,00"
                              className="h-7 text-xs px-2"
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground">
        C = Custo por m² | V = Venda por m² (valores em R$)
      </p>
    </div>
  );
}
