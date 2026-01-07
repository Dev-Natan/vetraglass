import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Scissors, Plus, Calculator, Ruler, Package, ChevronRight, RotateCcw, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Tradução de categorias
const categoryLabels: Record<string, string> = {
  window: 'Janela',
  door: 'Porta',
  facade: 'Fachada',
  shower: 'Box de Banheiro',
  mirror: 'Espelho',
  partition: 'Divisória',
  other: 'Outros',
};

const translateCategory = (category: string) => categoryLabels[category] || category;

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
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [width, setWidth] = useState<number>(1200);
  const [height, setHeight] = useState<number>(1400);
  const [quantity, setQuantity] = useState<number>(1);
  const [barLength, setBarLength] = useState<number>(6000);
  const [showResults, setShowResults] = useState(false);

  // Fetch product templates (global templates)
  const { data: productTemplates } = useQuery({
    queryKey: ['product-templates-for-cutting'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select(`
          id,
          name,
          category,
          linha,
          min_width,
          max_width,
          min_height,
          max_height
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Get unique linhas from products
  const availableLinhas = useMemo(() => {
    if (!productTemplates) return [];
    const linhas = new Set<string>();
    productTemplates.forEach(p => {
      if (p.linha) linhas.add(p.linha);
    });
    return Array.from(linhas).sort();
  }, [productTemplates]);

  // Get unique categories filtered by selected linha
  const availableCategories = useMemo(() => {
    if (!productTemplates) return [];
    const categories = new Set<string>();
    productTemplates
      .filter(p => !selectedLinha || p.linha === selectedLinha)
      .forEach(p => {
        if (p.category) categories.add(p.category);
      });
    return Array.from(categories).sort();
  }, [productTemplates, selectedLinha]);

  // Get products filtered by linha and category
  const filteredProducts = useMemo(() => {
    if (!productTemplates) return [];
    return productTemplates.filter(p => {
      if (selectedLinha && p.linha !== selectedLinha) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      return true;
    });
  }, [productTemplates, selectedLinha, selectedCategory]);

  // Reset dependent filters when parent changes
  const handleLinhaChange = (value: string) => {
    setSelectedLinha(value);
    setSelectedCategory('');
    setSelectedProduct('');
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedProduct('');
  };

  // Fetch product template items for selected product
  const { data: productItems } = useQuery({
    queryKey: ['product-template-items', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          id,
          quantity_formula,
          pieces_quantity,
          cut_angle,
          is_optional,
          item_templates (
            id,
            name,
            type,
            image_url
          )
        `)
        .eq('product_template_id', selectedProduct);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProduct
  });

  // Calculate cuts based on dimensions
  const calculatedCuts = useMemo((): CutPiece[] => {
    if (!productItems || productItems.length === 0) return [];

    return productItems
      .filter(item => item.item_templates?.type === 'profile')
      .map(item => {
        // pieces_quantity = número de peças do perfil por unidade de produto
        // quantity = número de produtos (janelas/portas)
        // Total de peças = pieces_quantity × quantity
        const piecesPerProduct = (item as any).pieces_quantity || 1;
        const totalPieces = piecesPerProduct * quantity;
        
        return {
          profileName: item.item_templates?.name || 'Perfil',
          formula: item.quantity_formula,
          calculatedLength: evaluateFormula(item.quantity_formula, width, height),
          quantity: totalPieces,
          cutAngle: item.cut_angle
        };
      });
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

  const handlePrint = () => {
    const printContent = document.getElementById('plano-corte-print');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Plano de Corte - ${selectedProductData?.name || 'Produto'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a1a; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; margin: 20px 0 10px; border-bottom: 2px solid #333; padding-bottom: 5px; }
            .header { margin-bottom: 20px; }
            .info { font-size: 14px; color: #666; margin-bottom: 4px; }
            .stats { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .stat { background: #f5f5f5; padding: 15px; border-radius: 8px; min-width: 120px; }
            .stat-value { font-size: 24px; font-weight: bold; }
            .stat-label { font-size: 12px; color: #666; }
            .cut-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
            .cut-name { font-weight: 500; }
            .cut-details { color: #666; font-size: 12px; }
            .cut-length { font-weight: bold; font-size: 18px; }
            .cut-qty { font-size: 12px; color: #666; }
            .bar { margin-bottom: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .bar-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .bar-visual { height: 30px; background: #e5e5e5; border-radius: 4px; display: flex; overflow: hidden; margin-bottom: 8px; }
            .bar-piece { background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; border-right: 1px solid white; }
            .bar-waste { background: #f87171; }
            .bar-pieces-list { font-size: 12px; color: #666; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Plano de Corte</h1>
            <p class="info"><strong>Produto:</strong> ${selectedProductData?.name || '-'}</p>
            <p class="info"><strong>Dimensões:</strong> ${width}mm x ${height}mm</p>
            <p class="info"><strong>Quantidade:</strong> ${quantity} unidade(s)</p>
            <p class="info"><strong>Comprimento da barra:</strong> ${barLength}mm</p>
            <p class="info"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          <div class="stats">
            <div class="stat">
              <div class="stat-value">${totalPieces}</div>
              <div class="stat-label">Peças totais</div>
            </div>
            <div class="stat">
              <div class="stat-value">${totalBars}</div>
              <div class="stat-label">Barras necessárias</div>
            </div>
            <div class="stat">
              <div class="stat-value">${avgUtilization.toFixed(1)}%</div>
              <div class="stat-label">Aproveitamento</div>
            </div>
            <div class="stat">
              <div class="stat-value">${(totalWaste / 1000).toFixed(2)}m</div>
              <div class="stat-label">Sobra total</div>
            </div>
          </div>

          <h2>Lista de Cortes</h2>
          ${calculatedCuts.map((cut, i) => `
            <div class="cut-item">
              <div>
                <div class="cut-name">${i + 1}. ${cut.profileName}</div>
                <div class="cut-details">Fórmula: ${cut.formula} | Ângulo: ${cut.cutAngle}°</div>
              </div>
              <div style="text-align: right;">
                <div class="cut-length">${cut.calculatedLength} mm</div>
                <div class="cut-qty">${cut.quantity}x peças</div>
              </div>
            </div>
          `).join('')}

          <h2>Otimização por Barra</h2>
          ${optimizedBars.map((bar, i) => `
            <div class="bar">
              <div class="bar-header">
                <strong>Barra ${i + 1}</strong>
                <span>Aproveitamento: ${(100 - bar.wastePercent).toFixed(1)}% | Sobra: ${bar.wasteLength}mm</span>
              </div>
              <div class="bar-visual">
                ${bar.pieces.map(p => `
                  <div class="bar-piece" style="width: ${(p.length / bar.barLength) * 100}%">${p.length}</div>
                `).join('')}
                ${bar.wasteLength > 0 ? `<div class="bar-piece bar-waste" style="width: ${(bar.wasteLength / bar.barLength) * 100}%">${bar.wasteLength}</div>` : ''}
              </div>
              <div class="bar-pieces-list">
                ${bar.pieces.map(p => `${p.profileName}: ${p.length}mm`).join(' | ')}
              </div>
            </div>
          `).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const selectedProductData = productTemplates?.find(p => p.id === selectedProduct);

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
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={handlePrint}>
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
                Novo Cálculo
              </Button>
            </div>
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
              {/* Filters: Linha → Categoria → Produto */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Linha</Label>
                  <Select value={selectedLinha} onValueChange={handleLinhaChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a linha" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLinhas.map(linha => (
                        <SelectItem key={linha} value={linha}>
                          {linha}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={handleCategoryChange}
                    disabled={!selectedLinha}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {translateCategory(category)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select 
                    value={selectedProduct} 
                    onValueChange={setSelectedProduct}
                    disabled={!selectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProducts.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                        min={selectedProductData?.min_width || 300}
                        max={selectedProductData?.max_width || 3000}
                      />
                      {selectedProductData?.min_width && (
                        <p className="text-xs text-muted-foreground">
                          Min: {selectedProductData.min_width}mm | 
                          Max: {selectedProductData.max_width}mm
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Altura (mm)</Label>
                      <Input 
                        type="number" 
                        value={height} 
                        onChange={e => setHeight(Number(e.target.value))}
                        min={selectedProductData?.min_height || 300}
                        max={selectedProductData?.max_height || 3000}
                      />
                      {selectedProductData?.min_height && (
                        <p className="text-xs text-muted-foreground">
                          Min: {selectedProductData.min_height}mm | 
                          Max: {selectedProductData.max_height}mm
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
                  Lista de Cortes - {selectedProductData?.name}
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
