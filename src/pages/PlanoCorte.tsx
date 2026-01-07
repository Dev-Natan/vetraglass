import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Scissors, Plus, Calculator, Ruler, Package, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CutPiece {
  profileName: string;
  formula: string;
  calculatedLength: number;
  quantity: number;
  cutAngle: number;
}

interface BarOptimization {
  barLength: number;
  pieces: { profileName: string; length: number }[];
  usedLength: number;
  wasteLength: number;
  wastePercent: number;
}

// Evaluate a formula like "Altura - 20" or "(Largura - 136) / 2"
function evaluateFormula(formula: string, width: number, height: number): number {
  try {
    const normalized = formula
      .replace(/Largura/gi, width.toString())
      .replace(/Altura/gi, height.toString())
      .replace(/L/g, width.toString())
      .replace(/A/g, height.toString());
    
    // Safe evaluation using Function constructor
    const result = new Function(`return ${normalized}`)();
    return Math.round(result * 100) / 100;
  } catch {
    return 0;
  }
}

// Simple First Fit Decreasing algorithm for 1D bin packing
function optimizeCutting(pieces: CutPiece[], barLength: number = 6000): BarOptimization[] {
  // Expand pieces by quantity
  const allPieces: { profileName: string; length: number }[] = [];
  pieces.forEach(piece => {
    for (let i = 0; i < piece.quantity; i++) {
      allPieces.push({ profileName: piece.profileName, length: piece.calculatedLength });
    }
  });

  // Sort descending by length
  allPieces.sort((a, b) => b.length - a.length);

  const bars: BarOptimization[] = [];

  allPieces.forEach(piece => {
    // Find first bar that can fit this piece
    let placed = false;
    for (const bar of bars) {
      if (bar.usedLength + piece.length <= barLength) {
        bar.pieces.push(piece);
        bar.usedLength += piece.length;
        bar.wasteLength = barLength - bar.usedLength;
        bar.wastePercent = (bar.wasteLength / barLength) * 100;
        placed = true;
        break;
      }
    }

    // If no bar can fit, create new bar
    if (!placed) {
      bars.push({
        barLength,
        pieces: [piece],
        usedLength: piece.length,
        wasteLength: barLength - piece.length,
        wastePercent: ((barLength - piece.length) / barLength) * 100
      });
    }
  });

  return bars;
}

export default function PlanoCorte() {
  const { currentCompany } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [width, setWidth] = useState<number>(1200);
  const [height, setHeight] = useState<number>(1400);
  const [quantity, setQuantity] = useState<number>(1);
  const [barLength, setBarLength] = useState<number>(6000);
  const [showResults, setShowResults] = useState(false);

  // Fetch company products
  const { data: companyProducts } = useQuery({
    queryKey: ['company-products-for-cutting', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select(`
          id,
          commercial_name,
          product_template_id,
          product_templates (
            id,
            name,
            category,
            min_width,
            max_width,
            min_height,
            max_height
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id
  });

  // Fetch product template items for selected product
  const { data: productItems } = useQuery({
    queryKey: ['product-template-items', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      // Get the product_template_id from company_products
      const companyProduct = companyProducts?.find(p => p.id === selectedProduct);
      if (!companyProduct) return [];
      
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          id,
          quantity_formula,
          cut_angle,
          is_optional,
          item_templates (
            id,
            name,
            type,
            image_url
          )
        `)
        .eq('product_template_id', companyProduct.product_template_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProduct && !!companyProducts
  });

  // Calculate cuts based on dimensions
  const calculatedCuts = useMemo((): CutPiece[] => {
    if (!productItems || productItems.length === 0) return [];

    return productItems
      .filter(item => item.item_templates?.type === 'profile')
      .map(item => ({
        profileName: item.item_templates?.name || 'Perfil',
        formula: item.quantity_formula,
        calculatedLength: evaluateFormula(item.quantity_formula, width, height),
        quantity: quantity,
        cutAngle: item.cut_angle
      }));
  }, [productItems, width, height, quantity]);

  // Optimize cutting
  const optimizedBars = useMemo(() => {
    if (!showResults || calculatedCuts.length === 0) return [];
    return optimizeCutting(calculatedCuts, barLength);
  }, [calculatedCuts, barLength, showResults]);

  // Stats
  const totalPieces = calculatedCuts.reduce((sum, c) => sum + c.quantity, 0);
  const totalBars = optimizedBars.length;
  const avgUtilization = optimizedBars.length > 0
    ? 100 - (optimizedBars.reduce((sum, b) => sum + b.wastePercent, 0) / optimizedBars.length)
    : 0;
  const totalWaste = optimizedBars.reduce((sum, b) => sum + b.wasteLength, 0);

  const handleCalculate = () => {
    setShowResults(true);
  };

  const handleReset = () => {
    setShowResults(false);
    setSelectedProduct('');
    setWidth(1200);
    setHeight(1400);
    setQuantity(1);
  };

  const selectedProductData = companyProducts?.find(p => p.id === selectedProduct);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Scissors className="w-7 h-7 text-primary" />
              Plano de Corte
            </h1>
            <p className="text-muted-foreground">Otimização de corte de perfis de alumínio</p>
          </div>
          {showResults && (
            <Button variant="outline" className="gap-2" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
              Novo Cálculo
            </Button>
          )}
        </div>

        {/* Input Form */}
        {!showResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Calcular Cortes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyProducts?.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.commercial_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProduct && (
                <>
                  {/* Dimensions */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Largura (mm)</Label>
                      <Input 
                        type="number" 
                        value={width} 
                        onChange={e => setWidth(Number(e.target.value))}
                        min={selectedProductData?.product_templates?.min_width || 300}
                        max={selectedProductData?.product_templates?.max_width || 3000}
                      />
                      {selectedProductData?.product_templates?.min_width && (
                        <p className="text-xs text-muted-foreground">
                          Min: {selectedProductData.product_templates.min_width}mm | 
                          Max: {selectedProductData.product_templates.max_width}mm
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Altura (mm)</Label>
                      <Input 
                        type="number" 
                        value={height} 
                        onChange={e => setHeight(Number(e.target.value))}
                        min={selectedProductData?.product_templates?.min_height || 300}
                        max={selectedProductData?.product_templates?.max_height || 3000}
                      />
                      {selectedProductData?.product_templates?.min_height && (
                        <p className="text-xs text-muted-foreground">
                          Min: {selectedProductData.product_templates.min_height}mm | 
                          Max: {selectedProductData.product_templates.max_height}mm
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quantity and Bar Length */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantidade de Peças</Label>
                      <Input 
                        type="number" 
                        value={quantity} 
                        onChange={e => setQuantity(Number(e.target.value))}
                        min={1}
                        max={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Comprimento da Barra (mm)</Label>
                      <Select value={barLength.toString()} onValueChange={v => setBarLength(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5000">5.000 mm (5m)</SelectItem>
                          <SelectItem value="6000">6.000 mm (6m)</SelectItem>
                          <SelectItem value="6500">6.500 mm (6.5m)</SelectItem>
                          <SelectItem value="7000">7.000 mm (7m)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Preview of formulas */}
                  {calculatedCuts.length > 0 && (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <Ruler className="w-4 h-4" />
                        Prévia dos Cortes
                      </h4>
                      <div className="space-y-2">
                        {calculatedCuts.map((cut, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{cut.profileName}</span>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-background px-2 py-1 rounded">
                                {cut.formula}
                              </code>
                              <ChevronRight className="w-3 h-3 text-muted-foreground" />
                              <Badge variant="secondary">{cut.calculatedLength} mm</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full gap-2" 
                    size="lg"
                    onClick={handleCalculate}
                    disabled={calculatedCuts.length === 0}
                  >
                    <Scissors className="w-4 h-4" />
                    Calcular Plano de Corte
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {showResults && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold">{totalPieces}</p>
                      <p className="text-xs text-muted-foreground">Peças totais</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-action-blue/20 flex items-center justify-center">
                      <Ruler className="w-5 h-5 text-action-blue" />
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold">{totalBars}</p>
                      <p className="text-xs text-muted-foreground">Barras necessárias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-action-green/20 flex items-center justify-center">
                      <Scissors className="w-5 h-5 text-action-green" />
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold">{avgUtilization.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Aproveitamento</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-action-orange/20 flex items-center justify-center">
                      <Ruler className="w-5 h-5 text-action-orange" />
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold">{(totalWaste / 1000).toFixed(2)}m</p>
                      <p className="text-xs text-muted-foreground">Sobra total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cut List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="w-5 h-5" />
                  Lista de Cortes - {selectedProductData?.commercial_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {calculatedCuts.map((cut, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{cut.profileName}</p>
                          <p className="text-xs text-muted-foreground">
                            Fórmula: {cut.formula} | Ângulo: {cut.cutAngle}°
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{cut.calculatedLength} mm</p>
                        <p className="text-xs text-muted-foreground">
                          {cut.quantity}x peças
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bar Optimization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="w-5 h-5" />
                  Otimização de Barras ({barLength / 1000}m)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {optimizedBars.map((bar, barIndex) => (
                    <div key={barIndex} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Barra {barIndex + 1}</span>
                        <span className="text-muted-foreground">
                          Aproveitamento: {(100 - bar.wastePercent).toFixed(1)}% | 
                          Sobra: {bar.wasteLength}mm
                        </span>
                      </div>
                      
                      {/* Visual bar representation */}
                      <div className="h-10 bg-muted rounded-lg overflow-hidden flex">
                        {bar.pieces.map((piece, pieceIndex) => {
                          const widthPercent = (piece.length / bar.barLength) * 100;
                          // Alternate colors
                          const colors = [
                            'bg-primary',
                            'bg-action-blue',
                            'bg-action-green',
                            'bg-action-purple',
                            'bg-action-orange'
                          ];
                          const colorClass = colors[pieceIndex % colors.length];
                          
                          return (
                            <div
                              key={pieceIndex}
                              className={`${colorClass} h-full flex items-center justify-center text-xs text-white font-medium border-r border-background`}
                              style={{ width: `${widthPercent}%` }}
                              title={`${piece.profileName}: ${piece.length}mm`}
                            >
                              {widthPercent > 8 && `${piece.length}`}
                            </div>
                          );
                        })}
                        {/* Waste */}
                        <div 
                          className="bg-destructive/30 h-full flex items-center justify-center text-xs text-destructive font-medium"
                          style={{ width: `${bar.wastePercent}%` }}
                        >
                          {bar.wastePercent > 5 && 'Sobra'}
                        </div>
                      </div>

                      {/* Pieces legend */}
                      <div className="flex flex-wrap gap-2">
                        {bar.pieces.map((piece, pieceIndex) => (
                          <Badge key={pieceIndex} variant="outline" className="text-xs">
                            {piece.profileName}: {piece.length}mm
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
