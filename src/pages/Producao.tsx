import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Printer, Download, Tags, BarChart3, Scissors, Square, Save, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { evaluateFormula, getFormulaPosition } from '@/utils/safeFormulaEvaluator';
import { CuttingPlanFilters } from '@/components/plano-corte/CuttingPlanFilters';
import { ProfileCutsTable, type ProfileCutItem } from '@/components/plano-corte/ProfileCutsTable';
import { GlassCutsTable, type GlassCutItem } from '@/components/plano-corte/GlassCutsTable';
import { BarOptimizationView } from '@/components/plano-corte/BarOptimizationView';
import { generateCuttingLabels, expandCutsToLabels } from '@/utils/generateCuttingLabels';
import { exportCuttingPlanToCSV, type CuttingPlanExport } from '@/utils/exportCuttingToExcel';
import { GlassProjectCanvas } from '@/components/projeto-vidro/GlassProjectCanvas';
import { PiecesTable } from '@/components/projeto-vidro/PiecesTable';
import { ProductInfoHeader } from '@/components/projeto-vidro/ProductInfoHeader';
import { SaveProjectDialog } from '@/components/projeto-vidro/SaveProjectDialog';
import { Hole, Cutout } from '@/components/projeto-vidro/HoleCutoutEditor';
import { generateGlassProjectPdf } from '@/utils/generateGlassProjectPdf';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Category translation
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

// Get storage URL helper
const getStorageUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/item-templates/${path}`;
};

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

export default function Producao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { currentCompany, isSaasAdmin } = useAuth();
  
  // Main tab state - default from URL or 'corte'
  const initialTab = searchParams.get('tab') || 'corte';
  const [mainTab, setMainTab] = useState<'corte' | 'vidros'>(initialTab as 'corte' | 'vidros');
  
  // Cutting plan state
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [width, setWidth] = useState<number>(1000);
  const [height, setHeight] = useState<number>(1000);
  const [quantity, setQuantity] = useState<number>(1);
  const [cuttingSubTab, setCuttingSubTab] = useState<'cortes' | 'otimizacao'>('cortes');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  
  // Glass project state
  const [lockHeight, setLockHeight] = useState<number>(1000);
  const [panelModifications, setPanelModifications] = useState<Record<string, { holes: Hole[]; cutouts: Cutout[] }>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [glassType, setGlassType] = useState('CRISTAL INCOLOR 10MM - TEMPERADO');
  const [hardwareType, setHardwareType] = useState('Ferragens cromadas');

  // Fetch product templates
  const { data: productTemplates } = useQuery({
    queryKey: ['product-templates-for-production'],
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
    const actualValue = value === '__all__' ? '' : value;
    setSelectedLinha(actualValue);
    setSelectedCategory('');
    setSelectedProduct('');
    setCompletedItems(new Set());
    setPanelModifications({});
  };

  const handleCategoryChange = (value: string) => {
    const actualValue = value === '__all__' ? '' : value;
    setSelectedCategory(actualValue);
    setSelectedProduct('');
    setCompletedItems(new Set());
    setPanelModifications({});
  };

  const handleProductChange = (value: string) => {
    setSelectedProduct(value);
    setCompletedItems(new Set());
    setPanelModifications({});
  };

  // Fetch product template items
  const { data: productItems } = useQuery({
    queryKey: ['product-template-items-production', selectedProduct, currentCompany?.id, isSaasAdmin],
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      let query = supabase
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

  // Fetch glass formulas from glass_line_formulas as fallback
  const { data: glassFormulas } = useQuery({
    queryKey: ['glass-formulas-production', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      const { data, error } = await supabase
        .from('glass_line_formulas')
        .select('*')
        .eq('product_template_id', selectedProduct)
        .eq('is_active', true)
        .order('panel_index')
        .order('formula_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProduct
  });

  // Calculate profile cuts
  const calculatedCuts = useMemo((): ProfileCutItem[] => {
    if (!productItems || productItems.length === 0) return [];

    return productItems
      .filter(item => item.item_templates?.type === 'profile')
      .map(item => {
        const piecesPerProduct = (item as any).pieces_quantity || 1;
        const widthF = (item as any).width_formula || null;
        const heightF = (item as any).height_formula || null;
        const quantityF = item.quantity_formula || '1';
        
        let calculatedLength = 0;
        let position: 'Altura' | 'Largura' = 'Largura';
        let displayWidthFormula: string | null = widthF;
        let displayHeightFormula: string | null = heightF;
        
        if (heightF) {
          calculatedLength = evaluateFormula(heightF, width, height);
          position = 'Altura';
        } else if (widthF) {
          calculatedLength = evaluateFormula(widthF, width, height);
          position = 'Largura';
        } else {
          calculatedLength = evaluateFormula(quantityF, width, height);
          position = getFormulaPosition(quantityF);
          if (position === 'Altura') {
            displayHeightFormula = quantityF;
          } else {
            displayWidthFormula = quantityF;
          }
        }
        
        const totalPieces = piecesPerProduct * quantity;
        
        return {
          id: item.id,
          profileName: item.item_templates?.name || 'Perfil',
          imageUrl: item.item_templates?.image_url || null,
          widthFormula: displayWidthFormula,
          heightFormula: displayHeightFormula,
          quantityFormula: quantityF,
          calculatedLength,
          quantity: totalPieces,
          piecesPerProduct,
          cutAngle: item.cut_angle,
          position,
          isCompleted: completedItems.has(item.id),
        };
      });
  }, [productItems, width, height, quantity, completedItems]);

  // Calculate glass cuts
  const calculatedGlassCuts = useMemo((): GlassCutItem[] => {
    const glassItems: GlassCutItem[] = [];
    
    if (productItems && productItems.length > 0) {
      const itemGlasses = productItems
        .filter(item => item.item_templates?.type === 'glass')
        .map(item => {
          const widthF = (item as any).width_formula || 'Largura';
          const heightF = (item as any).height_formula || 'Altura';
          const calcWidth = evaluateFormula(widthF, width, height);
          const calcHeight = evaluateFormula(heightF, width, height);
          const areaM2 = (calcWidth * calcHeight) / 1000000;
          const customName = (item as any).notes || null;
          
          return {
            id: item.id,
            glassName: item.item_templates?.name || 'Vidro',
            customName: customName,
            imageUrl: item.item_templates?.image_url || null,
            widthFormula: (item as any).width_formula,
            heightFormula: (item as any).height_formula,
            calculatedWidth: calcWidth,
            calculatedHeight: calcHeight,
            areaM2: areaM2,
            quantity: quantity,
            isCompleted: completedItems.has(item.id),
          };
        });
      
      glassItems.push(...itemGlasses);
    }
    
    if (glassItems.length === 0 && glassFormulas && glassFormulas.length > 0) {
      const formulaGlasses = glassFormulas.map((formula, idx) => {
        const widthF = formula.width_formula || 'Largura';
        const heightF = formula.height_formula || 'Altura';
        const calcWidth = evaluateFormula(widthF, width, height);
        const calcHeight = evaluateFormula(heightF, width, height);
        const areaM2 = (calcWidth * calcHeight) / 1000000;
        
        return {
          id: `formula-${idx}`,
          glassName: 'Vidro',
          customName: formula.formula_name,
          imageUrl: null,
          widthFormula: formula.width_formula,
          heightFormula: formula.height_formula,
          calculatedWidth: calcWidth,
          calculatedHeight: calcHeight,
          areaM2: areaM2,
          quantity: quantity,
          isCompleted: completedItems.has(`formula-${idx}`),
        };
      });
      
      glassItems.push(...formulaGlasses);
    }
    
    return glassItems;
  }, [productItems, glassFormulas, width, height, quantity, completedItems]);

  // Calculate glass panels for the project view
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

  // Prepare data for bar optimization
  const barOptimizationData = useMemo(() => {
    return calculatedCuts.map(cut => ({
      itemTemplateId: cut.id,
      itemName: cut.profileName,
      cutLength: cut.calculatedLength,
      quantity: cut.quantity,
      barLengthMm: 6000,
    }));
  }, [calculatedCuts]);

  const selectedProductData = productTemplates?.find(p => p.id === selectedProduct);

  // Toggle item completion
  const handleToggleComplete = (id: string, completed: boolean) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (completed) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // Calculate completion progress
  const totalItems = calculatedCuts.length + calculatedGlassCuts.length;
  const completedCount = completedItems.size;
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  // Generate labels
  const handleGenerateLabels = () => {
    if (!selectedProductData) return;
    
    const labels = expandCutsToLabels(
      `PC-${Date.now().toString().slice(-6)}`,
      selectedProductData.name,
      calculatedCuts.map(c => ({
        id: c.id,
        profileName: c.profileName,
        calculatedLength: c.calculatedLength,
        quantity: c.quantity,
        position: c.position,
        cutAngle: c.cutAngle,
      })),
      calculatedGlassCuts.map(g => ({
        id: g.id,
        glassName: g.glassName,
        customName: g.customName,
        calculatedWidth: g.calculatedWidth,
        calculatedHeight: g.calculatedHeight,
        quantity: g.quantity,
      }))
    );
    
    generateCuttingLabels(labels);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!selectedProductData) return;
    
    const exportData: CuttingPlanExport = {
      productName: selectedProductData.name,
      vaoWidth: width,
      vaoHeight: height,
      productQuantity: quantity,
      profiles: calculatedCuts.map(c => ({
        profileName: c.profileName,
        length: c.calculatedLength,
        quantity: c.quantity,
        angle: c.cutAngle,
        position: c.position,
        formula: c.heightFormula || c.widthFormula || undefined,
      })),
      glasses: calculatedGlassCuts.map(g => ({
        glassName: g.customName || g.glassName,
        width: g.calculatedWidth,
        height: g.calculatedHeight,
        area: g.areaM2,
        quantity: g.quantity,
        widthFormula: g.widthFormula || undefined,
        heightFormula: g.heightFormula || undefined,
      })),
      generatedAt: new Date().toLocaleString('pt-BR'),
    };
    
    exportCuttingPlanToCSV(exportData);
  };

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

  const handleExportGlassPdf = () => {
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

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Produção</h1>
              <p className="text-sm text-muted-foreground">Plano de corte e projeto de vidros</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Progress indicator */}
            {mainTab === 'corte' && totalItems > 0 && (
              <div className="hidden sm:flex items-center gap-2 mr-4">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">{progressPercent}%</span>
              </div>
            )}
            
            {mainTab === 'corte' ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" disabled={!selectedProduct || calculatedCuts.length === 0}>
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border shadow-md">
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleGenerateLabels}>
                    <Tags className="w-4 h-4 mr-2" />
                    Gerar Etiquetas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportGlassPdf} disabled={!selectedProduct || glassPanels.length === 0}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button onClick={() => setSaveDialogOpen(true)} disabled={!selectedProduct || glassPanels.length === 0}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Projeto
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'corte' | 'vidros')}>
          <TabsList className="w-auto">
            <TabsTrigger value="corte" className="px-6 gap-2">
              <Scissors className="w-4 h-4" />
              Plano de Corte
            </TabsTrigger>
            <TabsTrigger value="vidros" className="px-6 gap-2">
              <Square className="w-4 h-4" />
              Projeto de Vidros
            </TabsTrigger>
          </TabsList>

          {/* Cutting Plan Tab */}
          <TabsContent value="corte" className="mt-6 space-y-6">
            {/* Product Selection & Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Product Image */}
              <div className="flex justify-center">
                <div className="w-full max-w-[250px] aspect-square bg-muted rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  {selectedProductData?.image_url ? (
                    <img 
                      src={getStorageUrl(selectedProductData.image_url) || ''} 
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
                <CuttingPlanFilters
                  availableLinhas={availableLinhas}
                  availableCategories={availableCategories}
                  filteredProducts={filteredProducts}
                  selectedLinha={selectedLinha}
                  selectedCategory={selectedCategory}
                  selectedProduct={selectedProduct}
                  onLinhaChange={handleLinhaChange}
                  onCategoryChange={handleCategoryChange}
                  onProductChange={handleProductChange}
                />

                {selectedProductData && (
                  <h2 className="text-xl font-bold uppercase text-foreground">
                    {selectedProductData.name}
                  </h2>
                )}

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

            {/* Cutting Sub-Tabs */}
            <Tabs value={cuttingSubTab} onValueChange={(v) => setCuttingSubTab(v as 'cortes' | 'otimizacao')}>
              <TabsList className="w-auto">
                <TabsTrigger value="cortes" className="px-6 gap-2">
                  <Printer className="w-4 h-4" />
                  Cortes
                </TabsTrigger>
                <TabsTrigger value="otimizacao" className="px-6 gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Otimização de Barras
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cortes" className="mt-4 space-y-6">
                <GlassCutsTable 
                  glassCuts={calculatedGlassCuts}
                  showCheckboxes
                  onToggleComplete={handleToggleComplete}
                />
                <ProfileCutsTable 
                  cuts={calculatedCuts}
                  showCheckboxes
                  onToggleComplete={handleToggleComplete}
                  getStorageUrl={getStorageUrl}
                />
              </TabsContent>

              <TabsContent value="otimizacao" className="mt-4">
                {barOptimizationData.length > 0 ? (
                  <BarOptimizationView cuts={barOptimizationData} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Selecione um produto para ver a otimização de barras
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Glass Project Tab */}
          <TabsContent value="vidros" className="mt-6 space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <CuttingPlanFilters
                    availableLinhas={availableLinhas}
                    availableCategories={availableCategories}
                    filteredProducts={filteredProducts}
                    selectedLinha={selectedLinha}
                    selectedCategory={selectedCategory}
                    selectedProduct={selectedProduct}
                    onLinhaChange={handleLinhaChange}
                    onCategoryChange={handleCategoryChange}
                    onProductChange={handleProductChange}
                  />
                  
                  <div className="space-y-2">
                    <Label>Largura do Vão (mm)</Label>
                    <Input
                      type="number"
                      value={width}
                      onChange={e => setWidth(parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>

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

            {/* Main Content */}
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

            {/* Empty States */}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Save Project Dialog */}
      <SaveProjectDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveProject}
      />
    </MainLayout>
  );
}
