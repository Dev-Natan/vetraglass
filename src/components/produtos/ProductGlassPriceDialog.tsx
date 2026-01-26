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
import { ProductGlassPrice, DEFAULT_GLASS_COLORS } from '@/hooks/useProductGlassPrices';
import { Badge } from '@/components/ui/badge';

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

const DEFAULT_GLASS_TYPES = ['Comum', 'Temperado', 'Laminado', 'Espelho', 'Jateado'];
const DEFAULT_THICKNESSES = [4, 6, 8, 10, 12];

export function ProductGlassPriceDialog({
  open,
  onOpenChange,
  onSave,
  editingPrice,
  isLoading,
}: ProductGlassPriceDialogProps) {
  const [glassType, setGlassType] = useState('');
  const [customGlassType, setCustomGlassType] = useState('');
  const [glassColor, setGlassColor] = useState('Incolor');
  const [customGlassColor, setCustomGlassColor] = useState('');
  const [thicknessMm, setThicknessMm] = useState<number>(6);
  const [pricePerSqm, setPricePerSqm] = useState<string>('');
  const [costPerSqm, setCostPerSqm] = useState<string>('');
  const [useCustomType, setUseCustomType] = useState(false);
  const [useCustomColor, setUseCustomColor] = useState(false);

  useEffect(() => {
    if (editingPrice) {
      // Glass type
      const isCustomType = !DEFAULT_GLASS_TYPES.includes(editingPrice.glass_type);
      setUseCustomType(isCustomType);
      if (isCustomType) {
        setCustomGlassType(editingPrice.glass_type);
        setGlassType('custom');
      } else {
        setGlassType(editingPrice.glass_type);
        setCustomGlassType('');
      }
      
      // Glass color
      const isCustomColor = !DEFAULT_GLASS_COLORS.includes(editingPrice.glass_color);
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
      setGlassColor('Incolor');
      setCustomGlassColor('');
      setThicknessMm(6);
      setPricePerSqm('');
      setCostPerSqm('');
      setUseCustomType(false);
      setUseCustomColor(false);
    }
  }, [editingPrice, open]);

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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Vidro</Label>
            <Select value={glassType} onValueChange={handleGlassTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_GLASS_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
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
                {DEFAULT_GLASS_COLORS.map((color) => (
                  <SelectItem key={color} value={color}>
                    {color}
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_THICKNESSES.map((thickness) => (
                  <SelectItem key={thickness} value={thickness.toString()}>
                    {thickness}mm
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
      </DialogContent>
    </Dialog>
  );
}
