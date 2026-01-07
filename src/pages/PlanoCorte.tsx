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

// Evaluate a formula like "Altura - 20" or "(Largura - 136) / 2"
function evaluateFormula(formula: string, width: number, height: number): number {
  try {
    const normalized = formula
      .replace(/Largura/gi, width.toString())
      .replace(/Altura/gi, height.toString())
      .replace(/L/g, width.toString())
      .replace(/A/g, height.toString());
    
    const result = new Function(`return ${normalized}`)();
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

  // Calculate cuts
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
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #1e3a5f; color: white; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle; }
            .profile-cell { display: flex; align-items: center; gap: 10px; }
            .profile-img { width: 60px; height: 40px; background: #f0f0f0; border: 1px solid #ddd; }
            .profile-img img { width: 100%; height: 100%; object-fit: contain; }
            .angle-box { display: inline-flex; gap: 5px; }
            .angle { background: #1e3a5f; color: white; padding: 5px 12px; font-size: 12px; }
            .position { display: flex; align-items: center; gap: 8px; }
            .position-dot { width: 10px; height: 10px; border-radius: 50%; }
            .position-altura { background: #3b82f6; }
            .position-largura { background: #f59e0b; }
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
                  <div class="dim-label">Largura</div>
                  <div class="dim-box"><span class="dim-value">${width}</span></div>
                </div>
                <div>
                  <div class="dim-label">Altura</div>
                  <div class="dim-box"><span class="dim-value">${height}</span></div>
                </div>
              </div>
              <div>
                <div class="dim-label">Quantidade</div>
                <div class="dim-box"><span class="dim-value">${quantity}</span></div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>PERFIL</th>
                <th>MEDIDA (mm)</th>
                <th>QUANTIDADE</th>
                <th>ÂNGULO DE CORTE</th>
                <th>POSIÇÃO</th>
              </tr>
            </thead>
            <tbody>
              ${calculatedCuts.map(cut => `
                <tr>
                  <td>
                    <div class="profile-cell">
                      <div class="profile-img">
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
                <Label>Largura</Label>
                <Input 
                  type="number" 
                  value={width} 
                  onChange={e => setWidth(Number(e.target.value))}
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Altura</Label>
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
            {/* Cut Table */}
            {calculatedCuts.length > 0 ? (
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
            ) : (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                {selectedProduct 
                  ? 'Nenhum perfil cadastrado para este produto.'
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
