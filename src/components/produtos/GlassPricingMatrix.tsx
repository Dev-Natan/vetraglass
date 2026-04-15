import { useState, useEffect } from 'react';
import { useGlassColors, useGlassThicknesses, useGlassColorMutations } from '@/hooks/useGlassPricing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GlassPriceEntry {
  colorId: string;
  colorName?: string;
  thicknessId: string;
  thicknessValue?: string;
  cost: number;
  price: number;
}

interface GlassPricingMatrixProps {
  prices: GlassPriceEntry[];
  onPricesChange: (prices: GlassPriceEntry[]) => void;
  compact?: boolean;
}

// Default glass colors with their names
const DEFAULT_COLORS = [
  { name: 'Incolor', slug: 'incolor' },
  { name: 'Verde', slug: 'verde' },
  { name: 'Fumê', slug: 'fume' },
  { name: 'Bronze', slug: 'bronze' },
];

// Default thicknesses
const DEFAULT_THICKNESSES = ['4mm', '6mm', '8mm', '10mm'];

export function GlassPricingMatrix({ prices, onPricesChange, compact = false }: GlassPricingMatrixProps) {
  const { data: colors = [], isLoading: loadingColors } = useGlassColors();
  const { data: thicknesses = [], isLoading: loadingThicknesses } = useGlassThicknesses();
  const { initializeDefaultColors } = useGlassColorMutations();
  
  const [selectedThickness, setSelectedThickness] = useState<string>('');

  // Initialize default colors if none exist
  useEffect(() => {
    if (!loadingColors && colors.length === 0) {
      initializeDefaultColors.mutate();
    }
  }, [loadingColors, colors.length]);

  // Set default thickness when loaded
  useEffect(() => {
    if (thicknesses.length > 0 && !selectedThickness) {
      setSelectedThickness(thicknesses[0].id);
    }
  }, [thicknesses, selectedThickness]);

  // Get price entry for a specific color/thickness combination
  const getPrice = (colorId: string, thicknessId: string): GlassPriceEntry | undefined => {
    return prices.find(p => p.colorId === colorId && p.thicknessId === thicknessId);
  };

  // Update a specific price entry
  const updatePrice = (colorId: string, colorName: string, thicknessId: string, thicknessValue: string, field: 'cost' | 'price', value: number) => {
    const newPrices = [...prices];
    const existingIndex = newPrices.findIndex(p => p.colorId === colorId && p.thicknessId === thicknessId);
    
    if (existingIndex >= 0) {
      newPrices[existingIndex] = {
        ...newPrices[existingIndex],
        colorName,
        thicknessValue,
        [field]: value,
      };
    } else {
      newPrices.push({
        colorId,
        colorName,
        thicknessId,
        thicknessValue,
        cost: field === 'cost' ? value : 0,
        price: field === 'price' ? value : 0,
      });
    }
    
    onPricesChange(newPrices);
  };

  // Calculate margin
  const calculateMargin = (cost: number, price: number): number => {
    if (cost <= 0 || price <= 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  if (loadingColors || loadingThicknesses) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedThicknessData = thicknesses.find(t => t.id === selectedThickness);

  return (
    <div className="space-y-4">
      {/* Thickness selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Espessura do vidro</Label>
        <Select value={selectedThickness} onValueChange={setSelectedThickness}>
          <SelectTrigger className="w-full max-w-[200px]">
            <SelectValue placeholder="Selecione a espessura" />
          </SelectTrigger>
          <SelectContent>
            {thicknesses.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.thickness}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Simple price inputs per color */}
      {selectedThickness && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Defina o preço de venda por m² para cada cor de vidro na espessura <strong>{selectedThicknessData?.thickness}</strong>:
          </p>
          
          <div className="grid gap-3">
            {colors.map((color) => {
              const entry = getPrice(color.id, selectedThickness);
              const margin = calculateMargin(entry?.cost || 0, entry?.price || 0);
              
              return (
                <Card key={color.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-4">
                      {/* Color indicator */}
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <span 
                          className="w-4 h-4 rounded-full border-2 shrink-0"
                          style={{ 
                            backgroundColor: color.hex_color || '#e5e7eb',
                            borderColor: color.hex_color || '#d1d5db',
                          }}
                        />
                        <span className="font-medium text-sm">{color.name}</span>
                      </div>
                      
                      {/* Price inputs */}
                      <div className="flex-1 flex items-center gap-4">
                        <div className="flex-1 min-w-[120px]">
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Custo/m²
                          </Label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              R$
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry?.cost || ''}
                              onChange={e => updatePrice(
                                color.id, 
                                color.name, 
                                selectedThickness, 
                                selectedThicknessData?.thickness || '',
                                'cost', 
                                parseFloat(e.target.value) || 0
                              )}
                              placeholder="0,00"
                              className="h-9 pl-8 text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-[120px]">
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Venda/m²
                          </Label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              R$
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry?.price || ''}
                              onChange={e => updatePrice(
                                color.id, 
                                color.name, 
                                selectedThickness, 
                                selectedThicknessData?.thickness || '',
                                'price', 
                                parseFloat(e.target.value) || 0
                              )}
                              placeholder="0,00"
                              className="h-9 pl-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Margin indicator */}
                        <div className="w-[70px] text-center">
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Margem
                          </Label>
                          <div className={cn(
                            "text-sm font-medium rounded px-2 py-1",
                            margin < 0 && "bg-destructive/10 text-destructive",
                            margin >= 0 && margin < 20 && "bg-warning/10 text-warning",
                            margin >= 20 && "bg-success/10 text-success",
                          )}>
                            {margin > 0 ? `${margin.toFixed(0)}%` : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick fill hint */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Dica:</strong> Configure os preços para as cores mais comuns. Você pode adicionar mais cores e espessuras em <strong>Configurações → Categorias → Vidros</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Show configured prices summary */}
      {prices.filter(p => p.price > 0).length > 0 && (
        <div className="pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Preços configurados ({prices.filter(p => p.price > 0).length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {prices.filter(p => p.price > 0).map((entry, idx) => {
              const color = colors.find(c => c.id === entry.colorId);
              const thickness = thicknesses.find(t => t.id === entry.thicknessId);
              return (
                <div 
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color?.hex_color || '#888' }}
                  />
                  <span>{entry.colorName || color?.name} {entry.thicknessValue || thickness?.thickness}</span>
                  <span className="font-medium">R$ {entry.price.toFixed(2)}/m²</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
