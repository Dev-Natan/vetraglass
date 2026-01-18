import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Scissors, Maximize2 } from 'lucide-react';
import { GlassPreview } from '@/components/plano-corte/GlassPreview';

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

  return (
    <div className="space-y-6">
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
          <CardContent className="space-y-4">
            {/* Profile Cuts */}
            {plan.cuts_data && plan.cuts_data.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Cortes de Perfil
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
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
            )}

            {/* Glass Cuts */}
            {plan.glass_cuts_data && plan.glass_cuts_data.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  Cortes de Vidro
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plan.glass_cuts_data.map((glass: GlassCutData, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <GlassPreview 
                          width={glass.calculatedWidth} 
                          height={glass.calculatedHeight} 
                          maxSize={80}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{glass.glassName}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                L: {glass.widthFormula}
                              </Badge>
                              <Badge variant="outline" className="font-mono text-xs">
                                A: {glass.heightFormula}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="font-mono font-bold text-primary">
                              {glass.calculatedWidth} x {glass.calculatedHeight}mm
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{glass.quantity}x</span>
                            <span>•</span>
                            <span>{glass.areaM2.toFixed(2)} m²</span>
                          </div>
                        </div>
                      </div>
                    </div>
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
