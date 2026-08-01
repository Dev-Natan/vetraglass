import { useState, useMemo, useEffect } from 'react';
import { resolveProductImageUrl } from '@/utils/imageUrl';
import { Printer, Download, Tags, BarChart3, Settings2, RotateCcw, Package, Scissors } from 'lucide-react';
import { SaveOffcutsDialog } from '@/components/plano-corte/SaveOffcutsDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula, getFormulaPosition } from '@/utils/safeFormulaEvaluator';
import { ProfileCutsTable, type ProfileCutItem } from '@/components/plano-corte/ProfileCutsTable';
import { GlassCutsTable, type GlassCutItem } from '@/components/plano-corte/GlassCutsTable';
import { BarOptimizationView } from '@/components/plano-corte/BarOptimizationView';
import { PrintableCuttingReport } from '@/components/plano-corte/PrintableCuttingReport';
import { AccessoriesCutsTable, type AccessoryCutItem } from '@/components/plano-corte/AccessoriesCutsTable';


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

type ProfileOverride = {
  widthFormula?: string;
  heightFormula?: string;
  piecesFormula?: string;
  cutAngleStart?: number;
  cutAngleEnd?: number;
};
type GlassOverride = {
  widthFormula?: string;
  heightFormula?: string;
};

export function CuttingPlanCalculator() {
  const { currentCompany, isSaasAdmin } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [widthB, setWidthB] = useState<number>(0);
  const [heightB, setHeightB] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'cortes' | 'acessorios' | 'otimizacao'>('cortes');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);
  const [profileOverrides, setProfileOverrides] = useState<Record<string, ProfileOverride>>({});
  const [glassOverrides, setGlassOverrides] = useState<Record<string, GlassOverride>>({});
  const [offcutsDialogOpen, setOffcutsDialogOpen] = useState(false);


  const handleLiveChange = (payload: {
    product_template_id: string | null;
    name: string;
    image_url: string | null;
    width: number;
    height: number;
    width_b?: number;
    height_b?: number;
    has_multiple_sides?: boolean;
    quantity: number;
  }) => {
    const nextId = payload.product_template_id || '';
    // NÃO chamar outros setStates dentro do updater de setState (anti-pattern
    // que em StrictMode roda duas vezes e pode "sumir" com overrides digitados).
    if (nextId !== selectedProduct) {
      setProfileOverrides({});
      setGlassOverrides({});
      setCompletedItems(new Set());
    }
    setSelectedProduct(nextId);
    setProductName(payload.name);
    setProductImage(payload.image_url || null);
    setWidth(Number(payload.width) || 0);
    setHeight(Number(payload.height) || 0);
    setWidthB(Number(payload.width_b) || 0);
    setHeightB(Number(payload.height_b) || 0);
    setQuantity(Number(payload.quantity) || 1);
  };

  const handleReset = () => {
    setSelectedProduct('');
    setProductName('');
    setProductImage(null);
    setWidth(0);
    setHeight(0);
    setWidthB(0);
    setHeightB(0);
    setQuantity(1);
    setCompletedItems(new Set());
    setProfileOverrides({});
    setGlassOverrides({});
  };

  const handleProfileFieldChange = (id: string, field: string, value: string) => {
    setProfileOverrides((prev) => {
      const current = { ...(prev[id] || {}) };
      if (field === 'cutAngleStart' || field === 'cutAngleEnd') {
        const num = Number(value);
        (current as any)[field] = Number.isFinite(num) ? num : undefined;
      } else {
        (current as any)[field] = value;
      }
      return { ...prev, [id]: current };
    });
  };

  const handleGlassFieldChange = (id: string, field: string, value: string) => {
    setGlassOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };


  const {
    data: productItems,
    error: productItemsError,
    isLoading: isLoadingItems,
    isFetching: isFetchingItems,
    refetch: refetchProductItems,
  } = useQuery({
    queryKey: ['product-template-items-cutting', selectedProduct, currentCompany?.id, isSaasAdmin],
    queryFn: async () => {
      if (!selectedProduct) return [];

      // The sandbox must always ask the backend for the selected product composition.
      // Product flags and company catalog activation must not block plan rendering here.
      const { data, error } = await supabase.rpc('get_cutting_plan_items', {
        _template_id: selectedProduct,
        _company_id: !isSaasAdmin && currentCompany?.id ? currentCompany.id : null,
      });

      if (error) {
        console.error('[PlanoDeCorte] Erro RPC get_cutting_plan_items:', error, { selectedProduct, company: currentCompany?.id, isSaasAdmin });
        throw error;
      }

      console.info('[PlanoDeCorte] RPC retornou', (data || []).length, 'linhas para template', selectedProduct, 'company', currentCompany?.id, 'isSaasAdmin', isSaasAdmin);

      const reshaped = (data || []).map((row: any) => ({
        id: row.id,
        quantity_formula: row.quantity_formula,
        pieces_formula: row.pieces_formula,
        pieces_quantity: row.pieces_quantity,
        side: row.side,
        cut_angle: row.cut_angle,
        cut_angle_start: row.cut_angle_start,
        cut_angle_end: row.cut_angle_end,
        is_optional: row.is_optional,
        notes: row.notes,
        width_formula: row.width_formula,
        height_formula: row.height_formula,
        item_templates: row.item_template_id
          ? {
              id: row.item_template_id,
              name: row.item_template_name,
              type: row.item_template_type,
              image_url: row.item_template_image_url,
            }
          : null,
      }));

      const profileCount = reshaped.filter((r: any) => r.item_templates?.type === 'profile').length;
      const glassCount = reshaped.filter((r: any) => r.item_templates?.type === 'glass').length;
      console.info('[PlanoDeCorte] Tipos:', { profileCount, glassCount, total: reshaped.length });
      return reshaped;
    },
    enabled: Boolean(selectedProduct),
    retry: false,
  });

  useEffect(() => {
    if (!selectedProduct) return;

    setActiveTab('cortes');
    refetchProductItems();
  }, [selectedProduct, refetchProductItems]);



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

  const itemTemplateIds = useMemo(() => {
    if (!productItems) return [] as string[];
    return Array.from(new Set(
      productItems
        .filter((it: any) => it.item_templates?.id && !['profile', 'glass'].includes(it.item_templates.type))
        .map((it: any) => it.item_templates.id as string)
    ));
  }, [productItems]);

  const { data: itemTemplateUnits } = useQuery({
    queryKey: ['item-template-units', itemTemplateIds],
    queryFn: async () => {
      if (itemTemplateIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, unit')
        .in('id', itemTemplateIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.id] = r.unit || 'un'; });
      return map;
    },
    enabled: itemTemplateIds.length > 0,
  });


  /**
   * Contexto de fórmulas: quando o item é do Lado B, o avaliador troca
   * 'Largura'/'Altura' pelos valores do Lado B (fallback no Lado A).
   */
  const formulaCtx = useMemo(
    () => ({ width, height, widthB: widthB || width, heightB: heightB || height }),
    [width, height, widthB, heightB],
  );

  const sideOf = (item: any): string | null => {
    const raw = (item?.side ?? '').toString().trim().toUpperCase();
    return raw === 'B' ? 'B' : raw === 'C' ? 'C' : null;
  };

  const calculatedCuts = useMemo((): ProfileCutItem[] => {
    if (!productItems || productItems.length === 0) return [];

    return productItems
      .filter(item => item.item_templates?.type === 'profile')
      .map(item => {
        const override = profileOverrides[item.id] || {};
        const piecesPerProduct = (item as any).pieces_quantity || 1;
        const baseWidthF = (item as any).width_formula || null;
        const baseHeightF = (item as any).height_formula || null;
        const widthF = override.widthFormula !== undefined ? override.widthFormula : baseWidthF;
        const heightF = override.heightFormula !== undefined ? override.heightFormula : baseHeightF;
        const quantityF = item.quantity_formula || '1';
        const itemSide = sideOf(item);

        let calculatedLength = 0;
        let position: 'Altura' | 'Largura' = 'Largura';
        let displayWidthFormula: string | null = widthF;
        let displayHeightFormula: string | null = heightF;

        if (heightF && widthF) {
          calculatedLength = evaluateFormula(heightF || widthF, formulaCtx, undefined, itemSide);
          position = heightF ? 'Altura' : 'Largura';
          displayHeightFormula = heightF;
          displayWidthFormula = widthF;
        } else if (heightF) {
          calculatedLength = evaluateFormula(heightF, formulaCtx, undefined, itemSide);
          position = 'Altura';
        } else if (widthF) {
          calculatedLength = evaluateFormula(widthF, formulaCtx, undefined, itemSide);
          position = 'Largura';
        } else {
          calculatedLength = evaluateFormula(quantityF, formulaCtx, undefined, itemSide);
          position = getFormulaPosition(quantityF);
          if (position === 'Altura') {
            displayHeightFormula = quantityF;
          } else {
            displayWidthFormula = quantityF;
          }
        }

        const basePiecesFormula = (item as any).pieces_formula as string | null;
        const piecesFormula =
          override.piecesFormula !== undefined ? override.piecesFormula : basePiecesFormula;
        let piecesFromFormula = piecesPerProduct;
        if (piecesFormula && piecesFormula.trim() !== '') {
          const evaluated = evaluateFormula(piecesFormula, formulaCtx, undefined, itemSide, 'ceil');
          if (evaluated > 0) piecesFromFormula = evaluated;
        }
        const totalPieces = piecesFromFormula * quantity;

        const baseAngleStart = (item as any).cut_angle_start ?? item.cut_angle;
        const baseAngleEnd = (item as any).cut_angle_end ?? item.cut_angle;
        const cutAngleStart = override.cutAngleStart ?? baseAngleStart;
        const cutAngleEnd = override.cutAngleEnd ?? baseAngleEnd;

        return {
          id: item.id,
          itemTemplateId: item.item_templates?.id || item.id,
          profileName: item.item_templates?.name || 'Perfil',
          imageUrl: item.item_templates?.image_url || null,
          widthFormula: displayWidthFormula,
          heightFormula: displayHeightFormula,
          quantityFormula: quantityF,
          piecesFormula: piecesFormula ?? null,
          calculatedLength,
          quantity: totalPieces,
          piecesPerProduct,
          cutAngle: item.cut_angle,
          cutAngleStart,
          cutAngleEnd,
          position,
          isCompleted: completedItems.has(item.id),
        };
      })
      .sort((a, b) => {
        const nameCmp = a.profileName.localeCompare(b.profileName, 'pt-BR', { sensitivity: 'base' });
        if (nameCmp !== 0) return nameCmp;
        return b.calculatedLength - a.calculatedLength;
      });
  }, [productItems, formulaCtx, quantity, completedItems, profileOverrides]);


  const calculatedGlassCuts = useMemo((): GlassCutItem[] => {
    const glassItems: GlassCutItem[] = [];

    if (productItems && productItems.length > 0) {
      const itemGlasses = productItems
        .filter(item => item.item_templates?.type === 'glass')
        .map(item => {
          const override = glassOverrides[item.id] || {};
          const piecesQty = (item as any).pieces_quantity || 1;
          const widthF = override.widthFormula ?? ((item as any).width_formula || 'Largura');
          const heightF = override.heightFormula ?? ((item as any).height_formula || 'Altura');
          const itemSide = sideOf(item);
          const calcWidth = evaluateFormula(widthF, formulaCtx, undefined, itemSide);
          const calcHeight = evaluateFormula(heightF, formulaCtx, undefined, itemSide);
          const areaM2 = (calcWidth * calcHeight) / 1000000;
          const customName = (item as any).notes || null;

          return {
            id: item.id,
            glassName: item.item_templates?.name || 'Vidro',
            customName: customName,
            imageUrl: item.item_templates?.image_url || null,
            widthFormula: widthF,
            heightFormula: heightF,
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
        const id = `formula-${idx}`;
        const override = glassOverrides[id] || {};
        const widthF = override.widthFormula ?? (formula.width_formula || 'Largura');
        const heightF = override.heightFormula ?? (formula.height_formula || 'Altura');
        const calcWidth = evaluateFormula(widthF, formulaCtx, undefined, null);
        const calcHeight = evaluateFormula(heightF, formulaCtx, undefined, null);
        const areaM2 = (calcWidth * calcHeight) / 1000000;

        return {
          id,
          glassName: 'Vidro',
          customName: formula.formula_name,
          imageUrl: null,
          widthFormula: widthF,
          heightFormula: heightF,
          calculatedWidth: calcWidth,
          calculatedHeight: calcHeight,
          areaM2: areaM2,
          quantity: quantity,
          isCompleted: completedItems.has(id),
        };
      });

      glassItems.push(...formulaGlasses);
    }

    return glassItems;
  }, [productItems, glassFormulas, formulaCtx, quantity, completedItems, glassOverrides]);


  const accessoryItems = useMemo((): AccessoryCutItem[] => {
    if (!productItems || productItems.length === 0) return [];
    const units = itemTemplateUnits || {};
    return productItems
      .filter((it: any) => it.item_templates && !['profile', 'glass'].includes(it.item_templates.type))
      .map((it: any) => {
        const tpl = it.item_templates;
        const unit = units[tpl.id] || 'un';
        const piecesQty = Number(it.pieces_quantity || 1);
        const qf: string | null = it.quantity_formula;
        let total = piecesQty * quantity;
        let isFixed = true;
        if (qf && qf.trim() !== '' && qf.trim() !== '1') {
          const r = evaluateFormula(qf, formulaCtx, undefined, sideOf(it));
          if (r > 0) {
            isFixed = false;
            if (unit === 'm' || unit === 'metros') total = (r / 1000) * piecesQty * quantity;
            else if (unit === 'm²' || unit === 'm2') total = (r / 1000000) * piecesQty * quantity;
            else total = r * piecesQty * quantity;
          }
        }
        return {
          id: it.id,
          itemName: tpl.name,
          type: tpl.type,
          unit,
          quantity: Math.round(total * 1000) / 1000,
          formula: qf,
          isFixed,
          imageUrl: tpl.image_url,
        };
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName, 'pt-BR'));
  }, [productItems, itemTemplateUnits, width, height, quantity]);

  const accessoryBuckets = useMemo(() => {
    const acessorios: AccessoryCutItem[] = [];
    const componentes: AccessoryCutItem[] = [];
    const insumos: AccessoryCutItem[] = [];
    for (const it of accessoryItems) {
      const t = (it.type || '').toLowerCase();
      if (['accessory', 'acessorio', 'hardware', 'ferragem'].includes(t)) acessorios.push(it);
      else if (['component', 'componente', 'fixed', 'fixo'].includes(t)) componentes.push(it);
      else insumos.push(it);
    }
    return { acessorios, componentes, insumos };
  }, [accessoryItems]);


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

  const handlePrint = async () => {
    const el = document.querySelector<HTMLElement>('.print-area .printable-report');
    if (!el) {
      toast.error('Relatório não encontrado para gerar o PDF.');
      return;
    }
    const productSlug = (selectedProductData?.name || 'plano-de-corte')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const filename = `plano-de-corte-${productSlug || 'produto'}.pdf`;

    const t = toast.loading('Gerando PDF do plano de corte…');
    try {
      const { downloadElementAsPdf } = await import('@/utils/printableToPdf');
      await downloadElementAsPdf(el, filename);
      toast.success('PDF gerado com sucesso!', { id: t });
    } catch (err) {
      console.error('Falha ao gerar PDF do plano de corte:', err);
      toast.error('Não foi possível gerar o PDF.', { id: t });
    }
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
            onClick={handlePrint}
            className="gap-2"
            disabled={!selectedProduct || (calculatedCuts.length === 0 && calculatedGlassCuts.length === 0 && accessoryItems.length === 0)}
          >
            <Printer className="w-4 h-4" />
            Imprimir Plano (PDF)
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setOffcutsDialogOpen(true)}
            disabled={!selectedProduct || barOptimizationData.length === 0}
            title="Registrar as sobras do otimizador no Banco de Retalhos"
          >
            <Scissors className="w-4 h-4" />
            Registrar Sobras
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
                Baixar PDF

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

      <SaveOffcutsDialog
        open={offcutsDialogOpen}
        onOpenChange={setOffcutsDialogOpen}
        companyId={currentCompany?.id}
        profiles={barOptimizationData}
        defaultReference={productName ? `PC-${productName}` : null}
      />

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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-auto">
            <TabsTrigger value="cortes" className="px-6 gap-2">
              <Printer className="w-4 h-4" />
              Plano de Corte
            </TabsTrigger>
            <TabsTrigger value="acessorios" className="px-6 gap-2">
              <Package className="w-4 h-4" />
              Acessórios & Insumos
              {accessoryItems.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                  {accessoryItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="otimizacao" className="px-6 gap-2">
              <BarChart3 className="w-4 h-4" />
              Otimização de Barras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cortes" className="mt-4 space-y-6">
            {productItemsError ? (
              <div className="text-center py-12 border border-dashed border-destructive/40 rounded-lg bg-destructive/5">
                <p className="text-sm font-semibold text-destructive">Falha ao carregar a composição do produto.</p>
                <p className="text-xs text-muted-foreground mt-1">{(productItemsError as Error).message}</p>
              </div>
            ) : selectedProduct && (isLoadingItems || (isFetchingItems && !productItems)) ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Carregando composição…
              </div>
            ) : calculatedGlassCuts.length === 0 && calculatedCuts.length === 0 ? (
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
                  {(Object.keys(profileOverrides).length > 0 || Object.keys(glassOverrides).length > 0) && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProfileOverrides({});
                          setGlassOverrides({});
                        }}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restaurar fórmulas originais
                      </Button>
                    </div>
                  )}
                  <GlassCutsTable
                    glassCuts={calculatedGlassCuts}
                    showCheckboxes
                    onToggleComplete={handleToggleComplete}
                    editable
                    onFieldChange={handleGlassFieldChange}
                  />
                  <ProfileCutsTable
                    cuts={calculatedCuts}
                    showCheckboxes
                    onToggleComplete={handleToggleComplete}
                    getStorageUrl={getStorageUrl}
                    hoveredId={hoveredProfileId}
                    onHoverChange={setHoveredProfileId}
                    editable
                    onFieldChange={handleProfileFieldChange}
                  />
                </div>

              </>
            )}
          </TabsContent>



          <TabsContent value="acessorios" className="mt-4 space-y-6">
            {!selectedProduct ? (
              <div className="text-center py-12 text-muted-foreground">
                Selecione um produto para listar acessórios, componentes e insumos.
              </div>
            ) : accessoryItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum acessório, componente ou insumo configurado na composição deste produto.
              </div>
            ) : (
              <div className="space-y-4">
                <AccessoriesCutsTable
                  title="Acessórios"
                  icon="accessory"
                  items={accessoryBuckets.acessorios}
                  emptyMessage="Nenhum acessório (ferragens, roldanas, puxadores) nesta composição."
                />
                <AccessoriesCutsTable
                  title="Componentes Fixos"
                  icon="component"
                  items={accessoryBuckets.componentes}
                  emptyMessage="Nenhum componente fixo cadastrado."
                />
                <AccessoriesCutsTable
                  title="Insumos"
                  icon="input"
                  items={accessoryBuckets.insumos}
                  emptyMessage="Nenhum insumo (silicone, escovinha, borracha) cadastrado."
                />
              </div>
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
          companyLogoUrl={(currentCompany as any)?.logo_url ?? null}
          companyTagline="Vidros e Esquadrias"
          productHeadline={selectedProductData?.name || undefined}
          products={
            selectedProductData
              ? [{
                  productName: selectedProductData.name,
                  width,
                  height,
                  quantity,
                  imageUrl: productImage ?? (selectedProductData as any).image_url ?? null,
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
            imageUrl: (c as any).imageUrl ?? null,
          }))}
          glassCuts={calculatedGlassCuts.map((g) => ({
            glassName: g.customName || g.glassName,
            width: g.calculatedWidth,
            height: g.calculatedHeight,
            areaM2: g.areaM2,
            quantity: g.quantity,
            imageUrl: (g as any).imageUrl ?? null,
          }))}
          accessories={[
            ...accessoryBuckets.acessorios.map((i) => ({ itemName: i.itemName, type: 'Acessório', quantity: i.quantity, unit: i.unit, imageUrl: i.imageUrl ?? null })),
            ...accessoryBuckets.componentes.map((i) => ({ itemName: i.itemName, type: 'Componente Fixo', quantity: i.quantity, unit: i.unit, imageUrl: i.imageUrl ?? null })),
            ...accessoryBuckets.insumos.map((i) => ({ itemName: i.itemName, type: 'Insumo', quantity: i.quantity, unit: i.unit, imageUrl: i.imageUrl ?? null })),
          ]}
        />
      </div>
    </div>
  );
}


