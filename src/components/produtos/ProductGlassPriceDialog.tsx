import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductGlassPrice } from '@/hooks/useProductGlassPrices';
import { Badge } from '@/components/ui/badge';
import { useGlassTypes } from '@/hooks/useGlassTypes';
import { useGlassThicknesses, useGlassColors } from '@/hooks/useGlassAttributes';
import { Loader2 } from 'lucide-react';

interface ProductGlassPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    glass_type: string;
    glass_color: string;
    thickness_mm: number;
    price_per_sqm: number;
    cost_per_sqm: number;
  }) => Promise<void>;
  editingPrice: ProductGlassPrice | null;
  isLoading: boolean;
}

export function ProductGlassPriceDialog({
  open,
  onOpenChange,
  onSave,
  editingPrice,
  isLoading,
}: ProductGlassPriceDialogProps) {
  // Fetch dynamic data from database
  const { data: glassTypes = [], isLoading: loadingTypes } = useGlassTypes();
  const { data: thicknesses = [], isLoading: loadingThicknesses } = useGlassThicknesses();
  const { data: colors = [], isLoading: loadingColors } = useGlassColors();

  const [glassType, setGlassType] = useState('');
  const [customGlassType, setCustomGlassType] = useState('');
  const [glassColor, setGlassColor] = useState('');
  const [customGlassColor, setCustomGlassColor] = useState('');
  const [thicknessMm, setThicknessMm] = useState<number>(0);
  const [pricePerSqm, setPricePerSqm] = useState<string>('');
  const [costPerSqm, setCostPerSqm] = useState<string>('');
  const [useCustomType, setUseCustomType] = useState(false);
  const [useCustomColor, setUseCustomColor] = useState(false);

  const loadingData = loadingTypes || loadingThicknesses || loadingColors;

  // Set default values when data is loaded
  useEffect(() => {
    if (!editingPrice && thicknesses.length > 0 && !thicknessMm) {
      setThicknessMm(thicknesses[0].thickness_mm);
    }
    if (!editingPrice && colors.length > 0 && !glassColor) {
      setGlassColor(colors[0].name);
    }
  }, [thicknesses, colors, editingPrice, thicknessMm, glassColor]);

  useEffect(() => {
    if (editingPrice) {
      // Glass type
      const typeNames = glassTypes.map(t => t.name);
      const isCustomType = !typeNames.includes(editingPrice.glass_type);
      setUseCustomType(isCustomType);
      if (isCustomType) {
        setCustomGlassType(editingPrice.glass_type);
        setGlassType('custom');
      } else {
        setGlassType(editingPrice.glass_type);
        setCustomGlassType('');
      }
      
      // Glass color
      const colorNames = colors.map(c => c.name);
      const isCustomColor = !colorNames.includes(editingPrice.glass_color);
      setUseCustomColor(isCustomColor);
      if (isCustomColor) {
        setCustomGlassColor(editingPrice.glass_color);
        setGlassColor('custom');
      } else {
        setGlassColor(editingPrice.glass_color);
        setCustomGlassColor('');
      }
      
      setThicknessMm(editingPrice.thickness_mm);
      setPricePerSqm(editingPrice.price_per_sqm.toString());
      setCostPerSqm(editingPrice.cost_per_sqm.toString());
    } else {
      setGlassType('');
      setCustomGlassType('');
      setGlassColor(colors.length > 0 ? colors[0].name : '');
      setCustomGlassColor('');
      setThicknessMm(thicknesses.length > 0 ? thicknesses[0].thickness_mm : 0);
      setPricePerSqm('');
      setCostPerSqm('');
      setUseCustomType(false);
      setUseCustomColor(false);
    }
  }, [editingPrice, open, glassTypes, colors, thicknesses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalGlassType = useCustomType ? customGlassType : glassType;
    const finalGlassColor = useCustomColor ? customGlassColor : glassColor;
    
    if (!finalGlassType.trim() || !finalGlassColor.trim()) return;

    await onSave({
      glass_type: finalGlassType.trim(),
      glass_color: finalGlassColor.trim(),
      thickness_mm: thicknessMm,
      price_per_sqm: parseFloat(pricePerSqm) || 0,
      cost_per_sqm: parseFloat(costPerSqm) || 0,
    });
  };

  const handleGlassTypeChange = (value: string) => {
    if (value === 'custom') {
      setUseCustomType(true);
      setGlassType('custom');
    } else {
      setUseCustomType(false);
      setGlassType(value);
      setCustomGlassType('');
    }
  };

  const handleGlassColorChange = (value: string) => {
    if (value === 'custom') {
      setUseCustomColor(true);
      setGlassColor('custom');
    } else {
      setUseCustomColor(false);
      setGlassColor(value);
      setCustomGlassColor('');
    }
  };

  const margin = (() => {
    const price = parseFloat(pricePerSqm) || 0;
    const cost = parseFloat(costPerSqm) || 0;
    if (cost <= 0) return 0;
    return ((price - cost) / cost) * 100;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingPrice ? 'Editar Preço de Vidro' : 'Adicionar Preço de Vidro'}
          </DialogTitle>
        </DialogHeader>
        
        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando opções...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Vidro</Label>
              <Select value={glassType} onValueChange={handleGlassTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {glassTypes.map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      {type.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Outro (personalizado)</SelectItem>
                </SelectContent>
              </Select>
              {useCustomType && (
                <Input
                  placeholder="Digite o tipo de vidro"
                  value={customGlassType}
                  onChange={(e) => setCustomGlassType(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Cor do Vidro</Label>
              <Select value={glassColor} onValueChange={handleGlassColorChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cor" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color.id} value={color.name}>
                      <div className="flex items-center gap-2">
                        {color.hex_color && (
                          <div 
                            className="w-3 h-3 rounded-full border border-border" 
                            style={{ backgroundColor: color.hex_color }}
                          />
                        )}
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Outra (personalizada)</SelectItem>
                </SelectContent>
              </Select>
              {useCustomColor && (
                <Input
                  placeholder="Digite a cor do vidro"
                  value={customGlassColor}
                  onChange={(e) => setCustomGlassColor(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Espessura (mm)</Label>
              <Select
                value={thicknessMm.toString()}
                onValueChange={(v) => setThicknessMm(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a espessura" />
                </SelectTrigger>
                <SelectContent>
                  {thicknesses.map((t) => (
                    <SelectItem key={t.id} value={t.thickness_mm.toString()}>
                      {t.thickness_mm}mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo/m² (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={costPerSqm}
                  onChange={(e) => setCostPerSqm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço/m² (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={pricePerSqm}
                  onChange={(e) => setPricePerSqm(e.target.value)}
                />
              </div>
            </div>

            {(parseFloat(pricePerSqm) > 0 || parseFloat(costPerSqm) > 0) && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Margem calculada:</span>
                <Badge
                  variant={margin >= 30 ? 'default' : margin >= 15 ? 'secondary' : 'destructive'}
                >
                  {margin.toFixed(1)}%
                </Badge>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}