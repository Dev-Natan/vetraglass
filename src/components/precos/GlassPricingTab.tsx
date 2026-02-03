import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Save, Trash2, Palette, Ruler, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useGlassTypes } from '@/hooks/useGlassTypes';
import {
  useGlassColors,
  useGlassThicknesses,
  useGlassPriceMatrix,
  useGlassColorMutations,
  useGlassThicknessMutations,
  useGlassPriceMatrixMutations,
  type GlassColor,
  type GlassThickness,
} from '@/hooks/useGlassPricing';

export function GlassPricingTab() {
  const { data: glassTypes, isLoading: loadingTypes } = useGlassTypes();
  const { data: glassColors, isLoading: loadingColors } = useGlassColors();
  const { data: glassThicknesses, isLoading: loadingThicknesses } = useGlassThicknesses();
  const { data: priceMatrix, isLoading: loadingPrices } = useGlassPriceMatrix();

  const { createMutation: createColor, deleteMutation: deleteColor, initializeDefaultColors } = useGlassColorMutations();
  const { createMutation: createThickness, deleteMutation: deleteThickness } = useGlassThicknessMutations();
  const { bulkUpsertMutation } = useGlassPriceMatrixMutations();

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, { cost: number; price: number }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Dialog states
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [thicknessDialogOpen, setThicknessDialogOpen] = useState(false);
  const [newColorForm, setNewColorForm] = useState({ name: '', slug: '', hex_color: '#E8F4F8' });
  const [newThicknessForm, setNewThicknessForm] = useState({ thickness: '', thickness_mm: 0 });

  // Set default selected type
  useEffect(() => {
    if (glassTypes?.length && !selectedTypeId) {
      setSelectedTypeId(glassTypes[0].id);
    }
  }, [glassTypes, selectedTypeId]);

  // Load existing prices into state
  useEffect(() => {
    if (priceMatrix) {
      const pricesMap: Record<string, { cost: number; price: number }> = {};
      priceMatrix.forEach((p) => {
        const key = `${p.glass_type_id}-${p.glass_color_id}-${p.glass_thickness_id}`;
        pricesMap[key] = { cost: Number(p.cost_per_sqm), price: Number(p.price_per_sqm) };
      });
      setPrices(pricesMap);
    }
  }, [priceMatrix]);

  const getPriceKey = (typeId: string, colorId: string, thicknessId: string) =>
    `${typeId}-${colorId}-${thicknessId}`;

  const handlePriceChange = (
    colorId: string,
    thicknessId: string,
    field: 'cost' | 'price',
    value: string
  ) => {
    if (!selectedTypeId) return;
    
    const numValue = parseFloat(value.replace(',', '.')) || 0;
    const key = getPriceKey(selectedTypeId, colorId, thicknessId);
    
    setPrices((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: numValue,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedTypeId || !glassColors || !glassThicknesses) return;

    const pricesToSave: Array<{
      glass_type_id: string;
      glass_color_id: string;
      glass_thickness_id: string;
      cost_per_sqm: number;
      price_per_sqm: number;
    }> = [];

    glassColors.forEach((color) => {
      glassThicknesses.forEach((thickness) => {
        const key = getPriceKey(selectedTypeId, color.id, thickness.id);
        const priceData = prices[key];
        if (priceData && (priceData.cost > 0 || priceData.price > 0)) {
          pricesToSave.push({
            glass_type_id: selectedTypeId,
            glass_color_id: color.id,
            glass_thickness_id: thickness.id,
            cost_per_sqm: priceData.cost || 0,
            price_per_sqm: priceData.price || 0,
          });
        }
      });
    });

    if (pricesToSave.length > 0) {
      await bulkUpsertMutation.mutateAsync(pricesToSave);
      setHasChanges(false);
    } else {
      toast.info('Nenhum preço para salvar');
    }
  };

  const handleCreateColor = async () => {
    if (!newColorForm.name || !newColorForm.slug) {
      toast.error('Preencha nome e slug');
      return;
    }
    await createColor.mutateAsync({
      name: newColorForm.name,
      slug: newColorForm.slug.toLowerCase().replace(/\s+/g, '_'),
      hex_color: newColorForm.hex_color,
    });
    setColorDialogOpen(false);
    setNewColorForm({ name: '', slug: '', hex_color: '#E8F4F8' });
  };

  const handleCreateThickness = async () => {
    if (!newThicknessForm.thickness || !newThicknessForm.thickness_mm) {
      toast.error('Preencha espessura e valor em mm');
      return;
    }
    await createThickness.mutateAsync({
      thickness: newThicknessForm.thickness,
      thickness_mm: newThicknessForm.thickness_mm,
    });
    setThicknessDialogOpen(false);
    setNewThicknessForm({ thickness: '', thickness_mm: 0 });
  };

  const handleInitializeColors = async () => {
    await initializeDefaultColors.mutateAsync();
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const isLoading = loadingTypes || loadingColors || loadingThicknesses || loadingPrices;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedType = glassTypes?.find((t) => t.id === selectedTypeId);
  const hasColors = glassColors && glassColors.length > 0;
  const hasThicknesses = glassThicknesses && glassThicknesses.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Preços de Vidros e Chaparias</h2>
          <p className="text-sm text-muted-foreground">
            Configure preços por m² para cada combinação de tipo, cor e espessura (vidros, espelhos, acrílicos, etc.)
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={bulkUpsertMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {bulkUpsertMutation.isPending ? 'Salvando...' : 'Salvar Preços'}
          </Button>
        )}
      </div>

      {/* Config section: Colors and Thicknesses */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Colors Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Cores de Vidro
                </CardTitle>
                <CardDescription>Cores disponíveis para precificação</CardDescription>
              </div>
              <div className="flex gap-2">
                {!hasColors && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInitializeColors}
                    disabled={initializeDefaultColors.isPending}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Inicializar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setColorDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasColors ? (
              <div className="flex flex-wrap gap-2">
                {glassColors.map((color) => (
                  <Badge
                    key={color.id}
                    variant="secondary"
                    className="gap-1 pr-1"
                    style={{
                      backgroundColor: color.hex_color || undefined,
                      color: color.hex_color && isLightColor(color.hex_color) ? '#000' : '#fff',
                    }}
                  >
                    {color.name}
                    <button
                      onClick={() => deleteColor.mutate(color.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma cor cadastrada. Clique em "Inicializar" para adicionar cores padrão.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Thicknesses Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Espessuras
                </CardTitle>
                <CardDescription>Espessuras de vidro disponíveis</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setThicknessDialogOpen(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {hasThicknesses ? (
              <div className="flex flex-wrap gap-2">
                {glassThicknesses.map((thickness) => (
                  <Badge key={thickness.id} variant="outline" className="gap-1 pr-1">
                    {thickness.thickness}
                    <button
                      onClick={() => deleteThickness.mutate(thickness.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma espessura cadastrada. Adicione as espessuras que você trabalha.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Price Matrix */}
      {hasColors && hasThicknesses && glassTypes && glassTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Matriz de Preços</CardTitle>
            <CardDescription>
              Selecione o tipo de vidro e defina os preços por m² para cada combinação de cor e espessura
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Glass Type Tabs */}
            <Tabs value={selectedTypeId || ''} onValueChange={setSelectedTypeId} className="w-full">
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                {glassTypes.map((type) => (
                  <TabsTrigger key={type.id} value={type.id}>
                    {type.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {glassTypes.map((type) => (
                <TabsContent key={type.id} value={type.id}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Cor</TableHead>
                          {glassThicknesses.map((thickness) => (
                            <TableHead key={thickness.id} className="text-center min-w-[120px]">
                              {thickness.thickness}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {glassColors.map((color) => (
                          <TableRow key={color.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full border"
                                  style={{ backgroundColor: color.hex_color || '#ccc' }}
                                />
                                {color.name}
                              </div>
                            </TableCell>
                            {glassThicknesses.map((thickness) => {
                              const key = getPriceKey(type.id, color.id, thickness.id);
                              const priceData = prices[key] || { cost: 0, price: 0 };
                              
                              return (
                                <TableCell key={thickness.id} className="p-1">
                                  <div className="flex flex-col gap-1">
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                        C:
                                      </span>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        className="h-8 text-xs pl-6 pr-2"
                                        value={priceData.cost ? formatCurrency(priceData.cost) : ''}
                                        onChange={(e) =>
                                          handlePriceChange(color.id, thickness.id, 'cost', e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                        V:
                                      </span>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        className="h-8 text-xs pl-6 pr-2"
                                        value={priceData.price ? formatCurrency(priceData.price) : ''}
                                        onChange={(e) =>
                                          handlePriceChange(color.id, thickness.id, 'price', e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>C: Custo/m²</span>
                    <span>V: Venda/m²</span>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Add Color Dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Cor de Vidro</DialogTitle>
            <DialogDescription>Adicione uma nova cor para precificação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="color-name">Nome</Label>
              <Input
                id="color-name"
                placeholder="Ex: Verde Esmeralda"
                value={newColorForm.name}
                onChange={(e) =>
                  setNewColorForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                    slug: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color-slug">Identificador (slug)</Label>
              <Input
                id="color-slug"
                placeholder="Ex: verde_esmeralda"
                value={newColorForm.slug}
                onChange={(e) => setNewColorForm((prev) => ({ ...prev, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color-hex">Cor Visual</Label>
              <div className="flex gap-2">
                <Input
                  id="color-hex"
                  type="color"
                  className="w-16 h-10 p-1"
                  value={newColorForm.hex_color}
                  onChange={(e) => setNewColorForm((prev) => ({ ...prev, hex_color: e.target.value }))}
                />
                <Input
                  value={newColorForm.hex_color}
                  onChange={(e) => setNewColorForm((prev) => ({ ...prev, hex_color: e.target.value }))}
                  placeholder="#E8F4F8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColorDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateColor} disabled={createColor.isPending}>
              {createColor.isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Thickness Dialog */}
      <Dialog open={thicknessDialogOpen} onOpenChange={setThicknessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Espessura</DialogTitle>
            <DialogDescription>Adicione uma nova espessura de vidro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thickness-name">Nome da Espessura</Label>
              <Input
                id="thickness-name"
                placeholder="Ex: 8mm"
                value={newThicknessForm.thickness}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewThicknessForm((prev) => ({
                    ...prev,
                    thickness: value,
                    thickness_mm: parseInt(value.replace(/\D/g, '')) || 0,
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thickness-mm">Valor em mm (para ordenação)</Label>
              <Input
                id="thickness-mm"
                type="number"
                placeholder="Ex: 8"
                value={newThicknessForm.thickness_mm || ''}
                onChange={(e) =>
                  setNewThicknessForm((prev) => ({ ...prev, thickness_mm: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThicknessDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateThickness} disabled={createThickness.isPending}>
              {createThickness.isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to determine if a color is light
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}
