import { useState, useMemo } from 'react';
import { resolveImageUrl } from '@/utils/imageUrl';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Download, Tags, Save, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { evaluateFormula, getFormulaPosition } from '@/utils/safeFormulaEvaluator';
import { type ProfileCutItem } from '@/components/plano-corte/ProfileCutsTable';
import { type GlassCutItem } from '@/components/plano-corte/GlassCutsTable';
import { generateCuttingLabels, expandCutsToLabels } from '@/utils/generateCuttingLabels';
import { exportCuttingPlanToCSV, type CuttingPlanExport } from '@/utils/exportCuttingToExcel';
import { ProductionHeader } from '@/components/producao/ProductionHeader';
import { UnifiedProductionView } from '@/components/producao/UnifiedProductionView';
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

// Category translation - uses dynamic labels from product_categories table
import { useProductCategoryLabels } from '@/hooks/useProductCategories';

// Get storage URL helper
const getStorageUrl = (path: string | null) => resolveImageUrl(path);

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
  const { currentCompany, isSaasAdmin } = useAuth();
  const { labels: categoryLabels } = useProductCategoryLabels();
  const translateCategory = (category: string) => categoryLabels[category] || category;
  
  // State
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [width, setWidth] = useState<number>(1000);
  const [height, setHeight] = useState<number>(1000);
  const [quantity, setQuantity] = useState<number>(1);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [lockHeight, setLockHeight] = useState<number>(1000);
  const [panelModifications, setPanelModifications] = useState<Record<string, { holes: Hole[]; cutouts: Cutout[] }>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [glassType, setGlassType] = useState('CRISTAL INCOLOR 10MM - TEMPERADO');
  const [hardwareType, setHardwareType] = useState('Ferragens cromadas');
  const [folgaLargura, setFolgaLargura] = useState<number>(0);
  const [folgaVertical, setFolgaVertical] = useState<number>(0);
  const [acabamento, setAcabamento] = useState('Branco Brilhante RAL900');
  const [corComponentes, setCorComponentes] = useState('Branco');
  const [reforco, setReforco] = useState('Sem Reforço');
  const [contramarco, setContramarco] = useState('sem');
  const [corteContramarco, setCorteContramarco] = useState('45/45');
  const [arremate, setArremate] = useState('sem');
  const [tipoVidro, setTipoVidro] = useState('');
  const [espessuraVidro, setEspessuraVidro] = useState('');
  const [calculated, setCalculated] = useState(false);

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

  // Group panels by unique dimensions for export
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

  // Handler to load a saved project
  const handleLoadProject = (project: any) => {
    if (project.product_template_id) {
      setSelectedProduct(project.product_template_id);
    }
    setWidth(project.vao_width);
    setHeight(project.vao_height);
    setQuantity(project.quantity);
    setLockHeight(project.lock_height);
    
    // Restore panel modifications from saved panels
    if (project.panels && Array.isArray(project.panels)) {
      const mods: Record<string, { holes: Hole[]; cutouts: Cutout[] }> = {};
      project.panels.forEach((panel: any) => {
        if (panel.holes?.length > 0 || panel.cutouts?.length > 0) {
          mods[panel.id] = {
            holes: panel.holes || [],
            cutouts: panel.cutouts || []
          };
        }
      });
      setPanelModifications(mods);
    }
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
    
    pdf.save(`producao-${selectedProductData?.name || 'projeto'}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  const hasData = calculatedCuts.length > 0 || calculatedGlassCuts.length > 0;

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
              <p className="text-sm text-muted-foreground">Plano de corte e projeto de vidros unificado</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <SavedProjectsSheet onLoadProject={handleLoadProject} />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={!hasData}>
                  <Download className="w-4 h-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border shadow-md">
                <DropdownMenuItem onClick={handleExportPdf}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar PDF
                </DropdownMenuItem>
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
            
            <Button onClick={() => setSaveDialogOpen(true)} disabled={!hasData}>
              <Save className="w-4 h-4 mr-2" />
              Salvar Projeto
            </Button>
          </div>
        </div>

        {/* Product Selection Header */}
        <ProductionHeader
          availableLinhas={availableLinhas}
          availableCategories={availableCategories}
          filteredProducts={filteredProducts}
          selectedLinha={selectedLinha}
          selectedCategory={selectedCategory}
          selectedProduct={selectedProduct}
          onLinhaChange={handleLinhaChange}
          onCategoryChange={handleCategoryChange}
          onProductChange={handleProductChange}
          width={width}
          height={height}
          quantity={quantity}
          folgaLargura={folgaLargura}
          folgaVertical={folgaVertical}
          acabamento={acabamento}
          corComponentes={corComponentes}
          reforco={reforco}
          contramarco={contramarco}
          corteContramarco={corteContramarco}
          arremate={arremate}
          tipoVidro={tipoVidro}
          espessuraVidro={espessuraVidro}
          onWidthChange={setWidth}
          onHeightChange={setHeight}
          onQuantityChange={setQuantity}
          onFolgaLarguraChange={setFolgaLargura}
          onFolgaVerticalChange={setFolgaVertical}
          onAcabamentoChange={setAcabamento}
          onCorComponentesChange={setCorComponentes}
          onReforcoChange={setReforco}
          onContramarcoChange={setContramarco}
          onCorteContramarcoChange={setCorteContramarco}
          onArremateChange={setArremate}
          onTipoVidroChange={setTipoVidro}
          onEspessuraVidroChange={setEspessuraVidro}
          onCalcular={() => setCalculated(true)}
          productImageUrl={getStorageUrl(selectedProductData?.image_url || null)}
          productName={selectedProductData?.name || null}
        />

        {/* Unified Production View */}
        <UnifiedProductionView
          profileCuts={calculatedCuts}
          glassCuts={calculatedGlassCuts}
          glassPanels={glassPanels}
          barOptimizationData={barOptimizationData}
          width={width}
          height={height}
          quantity={quantity}
          lockHeight={lockHeight}
          onLockHeightChange={setLockHeight}
          panelModifications={panelModifications}
          onPanelModificationsChange={setPanelModifications}
          glassType={glassType}
          hardwareType={hardwareType}
          completedItems={completedItems}
          onToggleComplete={handleToggleComplete}
          getStorageUrl={getStorageUrl}
          selectedProduct={selectedProduct}
        />
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
