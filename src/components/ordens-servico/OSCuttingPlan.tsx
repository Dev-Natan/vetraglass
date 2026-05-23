import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Scissors, Maximize2, Layers, Square, CheckCircle, Clock, Palette } from 'lucide-react';
import { OSGlassUnifiedView } from './OSGlassUnifiedView';
import { toast } from 'sonner';

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

  const { data: plans, isLoading } = useQuery({
    queryKey: ['os-cutting-plan', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_cutting_plan')
        .select('*, quote_items(aluminum_color)')
        .eq('ordem_servico_id', ordemServicoId)
        .order('created_at');

      if (error) throw error;
      return (data || []) as unknown as CuttingPlan[];
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Scissors className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum plano de corte gerado para esta OS.</p>
          <p className="text-sm mt-2">Os planos são gerados automaticamente ao aprovar orçamentos com produtos configurados.</p>
        </CardContent>
      </Card>
    );
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

  return (
    <div className="space-y-6">
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
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Maximize2 className="w-4 h-4" />
                    <span>Vão: {plan.vao_width} {plan.vao_width_b ? `x ${plan.vao_width_b}` : ''} x {plan.vao_height} mm</span>
                    <Badge variant="secondary">{plan.quantity}x</Badge>
                    {plan.quote_items?.aluminum_color && (
                      <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                        <Palette className="w-3 h-3" />
                        {plan.quote_items.aluminum_color}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
                          <TableHead>Fórmula</TableHead>
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
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {cut.formula}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={cut.position === 'Altura' ? 'default' : 'secondary'}>
                                    {cut.position}
                                  </Badge>
                                </TableCell>
                                <TableCell className={`text-right font-mono font-bold ${isCompleted ? 'text-muted-foreground' : 'text-primary'}`}>
                                  {cut.calculatedLength}mm
                                </TableCell>
                                <TableCell className="text-right">1</TableCell>
                                <TableCell className="text-right">{cut.cutAngle}°</TableCell>
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
  );
}
