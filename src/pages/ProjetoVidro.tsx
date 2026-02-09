import { useState, useMemo } from 'react';
import { resolveImageUrl } from '@/utils/imageUrl';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Printer, Save, FileDown, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GlassProjectCanvas } from '@/components/projeto-vidro/GlassProjectCanvas';
import { PiecesTable } from '@/components/projeto-vidro/PiecesTable';
import { ProductInfoHeader } from '@/components/projeto-vidro/ProductInfoHeader';
import { SaveProjectDialog } from '@/components/projeto-vidro/SaveProjectDialog';
import { Hole, Cutout } from '@/components/projeto-vidro/HoleCutoutEditor';
import { generateGlassProjectPdf } from '@/utils/generateGlassProjectPdf';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';
import { toast } from 'sonner';

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

export interface GlassPanelData {
  id: string;
  letter: string;
  name: string;
  width: number;
  height: number;
  widthFormula: string | null;
  heightFormula: string | null;
  quantity: number;
  row: number;
  col: number;
}

// Get storage URL helper
const getStorageUrl = (path: string | null) => resolveImageUrl(path);

export default function ProjetoVidro() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany, isSaasAdmin } = useAuth();
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [width, setWidth] = useState<number>(1200);
  const [height, setHeight] = useState<number>(2000);
  const [quantity, setQuantity] = useState<number>(1);
  const [lockHeight, setLockHeight] = useState<number>(1000);
  const [panelModifications, setPanelModifications] = useState<Record<string, { holes: Hole[]; cutouts: Cutout[] }>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [glassType, setGlassType] = useState('CRISTAL INCOLOR 10MM - TEMPERADO');
  const [hardwareType, setHardwareType] = useState('Ferragens cromadas');

  // Fetch product templates
  const { data: productTemplates } = useQuery({
    queryKey: ['product-templates-for-glass-project'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select(`
          id,
          name,
          category,
          linha,
          image_url,
          description,
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
    setSelectedLinha(value === '__all__' ? '' : value);
    setSelectedCategory('');
    setSelectedProduct('');
    setPanelModifications({});
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value === '__all__' ? '' : value);
    setSelectedProduct('');
    setPanelModifications({});
  };

  const handleProductChange = (value: string) => {
    setSelectedProduct(value);
    setPanelModifications({});
  };

  // Fetch product template items (only glass items)
  const { data: productItems } = useQuery({
    queryKey: ['product-template-items-glass', selectedProduct, currentCompany?.id, isSaasAdmin],
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      let query = supabase
        .from('product_template_items')
        .select(`
          id,
          quantity_formula,
          pieces_quantity,
          is_optional,
          notes,
          width_formula,
          height_formula,
          item_templates (
            id,
            name,
            type,
            image_url,
            description
          )
        `)
        .eq('product_template_id', selectedProduct);
      
      if (isSaasAdmin) {
        query = query.is('company_id', null);
      } else if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProduct
  });

  // Calculate glass panels
  const glassPanels = useMemo((): GlassPanelData[] => {
    if (!productItems || productItems.length === 0) return [];

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let letterIndex = 0;
    let colIndex = 0;

    return productItems
      .filter(item => item.item_templates?.type === 'glass')
      .flatMap(item => {
        const piecesQty = (item as any).pieces_quantity || 1;
        const widthF = (item as any).width_formula || 'Largura';
        const heightF = (item as any).height_formula || 'Altura';
        const calcWidth = evaluateFormula(widthF, width, height);
        const calcHeight = evaluateFormula(heightF, width, height);
        const customName = (item as any).notes || item.item_templates?.name || 'Vidro';
        
        const panels: GlassPanelData[] = [];
        
        for (let i = 0; i < piecesQty; i++) {
          panels.push({
            id: `${item.id}-${i}`,
            letter: letters[letterIndex % 26],
            name: customName,
            width: calcWidth,
            height: calcHeight,
            widthFormula: (item as any).width_formula,
            heightFormula: (item as any).height_formula,
            quantity: 1,
            row: 0,
            col: colIndex++
          });
          letterIndex++;
        }
        
        return panels;
      });
  }, [productItems, width, height]);

  // Group panels by unique dimensions for the table
  const groupedPanels = useMemo(() => {
    const groups: Record<string, { letters: string[]; width: number; height: number; quantity: number; widthFormula: string | null; heightFormula: string | null }> = {};
    
    glassPanels.forEach(panel => {
      const key = `${panel.width}-${panel.height}`;
      if (!groups[key]) {
        groups[key] = {
          letters: [],
          width: panel.width,
          height: panel.height,
          quantity: 0,
          widthFormula: panel.widthFormula,
          heightFormula: panel.heightFormula
        };
      }
      groups[key].letters.push(panel.letter);
      groups[key].quantity++;
    });
    
    return Object.values(groups);
  }, [glassPanels]);

  const selectedProductData = productTemplates?.find(p => p.id === selectedProduct);

  // Save project mutation
  const saveProjectMutation = useMutation({
    mutationFn: async ({ name, notes }: { name: string; notes: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      
      const panelsWithMods = glassPanels.map(panel => ({
        ...panel,
        holes: panelModifications[panel.id]?.holes || [],
        cutouts: panelModifications[panel.id]?.cutouts || []
      }));
      
      const { error } = await supabase
        .from('glass_projects')
        .insert([{
          company_id: currentCompany.id,
          product_template_id: selectedProduct || null,
          name,
          vao_width: width,
          vao_height: height,
          quantity,
          lock_height: lockHeight,
          panels: panelsWithMods as any,
          notes
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Projeto salvo com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['glass-projects'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar projeto: ' + error.message);
    }
  });

  const handleSaveProject = async (name: string, notes: string) => {
    await saveProjectMutation.mutateAsync({ name, notes });
  };

  const handleExportPdf = () => {
    const pdf = generateGlassProjectPdf({
      productName: selectedProductData?.name || 'Produto',
      productImage: getStorageUrl(selectedProductData?.image_url || null),
      categoria: translateCategory(selectedProductData?.category || ''),
      linha: selectedProductData?.linha || '',
      vaoWidth: width,
      vaoHeight: height,
      quantity,
      lockHeight,
      panels: glassPanels,
      groupedPanels,
      panelModifications,
      companyName: currentCompany?.name || 'Vetra Glass'
    });
    
    pdf.save(`projeto-vidro-${selectedProductData?.name || 'produto'}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  const handlePrint = () => {
    handleExportPdf();
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Projeto de Vidro</h1>
              <p className="text-sm text-muted-foreground">Visualize, configure e exporte projetos de vidros</p>
            </div>
          </div>
        </div>

        {/* Filters and Inputs */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Linha */}
              <div className="space-y-2">
                <Label>Linha</Label>
                <Select value={selectedLinha || '__all__'} onValueChange={handleLinhaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as linhas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as linhas</SelectItem>
                    {availableLinhas.map(linha => (
                      <SelectItem key={linha} value={linha}>{linha}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria */}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={selectedCategory || '__all__'} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as categorias</SelectItem>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{translateCategory(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Produto */}
              <div className="space-y-2 lg:col-span-2">
                <Label>Produto</Label>
                <Select value={selectedProduct} onValueChange={handleProductChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
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

              {/* Largura */}
              <div className="space-y-2">
                <Label>Largura do Vão (mm)</Label>
                <Input
                  type="number"
                  value={width}
                  onChange={e => setWidth(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>

              {/* Altura */}
              <div className="space-y-2">
                <Label>Altura do Vão (mm)</Label>
                <Input
                  type="number"
                  value={height}
                  onChange={e => setHeight(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content - Only show when product is selected */}
        {selectedProduct && glassPanels.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side - Product Info + Pieces Table */}
            <div className="space-y-4">
              <ProductInfoHeader 
                productName={selectedProductData?.name || ''}
                productImage={getStorageUrl(selectedProductData?.image_url || null)}
                category={selectedProductData?.category || ''}
                linha={selectedProductData?.linha || ''}
                width={width}
                height={height}
                quantity={quantity}
                onQuantityChange={setQuantity}
                glassType={glassType}
                onGlassTypeChange={setGlassType}
                hardwareType={hardwareType}
                onHardwareTypeChange={setHardwareType}
              />
              
              <PiecesTable 
                panels={glassPanels}
                groupedPanels={groupedPanels}
                totalWidth={width}
                totalHeight={height}
                lockHeight={lockHeight}
                onLockHeightChange={setLockHeight}
              />
            </div>

            {/* Right side - Canvas */}
            <div className="lg:col-span-2">
              <GlassProjectCanvas 
                panels={glassPanels}
                totalWidth={width}
                totalHeight={height}
                quantity={quantity}
                lockHeight={lockHeight}
                panelModifications={panelModifications}
                onPanelModificationsChange={setPanelModifications}
                glassType={glassType}
                hardwareType={hardwareType}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {selectedProduct && glassPanels.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">
                Nenhum vidro encontrado para este produto.
                <br />
                Verifique se o produto possui vidros configurados na composição.
              </p>
            </CardContent>
          </Card>
        )}

        {!selectedProduct && (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">
                Selecione um produto para visualizar o projeto de vidros.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer Actions */}
        {selectedProduct && glassPanels.length > 0 && (
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button onClick={() => setSaveDialogOpen(true)}>
              <Save className="w-4 h-4 mr-2" />
              Salvar Projeto
            </Button>
          </div>
        )}
      </div>
      
      {/* Save Dialog */}
      <SaveProjectDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveProject}
        defaultName={selectedProductData?.name ? `Projeto - ${selectedProductData.name}` : ''}
      />
    </MainLayout>
  );
}
