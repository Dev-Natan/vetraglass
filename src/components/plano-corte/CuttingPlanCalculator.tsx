import { useState, useMemo } from 'react';
import { resolveProductImageUrl } from '@/utils/imageUrl';
import { Printer, Download, Tags, BarChart3, Settings2, RotateCcw, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula, getFormulaPosition } from '@/utils/safeFormulaEvaluator';
import { ProfileCutsTable, type ProfileCutItem } from '@/components/plano-corte/ProfileCutsTable';
import { GlassCutsTable, type GlassCutItem } from '@/components/plano-corte/GlassCutsTable';
import { BarOptimizationView } from '@/components/plano-corte/BarOptimizationView';
import { PrintableCuttingReport } from '@/components/plano-corte/PrintableCuttingReport';


import { CuttingSummaryCards } from '@/components/plano-corte/CuttingSummaryCards';
import { AddProductPanel } from '@/components/orcamentos/AddProductPanel';
import { generateCuttingLabels, expandCutsToLabels } from '@/utils/generateCuttingLabels';
import { exportCuttingPlanToCSV, type CuttingPlanExport } from '@/utils/exportCuttingToExcel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const getStorageUrl = (path: string | null) => resolveProductImageUrl(path);

export function CuttingPlanCalculator() {
  const { currentCompany, isSaasAdmin } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'cortes' | 'otimizacao'>('cortes');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);

  const handleLiveChange = (payload: {
    product_template_id: string | null;
    name: string;
    image_url: string | null;
    width: number;
    height: number;
    quantity: number;
  }) => {
    setSelectedProduct(payload.product_template_id || '');
    setProductName(payload.name);
    setProductImage(payload.image_url || null);
    setWidth(Number(payload.width) || 0);
    setHeight(Number(payload.height) || 0);
    setQuantity(Number(payload.quantity) || 1);
  };

  const handleReset = () => {
    setSelectedProduct('');
    setProductName('');
    setProductImage(null);
    setWidth(0);
    setHeight(0);
    setQuantity(1);
    setCompletedItems(new Set());
  };


  const { data: productItems } = useQuery({
    queryKey: ['product-template-items-cutting', selectedProduct, currentCompany?.id, isSaasAdmin],
    queryFn: async () => {
      if (!selectedProduct) return [];

      const selectCols = `
          id,
          quantity_formula,
          pieces_formula,
          pieces_quantity,
          cut_angle,
          cut_angle_start,
          cut_angle_end,
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
        `;


      // 1. Prefer company-specific composition when available
      if (!isSaasAdmin && currentCompany?.id) {
        const { data: companyItems, error: companyErr } = await supabase
          .from('product_template_items')
          .select(selectCols)
          .eq('product_template_id', selectedProduct)
          .eq('company_id', currentCompany.id);

        if (companyErr) throw companyErr;
        if (companyItems && companyItems.length > 0) return companyItems;
      }

      // 2. Fallback to the global template composition
      const { data, error } = await supabase
        .from('product_template_items')
        .select(selectCols)
        .eq('product_template_id', selectedProduct)
        .is('company_id', null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProduct
  });


  const { data: glassFormulas } = useQuery({
    queryKey: ['glass-formulas-cutting', selectedProduct],
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
        
        if (heightF && widthF) {
          // If both exist, we try to determine by the content of the formulas
          // usually this is a fallback case
          calculatedLength = evaluateFormula(heightF || widthF, width, height);
          position = heightF ? 'Altura' : 'Largura';
          displayHeightFormula = heightF;
          displayWidthFormula = widthF;
        } else if (heightF) {
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
        
        const piecesFormula = (item as any).pieces_formula as string | null;
        let piecesFromFormula = piecesPerProduct;
        if (piecesFormula && piecesFormula.trim() !== '') {
          const evaluated = evaluateFormula(piecesFormula, width, height, null, 'ceil');
          if (evaluated > 0) piecesFromFormula = evaluated;
        }
        const totalPieces = piecesFromFormula * quantity;

        
        return {
          id: item.id,
          itemTemplateId: item.item_templates?.id || item.id,
          profileName: item.item_templates?.name || 'Perfil',
          imageUrl: item.item_templates?.image_url || null,
          widthFormula: displayWidthFormula,
          heightFormula: displayHeightFormula,
          quantityFormula: quantityF,
          calculatedLength,
          quantity: totalPieces,
          piecesPerProduct,
          cutAngle: item.cut_angle,
          cutAngleStart: (item as any).cut_angle_start,
          cutAngleEnd: (item as any).cut_angle_end,
          position,
          isCompleted: completedItems.has(item.id),
        };

      });
  }, [productItems, width, height, quantity, completedItems]);

  const calculatedGlassCuts = useMemo((): GlassCutItem[] => {
    const glassItems: GlassCutItem[] = [];
    
    if (productItems && productItems.length > 0) {
      const itemGlasses = productItems
        .filter(item => item.item_templates?.type === 'glass')
        .map(item => {
          const piecesQty = (item as any).pieces_quantity || 1;
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
            quantity: piecesQty * quantity,
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

  const barOptimizationData = useMemo(() => {
    return calculatedCuts.map(cut => ({
      itemTemplateId: (cut as any).itemTemplateId || cut.profileName,
      itemName: cut.profileName,
      cutLength: cut.calculatedLength,
      quantity: cut.quantity,
      barLengthMm: 6000,
    }));
  }, [calculatedCuts]);


  const selectedProductData = selectedProduct
    ? { id: selectedProduct, name: productName, image_url: productImage }
    : null;

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

  const totalItems = calculatedCuts.length + calculatedGlassCuts.length;
  const completedCount = completedItems.size;
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

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
        cutAngleStart: c.cutAngleStart,
        cutAngleEnd: c.cutAngleEnd,
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
        angleStart: c.cutAngleStart,
        angleEnd: c.cutAngleEnd,
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
            .value-green { color: #16a34a; font-weight: bold; font-size: 16px; }
            .value-blue { color: #2563eb; font-weight: bold; font-size: 16px; }
            .value-purple { color: #9333ea; font-weight: bold; font-size: 16px; }
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
                    <td><strong>${glass.customName || glass.glassName}</strong></td>
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
                  <th class="profile">ÂNGULO INÍCIO</th>
                  <th class="profile">ÂNGULO FIM</th>
                  <th class="profile">POSIÇÃO</th>
                </tr>
              </thead>
              <tbody>
                ${calculatedCuts.map(cut => `
                  <tr>
                    <td><strong>${cut.profileName}</strong></td>
                    <td style="font-size: 18px; font-weight: bold;">${cut.calculatedLength}</td>
                    <td>${cut.quantity}</td>
                    <td>${cut.cutAngleStart ?? cut.cutAngle}°</td>
                    <td>${cut.cutAngleEnd ?? cut.cutAngle}°</td>
                    <td>${cut.position}</td>
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
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 100);
    };
    
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-end no-print">
        <div className="flex items-center gap-2">
          {totalItems > 0 && (
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

          <Button
            onClick={() => window.print()}
            className="gap-2"
            disabled={!selectedProduct || (calculatedCuts.length === 0 && calculatedGlassCuts.length === 0)}
          >
            <Printer className="w-4 h-4" />
            Imprimir Plano (PDF)
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={!selectedProduct || calculatedCuts.length === 0}>
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border shadow-md">
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir (Nova janela)
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
        </div>
      </div>

      <div className="no-print rounded-lg border bg-card">
        <div className="p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                Especificações Técnicas do Vão
              </h2>
              <p className="text-sm text-muted-foreground">
                O plano de corte é recalculado em tempo real conforme você digita.
              </p>
            </div>
            {selectedProduct && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Novo
              </Button>
            )}
          </div>
          <AddProductPanel
            mode="cutting"
            onLiveChange={handleLiveChange}
            onAdd={() => {}}
            onCancel={() => {}}
          />
        </div>
      </div>



      {/* On-screen content (hidden on print) */}
      <div className="no-print">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cortes' | 'otimizacao')}>
          <TabsList className="w-auto">
            <TabsTrigger value="cortes" className="px-6 gap-2">
              <Printer className="w-4 h-4" />
              Plano de Corte
            </TabsTrigger>
            <TabsTrigger value="otimizacao" className="px-6 gap-2">
              <BarChart3 className="w-4 h-4" />
              Otimização de Barras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cortes" className="mt-4 space-y-6">
            {calculatedGlassCuts.length === 0 && calculatedCuts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {selectedProduct
                  ? 'Nenhuma composição encontrada para este produto.'
                  : 'Selecione um produto e informe as medidas para gerar o plano de corte.'}
              </div>
            ) : (
              <>
                <CuttingSummaryCards
                  totalProfilePieces={calculatedCuts.reduce((sum, c) => sum + (c.quantity || 0), 0)}
                  distinctProfiles={new Set(calculatedCuts.map(c => c.profileName)).size}
                  totalAccessories={calculatedGlassCuts.reduce((sum, g) => sum + (g.quantity || 0), 0)}
                />

                <div className="space-y-6 w-full min-w-0">
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
                    hoveredId={hoveredProfileId}
                    onHoverChange={setHoveredProfileId}
                  />
                </div>
              </>
            )}
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
      </div>

      {/* Print-only report (visible exclusively via @media print) */}
      <div className="print-area">
        <PrintableCuttingReport
          companyName={currentCompany?.name || 'Urbano Vidros'}
          products={
            selectedProductData
              ? [{
                  productName: selectedProductData.name,
                  width,
                  height,
                  quantity,
                }]
              : []
          }
          profileCuts={calculatedCuts.map((c) => ({
            profileName: c.profileName,
            calculatedLength: c.calculatedLength,
            quantity: c.quantity,
            cutAngle: c.cutAngle,
            cutAngleStart: c.cutAngleStart,
            cutAngleEnd: c.cutAngleEnd,
            position: c.position,
            itemTemplateId: (c as any).itemTemplateId,
          }))}
        />
      </div>
    </div>
  );
}


