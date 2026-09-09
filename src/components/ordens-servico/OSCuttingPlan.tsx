import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Scissors, Maximize2, Layers, Square, CheckCircle, Clock, Palette, AlertTriangle, FileDown, Printer } from 'lucide-react';
import { OSGlassUnifiedView } from './OSGlassUnifiedView';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { regenerateOSDocuments } from '@/utils/generateOSDocuments';
import { generateCuttingPlanPdf } from '@/utils/generateCuttingPlanPdf';
import { Loader2, RefreshCw } from 'lucide-react';
import { BarOptimizationView } from '@/components/plano-corte/BarOptimizationView';
import { PrintableCuttingReport, type PrintableProfileCut, type PrintableProductSummary } from '@/components/plano-corte/PrintableCuttingReport';
import { useOSComposition } from '@/hooks/useOSComposition';
import { useMemo } from 'react';
import { normalizeGlassCutSnapshot } from '@/utils/osMaterialStatus';




interface OSCuttingPlanProps {
  ordemServicoId: string;
}

interface CutData {
  profileName: string;
  formula: string;
  calculatedLength: number;
  quantity: number;
  cutAngle: number;
  position: string;
  side?: string;
  itemTemplateId?: string;
}

interface GlassCutData {
  glassName: string;
  widthFormula: string;
  heightFormula: string;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
  isMovable?: boolean;
  panelIndex?: number;
  side?: string;
}

interface CuttingPlan {
  id: string;
  product_name: string;
  vao_width: number;
  vao_height: number;
  vao_width_b?: number;
  vao_height_b?: number;
  quantity: number;
  cuts_data: CutData[];
  glass_cuts_data: GlassCutData[];
  status: string;
  item_status: Record<string, boolean>;
  quote_items?: {
    aluminum_color: string | null;
  } | null;
}

export function OSCuttingPlan({ ordemServicoId }: OSCuttingPlanProps) {
  const queryClient = useQueryClient();
  const { companies, currentCompany } = useAuth();
  const currentCompanyUser = companies.find(c => c.companyId === currentCompany?.id);
  const isAdmin = currentCompanyUser?.role === 'admin';

  const { data: plans, isLoading } = useQuery({
    queryKey: ['os-cutting-plan', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_cutting_plan')
        .select('*, quote_items(aluminum_color), os_items(*)')
        .eq('ordem_servico_id', ordemServicoId)
        .order('created_at');

      if (error) throw error;
      return (data || []).map((plan) => {
        const rawGlassCuts = Array.isArray(plan.glass_cuts_data)
          ? plan.glass_cuts_data
          : [];
        const glassCuts = rawGlassCuts
          .map((snapshot) => normalizeGlassCutSnapshot(snapshot as Record<string, unknown>))
          .filter((glass): glass is GlassCutData => glass !== null);

        return {
          ...plan,
          glass_cuts_data: glassCuts,
        } as unknown as CuttingPlan;
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ planId, itemKey, completed }: { planId: string; itemKey: string; completed: boolean }) => {
      // Get current plan
      const plan = plans?.find(p => p.id === planId);
      if (!plan) throw new Error('Plano não encontrado');

      const newItemStatus = { ...(plan.item_status || {}), [itemKey]: completed };
      
      // Calculate total items from actual cuts_data and glass_cuts_data
      const cutsData = (plan.cuts_data as any[]) || [];
      const glassData = (plan.glass_cuts_data as any[]) || [];
      const profileCount = cutsData.reduce((sum: number, cut: any) => sum + (cut.quantity || 1), 0);
      const glassCount = glassData.reduce((sum: number, glass: any) => sum + (glass.quantity || 1), 0);
      const totalItems = (profileCount + glassCount) * (plan.quantity || 1);
      
      const completedItems = Object.values(newItemStatus).filter(v => v === true).length;
      
      let newStatus = 'pending';
      if (completedItems > 0 && completedItems < totalItems) {
        newStatus = 'in_progress';
      } else if (completedItems >= totalItems && totalItems > 0) {
        newStatus = 'completed';
      }

      const { error } = await supabase
        .from('os_cutting_plan')
        .update({ 
          item_status: newItemStatus,
          status: newStatus
        })
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-cutting-plan', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['cutting-plan-progress', ordemServicoId] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const handleItemToggle = (planId: string, itemKey: string, currentValue: boolean) => {
    updateStatusMutation.mutate({ planId, itemKey, completed: !currentValue });
  };

  // Aggregated bar-optimization data across ALL plans of this OS.
  // Groups identical profiles by itemTemplateId (fallback to profileName)
  // and multiplies each cut by the plan quantity so the FFD packer
  // produces a single consolidated bar layout per profile.
  const aggregatedBarCuts = useMemo(() => {
    const all: Array<{
      itemTemplateId: string;
      itemName: string;
      cutLength: number;
      quantity: number;
      barLengthMm: number;
    }> = [];
    (plans || []).forEach((plan: any) => {
      const planQty = plan.quantity || 1;
      (plan.cuts_data || []).forEach((cut: CutData) => {
        if (!cut?.calculatedLength || !cut?.quantity) return;
        all.push({
          itemTemplateId: cut.itemTemplateId || cut.profileName,
          itemName: cut.profileName,
          cutLength: Math.round(cut.calculatedLength),
          quantity: cut.quantity * planQty,
          barLengthMm: 6000,
        });
      });
    });
    return all;
  }, [plans]);

  // Aggregated data for printable report (products + all cuts)
  const printProducts: PrintableProductSummary[] = useMemo(
    () =>
      (plans || []).map((p: any) => ({
        productName: p.product_name,
        width: p.os_items?.largura_producao || p.vao_width,
        height: p.os_items?.altura_producao || p.vao_height,
        quantity: p.quantity || 1,
      })),
    [plans]
  );

  const printProfileCuts: PrintableProfileCut[] = useMemo(() => {
    const rows: PrintableProfileCut[] = [];
    (plans || []).forEach((plan: any) => {
      const planQty = plan.quantity || 1;
      (plan.cuts_data || []).forEach((cut: CutData) => {
        if (!cut?.calculatedLength || !cut?.quantity) return;
        rows.push({
          profileName: cut.profileName,
          calculatedLength: Math.round(cut.calculatedLength),
          quantity: cut.quantity * planQty,
          cutAngle: cut.cutAngle,
          position: cut.position,
          itemTemplateId: cut.itemTemplateId || cut.profileName,
        });
      });
    });
    return rows;
  }, [plans]);


  const recalculateMutation = useMutation({
    mutationFn: (osItemId: string) => regenerateOSDocuments(ordemServicoId, osItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-cutting-plan', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-materials', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-items', ordemServicoId] });
      toast.success('Plano recalculado com sucesso!');
    },
    onError: (error: Error) => toast.error('Erro ao recalcular: ' + error.message)
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return <FallbackDynamicCuttingPlan ordemServicoId={ordemServicoId} />;
  }


  // Calculate totals for summary
  const totalGlassArea = plans.reduce((sum, plan) => {
    const planArea = (plan.glass_cuts_data || []).reduce((acc, glass) => 
      acc + (glass.areaM2 * glass.quantity * plan.quantity), 0);
    return sum + planArea;
  }, 0);

  const totalGlassPanels = plans.reduce((sum, plan) => {
    const panelCount = (plan.glass_cuts_data || []).reduce((acc, glass) => 
      acc + (glass.quantity * plan.quantity), 0);
    return sum + panelCount;
  }, 0);

  const handleDownloadPdf = async () => {
    try {
      const [{ data: os }, { data: materials }, { data: companyRow }] = await Promise.all([
        supabase
          .from('ordens_servico')
          .select('os_number, customer_name, estimated_end, company_id')
          .eq('id', ordemServicoId)
          .single(),
        supabase
          .from('os_materials')
          .select('item_name, unit, pieces_count, notes, item_type, os_item_id')
          .eq('ordem_servico_id', ordemServicoId),
        supabase
          .from('ordens_servico')
          .select('companies(name, cnpj, phone)')
          .eq('id', ordemServicoId)
          .single(),
      ]);

      if (!os) throw new Error('OS não encontrada');

      const accessoriesByOsItem = new Map<string, any[]>();
      (materials || []).forEach((m: any) => {
        if (m.item_type === 'profile') return;
        const list = accessoriesByOsItem.get(m.os_item_id) || [];
        list.push(m);
        accessoriesByOsItem.set(m.os_item_id, list);
      });

      const planData = plans!.map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        vao_width: p.vao_width,
        vao_height: p.vao_height,
        vao_width_b: p.vao_width_b,
        vao_height_b: p.vao_height_b,
        quantity: p.quantity,
        cuts_data: p.cuts_data || [],
        glass_cuts_data: p.glass_cuts_data || [],
        aluminum_color: p.quote_items?.aluminum_color,
        accessories: accessoriesByOsItem.get(p.os_item_id) || [],
      }));

      const company = (companyRow as any)?.companies || null;

      generateCuttingPlanPdf(
        planData,
        { os_number: os.os_number, customer_name: os.customer_name, estimated_end: os.estimated_end },
        company,
        'download',
        isAdmin
      );
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    }
  };


  return (
    <div className="space-y-6">
      {/* Print / PDF actions (hidden on print) */}
      <div className="flex items-center justify-end gap-2 no-print">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
          <Printer className="w-4 h-4" />
          Imprimir Plano
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPdf}>
          <FileDown className="w-4 h-4" />
          Baixar PDF
        </Button>
      </div>

      {/* On-screen content (hidden on print) */}
      <div className="no-print space-y-6">

      {/* Consolidated Bar Optimization for the entire OS */}
      {aggregatedBarCuts.length > 0 && (
        <BarOptimizationView cuts={aggregatedBarCuts} />
      )}


      {/* Summary Card for Glass */}
      {totalGlassPanels > 0 && (
        <Card className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30 border-sky-200 dark:border-sky-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Resumo de Vidros</h3>
                  <p className="text-sm text-muted-foreground">Total de painéis e área</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{totalGlassPanels}</div>
                  <div className="text-xs text-muted-foreground">Painéis</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{totalGlassArea.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">m² total</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {plans.map((plan) => {
        const itemStatus = plan.item_status || {};
        const allItemKeys: string[] = [];
        
        // Generate keys for profile cuts
        (plan.cuts_data || []).forEach((cut, idx) => {
          for (let i = 0; i < cut.quantity; i++) {
            allItemKeys.push(`profile_${idx}_${i}`);
          }
        });
        
        // Generate keys for glass cuts
        (plan.glass_cuts_data || []).forEach((glass, idx) => {
          for (let i = 0; i < glass.quantity; i++) {
            allItemKeys.push(`glass_${idx}_${i}`);
          }
        });

        // Ensure all keys exist in itemStatus
        const normalizedItemStatus = { ...itemStatus };
        allItemKeys.forEach(key => {
          if (normalizedItemStatus[key] === undefined) {
            normalizedItemStatus[key] = false;
          }
        });

        const totalItems = allItemKeys.length;
        const completedItems = allItemKeys.filter(k => normalizedItemStatus[k] === true).length;
        const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        const statusConfig = {
          pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600' },
          in_progress: { label: 'Em Produção', icon: Scissors, color: 'text-blue-600' },
          completed: { label: 'Concluído', icon: CheckCircle, color: 'text-green-600' },
        };
        const currentStatus = statusConfig[plan.status as keyof typeof statusConfig] || statusConfig.pending;
        const StatusIcon = currentStatus.icon;

        return (
          <Card key={plan.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {plan.product_name}
                    <Badge variant="outline" className={`gap-1 ${currentStatus.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {currentStatus.label}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Maximize2 className="w-4 h-4" />
                        <span>Vão A Produção: {plan.os_items?.largura_producao || plan.vao_width} x {plan.os_items?.altura_producao || plan.vao_height} mm</span>
                        <Badge variant="secondary">{plan.quantity}x</Badge>
                      </div>
                      {plan.os_items?.largura_producao_b && (
                        <div className="flex items-center gap-2 pl-6">
                          <span>Vão B Produção: {plan.os_items.largura_producao_b} x {plan.os_items.altura_producao_b} mm</span>
                        </div>
                      )}
                      {plan.os_items?.largura_producao_c && (
                        <div className="flex items-center gap-2 pl-6">
                          <span>Vão C Produção: {plan.os_items.largura_producao_c} x {plan.os_items.altura_producao_c} mm</span>
                        </div>
                      )}
                      {plan.quote_items?.aluminum_color && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                            <Palette className="w-3 h-3" />
                            {plan.quote_items.aluminum_color}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {plan.os_items?.recalculation_required && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-1 px-2 rounded-md w-fit font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Medidas alteradas. Recalcule para atualizar o plano.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {plan.os_items?.recalculation_required && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 text-amber-600 border-amber-500/50 hover:bg-amber-50"
                      onClick={() => recalculateMutation.mutate(plan.os_item_id)}
                      disabled={recalculateMutation.isPending}
                    >
                      {recalculateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Recalcular
                    </Button>
                  )}
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Progresso</div>
                    <div className="font-bold">{completedItems}/{totalItems}</div>
                  </div>
                  <div className="w-24">
                    <Progress value={progressPercent} className="h-2" />
                    <div className="text-xs text-center mt-1 text-muted-foreground">{progressPercent}%</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Cuts */}
              {plan.cuts_data && plan.cuts_data.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Scissors className="w-4 h-4" />
                    Cortes de Perfil
                  </h4>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12">✓</TableHead>
                          <TableHead>Perfil</TableHead>
                          
                          <TableHead>Posição</TableHead>
                          <TableHead className="text-right">Medida</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Ângulo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plan.cuts_data.map((cut: CutData, idx: number) => {
                          // For each quantity, create a checkable row
                          const rows = [];
                          for (let i = 0; i < cut.quantity; i++) {
                            const itemKey = `profile_${idx}_${i}`;
                            const isCompleted = normalizedItemStatus[itemKey] === true;
                            rows.push(
                              <TableRow key={itemKey} className={isCompleted ? 'bg-green-50/50 dark:bg-green-950/20' : ''}>
                                <TableCell>
                                  <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() => handleItemToggle(plan.id, itemKey, isCompleted)}
                                    disabled={updateStatusMutation.isPending}
                                  />
                                </TableCell>
                                <TableCell className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                  <div className="flex flex-col">
                                    <span>{cut.profileName}</span>
                                    {cut.side && <Badge variant="outline" className="w-fit text-[10px] px-1 py-0 mt-0.5">Lado {cut.side}</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={(cut.position === 'Altura' || (cut.formula && (cut.formula.toLowerCase().includes('altura') || /\b[ah]\b/i.test(cut.formula) || /\bh[abc]\b/i.test(cut.formula)))) && !(cut.formula && (cut.formula.toLowerCase().includes('largura') || /\b[lw]\b/i.test(cut.formula) || /\bw[abc]\b/i.test(cut.formula))) ? 'default' : 'secondary'}>
                                    {cut.position}
                                  </Badge>
                                </TableCell>
                                <TableCell className={`text-right font-mono font-bold ${isCompleted ? 'text-muted-foreground' : 'text-primary'}`}>
                                  {cut.calculatedLength}mm
                                </TableCell>
                                <TableCell className="text-right">1</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="flex h-6 items-center gap-0.5 px-1 bg-muted rounded border overflow-hidden">
                                      <div 
                                        className="h-full w-1.5 bg-primary/40" 
                                        style={{ 
                                          transform: cut.cutAngle === 45 || cut.cutAngle === 4545 || cut.cutAngle === 4590 ? 'skewY(-45deg)' : 'none',
                                          transformOrigin: 'top'
                                        }}
                                      />
                                      <div className="h-0.5 w-4 bg-primary/60" />
                                      <div 
                                        className="h-full w-1.5 bg-primary/40" 
                                        style={{ 
                                          transform: cut.cutAngle === 45 || cut.cutAngle === 4545 || cut.cutAngle === 9045 ? 'skewY(45deg)' : 'none',
                                          transformOrigin: 'top'
                                        }}
                                      />
                                    </div>
                                    <span className="font-mono">{
                                      cut.cutAngle === 4545 ? '45/45' :
                                      cut.cutAngle === 4590 ? '45/90' :
                                      cut.cutAngle === 9045 ? '90/45' :
                                      cut.cutAngle === 9090 ? '90/90' :
                                      `${cut.cutAngle}°`
                                    }</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }
                          return rows;
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Glass Cuts - Unified Diagram View */}
              {plan.glass_cuts_data && plan.glass_cuts_data.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Square className="w-4 h-4" />
                    Plano de Corte de Vidros
                    <Badge variant="outline" className="ml-2">
                      {plan.glass_cuts_data.length} tipo{plan.glass_cuts_data.length > 1 ? 's' : ''}
                    </Badge>
                  </h4>
                  
                  {/* Glass checkboxes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    {plan.glass_cuts_data.map((glass, idx) => {
                      const glassItems = [];
                      for (let i = 0; i < glass.quantity; i++) {
                        const itemKey = `glass_${idx}_${i}`;
                        const isCompleted = normalizedItemStatus[itemKey] === true;
                        glassItems.push(
                          <div
                            key={itemKey}
                            className={`flex items-center gap-2 p-2 rounded border ${isCompleted ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-background'}`}
                          >
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => handleItemToggle(plan.id, itemKey, isCompleted)}
                              disabled={updateStatusMutation.isPending}
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                {glass.glassName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {glass.calculatedWidth} x {glass.calculatedHeight}mm
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return glassItems;
                    })}
                  </div>

                  <OSGlassUnifiedView
                    glassCuts={plan.glass_cuts_data}
                    vaoWidth={plan.vao_width}
                    vaoHeight={plan.vao_height}
                    productQuantity={plan.quantity}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      </div>

      {/* Print-only report (visible exclusively via @media print) */}
      <div className="print-area">
        <PrintableCuttingReport
          companyName={currentCompany?.name || 'Urbano Vidros'}
          companyLogoUrl={(currentCompany as any)?.logo_url ?? null}
          companyTagline="Vidros e Esquadrias"
          quoteOrOsNumber={(plans[0] as any)?.os_number || undefined}
          clientName={(plans[0] as any)?.customer_name || undefined}
          productHeadline={printProducts[0]?.productName || undefined}
          products={printProducts}
          profileCuts={printProfileCuts}
        />
      </div>
    </div>
  );
}

/**
 * Fallback view rendered when no os_cutting_plan snapshot exists.
 * Derives cuts dynamically from the effective composition of each OS product
 * (company override > admin default) and pipes them into BarOptimizationView
 * plus a lightweight glass panels list.
 */
function FallbackDynamicCuttingPlan({ ordemServicoId }: { ordemServicoId: string }) {
  const { items, profiles, glasses, isLoading } = useOSComposition(ordemServicoId);

  const cuts = useMemo(() => {
    return profiles
      .filter((p) => (p.calculatedLengthMm || 0) > 0)
      .map((p) => ({
        itemTemplateId: p.itemTemplateId || `${p.itemName}-${p.calculatedLengthMm}`,
        itemName: p.itemName,
        cutLength: p.calculatedLengthMm || 0,
        quantity: p.calculatedQty,
        barLengthMm: p.barLengthMm || 6000,
        unit: 'mm',
      }));
  }, [profiles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!items.length || (!cuts.length && !glasses.length)) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Scissors className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum plano de corte disponível.</p>
          <p className="text-sm mt-2">
            Verifique se os produtos desta OS têm composição (perfis e vidros) configurada.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalGlassPanels = glasses.reduce((s, g) => s + g.calculatedQty, 0);
  const totalGlassArea = glasses.reduce(
    (s, g) => s + (g.calculatedWidth / 1000) * (g.calculatedHeight / 1000) * g.calculatedQty,
    0,
  );

  return (
    <div className="space-y-6">
      <Card className="bg-muted/30">
        <CardContent className="py-3 text-xs text-muted-foreground">
          Plano de corte calculado dinamicamente a partir da composição efetiva de cada produto
          (herança: empresa &gt; padrão do administrador).
        </CardContent>
      </Card>

      {cuts.length > 0 && <BarOptimizationView cuts={cuts} />}

      {glasses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Vidros ({totalGlassPanels} painéis · {totalGlassArea.toFixed(2)} m²)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Vidro</TableHead>
                  <TableHead>Lado</TableHead>
                  <TableHead className="text-right">Largura</TableHead>
                  <TableHead className="text-right">Altura</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {glasses.map((g, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{g.productName}</TableCell>
                    <TableCell>{g.itemName}</TableCell>
                    <TableCell>
                      {g.side ? <Badge variant="outline">Lado {g.side}</Badge> : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{g.calculatedWidth}mm</TableCell>
                    <TableCell className="text-right font-mono">{g.calculatedHeight}mm</TableCell>
                    <TableCell className="text-right">{g.calculatedQty}x</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


