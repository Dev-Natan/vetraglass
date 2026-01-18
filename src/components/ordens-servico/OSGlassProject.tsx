import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Maximize2 } from 'lucide-react';
import { GlassPreview } from '@/components/plano-corte/GlassPreview';

interface OSGlassProjectProps {
  ordemServicoId: string;
}

interface PanelData {
  index: number;
  name: string;
  width: number;
  height: number;
  areaM2: number;
  quantity: number;
}

interface GlassProject {
  id: string;
  product_name: string;
  vao_width: number;
  vao_height: number;
  quantity: number;
  panels_data: PanelData[];
  total_area_m2: number | null;
  glass_type: string | null;
  glass_color: string | null;
}

export function OSGlassProject({ ordemServicoId }: OSGlassProjectProps) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['os-glass-projects', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_glass_projects')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .order('created_at');

      if (error) throw error;
      return (data || []) as unknown as GlassProject[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum projeto de vidro gerado para esta OS.</p>
          <p className="text-sm mt-2">Os projetos são gerados automaticamente ao aprovar orçamentos com produtos que possuem fórmulas de vidro.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalArea = projects.reduce((sum, p) => sum + (p.total_area_m2 || 0), 0);
  const totalPanels = projects.reduce((sum, p) => sum + (p.panels_data?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Resumo do Projeto de Vidros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{projects.length}</div>
              <div className="text-sm text-muted-foreground">Produtos</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{totalPanels}</div>
              <div className="text-sm text-muted-foreground">Painéis</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{totalArea.toFixed(2)} m²</div>
              <div className="text-sm text-muted-foreground">Área Total</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {projects[0]?.glass_type || '-'}
              </div>
              <div className="text-sm text-muted-foreground">Espessura</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      {projects.map((project) => (
        <Card key={project.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{project.product_name}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Maximize2 className="w-4 h-4" />
                  <span>Vão: {project.vao_width} x {project.vao_height} mm</span>
                  <Badge variant="secondary">{project.quantity}x</Badge>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="font-mono">
                  {project.total_area_m2?.toFixed(2)} m²
                </Badge>
                {project.glass_color && (
                  <Badge variant="secondary" className="ml-2">
                    {project.glass_color}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Glass Panels Visualization */}
            <div className="flex items-end justify-center gap-4 p-4 bg-muted/30 rounded-lg mb-4">
              {project.panels_data?.map((panel: PanelData, idx: number) => (
                <div key={idx} className="flex flex-col items-center">
                  <GlassPreview 
                    width={panel.width} 
                    height={panel.height}
                    maxSize={120}
                  />
                  <div className="mt-2 text-center">
                    <div className="font-medium text-sm">{panel.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {panel.width} x {panel.height}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {panel.areaM2.toFixed(3)} m²
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Panels Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {project.panels_data?.map((panel: PanelData, idx: number) => (
                <div key={idx} className="border rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{panel.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{panel.width}mm</span>
                      <span>×</span>
                      <span className="font-mono">{panel.height}mm</span>
                    </div>
                  </div>
                  <Badge variant="outline">{panel.quantity}x</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
