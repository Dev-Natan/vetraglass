import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Scissors, Maximize2, Layers, Square } from 'lucide-react';
import { OSGlassCutCard } from './OSGlassCutCard';

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
}

interface GlassCutData {
  glassName: string;
  widthFormula: string;
  heightFormula: string;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
}

interface CuttingPlan {
  id: string;
  product_name: string;
  vao_width: number;
  vao_height: number;
  quantity: number;
  cuts_data: CutData[];
  glass_cuts_data: GlassCutData[];
}

export function OSCuttingPlan({ ordemServicoId }: OSCuttingPlanProps) {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['os-cutting-plan', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_cutting_plan')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .order('created_at');

      if (error) throw error;
      return (data || []) as unknown as CuttingPlan[];
    },
  });

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

      {plans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{plan.product_name}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Maximize2 className="w-4 h-4" />
                  <span>Vão: {plan.vao_width} x {plan.vao_height} mm</span>
                  <Badge variant="secondary">{plan.quantity}x</Badge>
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
                        <TableHead>Perfil</TableHead>
                        <TableHead>Fórmula</TableHead>
                        <TableHead>Posição</TableHead>
                        <TableHead className="text-right">Medida</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Ângulo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.cuts_data.map((cut: CutData, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{cut.profileName}</TableCell>
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
                          <TableCell className="text-right font-mono font-bold text-primary">
                            {cut.calculatedLength}mm
                          </TableCell>
                          <TableCell className="text-right">{cut.quantity}</TableCell>
                          <TableCell className="text-right">{cut.cutAngle}°</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Glass Cuts - Enhanced Display */}
            {plan.glass_cuts_data && plan.glass_cuts_data.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Square className="w-4 h-4" />
                  Cortes de Vidro
                  <Badge variant="outline" className="ml-2">
                    {plan.glass_cuts_data.length} tipo{plan.glass_cuts_data.length > 1 ? 's' : ''}
                  </Badge>
                </h4>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {plan.glass_cuts_data.map((glass: GlassCutData, idx: number) => (
                    <OSGlassCutCard 
                      key={idx}
                      glass={glass}
                      index={idx}
                      totalQuantity={plan.quantity}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
