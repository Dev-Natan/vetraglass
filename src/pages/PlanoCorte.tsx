import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

// Tradução de categorias
const categoryLabels: Record<string, string> = {
  window: 'Janela',
  door: 'Porta',
  facade: 'Fachada',
  shower: 'Box de Banheiro',
  mirror: 'Espelho',
  partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo',
  other: 'Outros',
};

const translateCategory = (category: string) => categoryLabels[category] || category;

interface CutItem {
  id: string;
  profileName: string;
  imageUrl: string | null;
  formula: string;
  calculatedLength: number;
  quantity: number;
  cutAngle: number;
  position: 'Altura' | 'Largura';
}

interface GlassCutItem {
  id: string;
  glassName: string;
  imageUrl: string | null;
  widthFormula: string | null;
  heightFormula: string | null;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
}

// Evaluate a formula like "Altura - 20" or "(Largura - 136) / 2"
function evaluateFormula(formula: string, width: number, height: number): number {
  try {
    // Use safe math expression parser to prevent code injection
    const { Parser } = require('expr-eval');
    const parser = new Parser();
    
    // Normalize variable names to safe single-letter variables
    const normalized = formula
      .replace(/Largura/gi, 'W')
      .replace(/Altura/gi, 'H')
      .replace(/\bL\b/g, 'W')
      .replace(/\bA\b/g, 'H');
    
    const expr = parser.parse(normalized);
    const result = expr.evaluate({ W: width, H: height });
    return Math.round(result);
  } catch {
    return 0;
  }
}

// Detect if formula uses Altura or Largura
function getFormulaPosition(formula: string): 'Altura' | 'Largura' {
  const lower = formula.toLowerCase();
  if (lower.includes('altura')) return 'Altura';
  return 'Largura';
}

// Get storage URL helper
const getStorageUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/item-templates/${path}`;
};

export default function PlanoCorte() {
  const navigate = useNavigate();
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [width, setWidth] = useState<number>(1000);
  const [height, setHeight] = useState<number>(1000);
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'pendente' | 'fabricado'>('pendente');

  // Fetch product templates
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
          image_url,
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

  // Get unique linhas
  const availableLinhas = useMemo(() => {
    if (!productTemplates) return [];
    const linhas = new Set<string>();
    productTemplates.forEach(p => {
      if (p.linha) linhas.add(p.linha);
    });
    return Array.from(linhas).sort();
  }, [productTemplates]);

  // Get unique categories filtered by linha
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

  // Reset dependent filters
  const handleLinhaChange = (value: string) => {
    setSelectedLinha(value);
    setSelectedCategory('');
    setSelectedProduct('');
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedProduct('');
  };

  // Fetch product template items
  const { data: productItems } = useQuery({
    queryKey: ['product-template-items-cutting', selectedProduct],
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
          notes,
          width_formula,
          height_formula,
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

  // Calculate profile cuts
  const calculatedCuts = useMemo((): CutItem[] => {
    if (!productItems || productItems.length === 0) return [];

    return productItems
      .filter(item => item.item_templates?.type === 'profile')
      .map(item => {
        const piecesPerProduct = (item as any).pieces_quantity || 1;
        const totalPieces = piecesPerProduct * quantity;
        const position = getFormulaPosition(item.quantity_formula);
        
        return {
          id: item.id,
          profileName: item.item_templates?.name || 'Perfil',
          imageUrl: item.item_templates?.image_url || null,
          formula: item.quantity_formula,
          calculatedLength: evaluateFormula(item.quantity_formula, width, height),
          quantity: totalPieces,
          cutAngle: item.cut_angle,
          position
        };
      });
  }, [productItems, width, height, quantity]);

  // Calculate glass cuts
  const calculatedGlassCuts = useMemo((): GlassCutItem[] => {
    if (!productItems || productItems.length === 0) return [];

    return productItems
      .filter(item => item.item_templates?.type === 'glass')
      .map(item => {
        const widthF = (item as any).width_formula || 'Largura';
        const heightF = (item as any).height_formula || 'Altura';
        const calcWidth = evaluateFormula(widthF, width, height);
        const calcHeight = evaluateFormula(heightF, width, height);
        const areaM2 = (calcWidth * calcHeight) / 1000000;
        
        return {
          id: item.id,
          glassName: item.item_templates?.name || 'Vidro',
          imageUrl: item.item_templates?.image_url || null,
          widthFormula: (item as any).width_formula,
          heightFormula: (item as any).height_formula,
          calculatedWidth: calcWidth,
          calculatedHeight: calcHeight,
          areaM2: areaM2,
          quantity: quantity
        };
      });
  }, [productItems, width, height, quantity]);

  const selectedProductData = productTemplates?.find(p => p.id === selectedProduct);

  const handlePrint = () => {
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
            .header { display: flex; gap: 30px; margin-bottom: 30px; align-items: flex-start; }
            .product-image { width: 150px; height: 150px; background: #f0f0f0; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; }
            .product-image img { max-width: 100%; max-height: 100%; }
            .product-info h1 { font-size: 20px; margin-bottom: 15px; text-transform: uppercase; }
            .dimensions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
            .dim-box { background: #f5f5f5; padding: 8px 15px; border-radius: 4px; }
            .dim-label { font-size: 11px; color: #666; }
            .dim-value { font-size: 16px; font-weight: bold; }
            .section-title { font-size: 14px; font-weight: bold; margin: 25px 0 10px 0; display: flex; align-items: center; gap: 8px; }
            .section-dot { width: 12px; height: 12px; border-radius: 3px; }
            .section-dot-glass { background: #9333ea; }
            .section-dot-profile { background: #1e3a5f; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: white; }
            th.glass { background: #9333ea; }
            th.profile { background: #1e3a5f; }
            td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle; }
            .item-cell { display: flex; align-items: center; gap: 10px; }
            .item-img { width: 60px; height: 40px; background: #f0f0f0; border: 1px solid #ddd; }
            .item-img img { width: 100%; height: 100%; object-fit: contain; }
            .formula-tag { font-size: 9px; padding: 2px 6px; border-radius: 3px; margin-right: 4px; }
            .formula-width { background: #dcfce7; color: #166534; }
            .formula-height { background: #dbeafe; color: #1e40af; }
            .angle-box { display: inline-flex; gap: 5px; }
            .angle { background: #1e3a5f; color: white; padding: 5px 12px; font-size: 12px; }
            .position { display: flex; align-items: center; gap: 8px; }
            .position-dot { width: 10px; height: 10px; border-radius: 50%; }
            .position-altura { background: #3b82f6; }
            .position-largura { background: #f59e0b; }
            .value-green { color: #16a34a; font-weight: bold; }
            .value-blue { color: #2563eb; font-weight: bold; }
            .value-purple { color: #9333ea; font-weight: bold; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="product-image">
              ${selectedProductData?.image_url ? `<img src="${getStorageUrl(selectedProductData.image_url)}" alt="${selectedProductData.name}" />` : '<span style="color:#999">🪟</span>'}
            </div>
            <div class="product-info">
              <h1>${selectedProductData?.name || '-'}</h1>
              <div class="dimensions">
                <div>
                  <div class="dim-label">Largura do Vão</div>
                  <div class="dim-box"><span class="dim-value">${width}</span></div>
                </div>
                <div>
                  <div class="dim-label">Altura do Vão</div>
                  <div class="dim-box"><span class="dim-value">${height}</span></div>
                </div>
              </div>
              <div>
                <div class="dim-label">Quantidade</div>
                <div class="dim-box"><span class="dim-value">${quantity}</span></div>
              </div>
            </div>
          </div>

          ${calculatedGlassCuts.length > 0 ? `
            <div class="section-title">
              <span class="section-dot section-dot-glass"></span>
              Vidros
            </div>
            <table>
              <thead>
                <tr>
                  <th class="glass">VIDRO</th>
                  <th class="glass">LARGURA (mm)</th>
                  <th class="glass">ALTURA (mm)</th>
                  <th class="glass">ÁREA (m²)</th>
                  <th class="glass">QUANTIDADE</th>
                </tr>
              </thead>
              <tbody>
                ${calculatedGlassCuts.map(glass => `
                  <tr>
                    <td>
                      <div class="item-cell">
                        <div class="item-img">
                          ${glass.imageUrl ? `<img src="${getStorageUrl(glass.imageUrl)}" alt="${glass.glassName}" />` : '🪟'}
                        </div>
                        <div>
                          <strong>${glass.glassName}</strong>
                          <div style="margin-top: 4px;">
                            ${glass.widthFormula ? `<span class="formula-tag formula-width">L: ${glass.widthFormula}</span>` : ''}
                            ${glass.heightFormula ? `<span class="formula-tag formula-height">A: ${glass.heightFormula}</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="value-green">${glass.calculatedWidth}</td>
                    <td class="value-blue">${glass.calculatedHeight}</td>
                    <td class="value-purple">${glass.areaM2.toFixed(3)}</td>
                    <td>${glass.quantity}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${calculatedCuts.length > 0 ? `
            <div class="section-title">
              <span class="section-dot section-dot-profile"></span>
              Perfis de Alumínio
            </div>
            <table>
              <thead>
                <tr>
                  <th class="profile">PERFIL</th>
                  <th class="profile">MEDIDA (mm)</th>
                  <th class="profile">QUANTIDADE</th>
                  <th class="profile">ÂNGULO DE CORTE</th>
                  <th class="profile">POSIÇÃO</th>
                </tr>
              </thead>
              <tbody>
                ${calculatedCuts.map(cut => `
                  <tr>
                    <td>
                      <div class="item-cell">
                        <div class="item-img">
                          ${cut.imageUrl ? `<img src="${getStorageUrl(cut.imageUrl)}" alt="${cut.profileName}" />` : ''}
                        </div>
                        <strong>${cut.profileName}</strong>
                      </div>
                    </td>
                    <td><strong>${cut.calculatedLength}</strong></td>
                    <td>${cut.quantity}</td>
                    <td>
                      <div class="angle-box">
                        <span class="angle">${cut.cutAngle}°</span>
                        <span class="angle">${cut.cutAngle}°</span>
                      </div>
                    </td>
                    <td>
                      <div class="position">
                        <span class="position-dot position-${cut.position.toLowerCase()}"></span>
                        ${cut.position}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          <p style="margin-top: 30px; text-align: center; font-size: 11px; color: #999;">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
          </p>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Use setTimeout to avoid blocking the main thread
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 100);
    };
    
    // Fallback if onload doesn't fire (some browsers)
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlePrint} disabled={!selectedProduct || calculatedCuts.length === 0}>
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>

        {/* Product Selection & Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Image */}
          <div className="flex justify-center">
            <div className="w-full max-w-[250px] aspect-square bg-muted rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              {selectedProductData?.image_url ? (
                <img 
                  src={getStorageUrl(selectedProductData.image_url)} 
                  alt={selectedProductData.name}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-6xl text-muted-foreground/30">🪟</div>
              )}
            </div>
          </div>

          {/* Product Selection & Dimensions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
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
                    <SelectValue placeholder="Selecione" />
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
                    <SelectValue placeholder="Selecione" />
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

            {/* Product Name */}
            {selectedProductData && (
              <h2 className="text-xl font-bold uppercase text-foreground">
                {selectedProductData.name}
              </h2>
            )}

            {/* Dimensions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Largura do Vão</Label>
                <Input 
                  type="number" 
                  value={width} 
                  onChange={e => setWidth(Number(e.target.value))}
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Altura do Vão</Label>
                <Input 
                  type="number" 
                  value={height} 
                  onChange={e => setHeight(Number(e.target.value))}
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(Number(e.target.value))}
                  min={1}
                  className="bg-muted"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pendente' | 'fabricado')}>
          <TabsList className="w-auto">
            <TabsTrigger value="pendente" className="px-8">
              Pendente
            </TabsTrigger>
            <TabsTrigger value="fabricado" className="px-8">
              Fabricado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendente" className="mt-4">
            {/* Glass Cut Table */}
            {calculatedGlassCuts.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-500"></span>
                  Vidros
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-purple-600 hover:bg-purple-600">
                        <TableHead className="text-white font-bold">VIDRO</TableHead>
                        <TableHead className="text-white font-bold text-center">LARGURA (mm)</TableHead>
                        <TableHead className="text-white font-bold text-center">ALTURA (mm)</TableHead>
                        <TableHead className="text-white font-bold text-center">ÁREA (m²)</TableHead>
                        <TableHead className="text-white font-bold text-center">QUANTIDADE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedGlassCuts.map((glass) => (
                        <TableRow key={glass.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-12 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800 flex items-center justify-center overflow-hidden">
                                {glass.imageUrl ? (
                                  <img 
                                    src={getStorageUrl(glass.imageUrl)} 
                                    alt={glass.glassName}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="text-purple-400 text-lg">🪟</span>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">{glass.glassName}</span>
                                {(glass.widthFormula || glass.heightFormula) && (
                                  <div className="flex gap-2 mt-1">
                                    {glass.widthFormula && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                        L: {glass.widthFormula}
                                      </span>
                                    )}
                                    {glass.heightFormula && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        A: {glass.heightFormula}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold text-lg text-green-600">{glass.calculatedWidth}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold text-lg text-blue-600">{glass.calculatedHeight}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold text-lg text-purple-600">{glass.areaM2.toFixed(3)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {glass.quantity}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Profile Cut Table */}
            {calculatedCuts.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-primary"></span>
                  Perfis de Alumínio
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary hover:bg-primary">
                        <TableHead className="text-primary-foreground font-bold">PERFIL</TableHead>
                        <TableHead className="text-primary-foreground font-bold text-center">MEDIDA (mm)</TableHead>
                        <TableHead className="text-primary-foreground font-bold text-center">QUANTIDADE</TableHead>
                        <TableHead className="text-primary-foreground font-bold text-center">ÂNGULO DE CORTE</TableHead>
                        <TableHead className="text-primary-foreground font-bold text-center">POSIÇÃO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedCuts.map((cut) => (
                        <TableRow key={cut.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center overflow-hidden">
                                {cut.imageUrl ? (
                                  <img 
                                    src={getStorageUrl(cut.imageUrl)} 
                                    alt={cut.profileName}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">📦</span>
                                )}
                              </div>
                              <span className="font-medium">{cut.profileName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-lg">
                            {cut.calculatedLength}
                          </TableCell>
                          <TableCell className="text-center">
                            {cut.quantity}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex gap-1">
                              <span className="bg-foreground text-background px-3 py-1 text-sm font-medium">
                                {cut.cutAngle}°
                              </span>
                              <span className="bg-foreground text-background px-3 py-1 text-sm font-medium">
                                {cut.cutAngle}°
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${
                                cut.position === 'Altura' ? 'bg-blue-500' : 'bg-amber-500'
                              }`} />
                              <span>{cut.position}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {calculatedCuts.length === 0 && calculatedGlassCuts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                {selectedProduct 
                  ? 'Nenhum item cadastrado para este produto.'
                  : 'Selecione uma linha, categoria e produto para ver o plano de corte.'
                }
              </div>
            )}
          </TabsContent>

          <TabsContent value="fabricado" className="mt-4">
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              Nenhum item fabricado ainda.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
