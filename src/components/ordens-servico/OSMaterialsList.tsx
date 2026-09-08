import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Ruler, AlertTriangle, CheckCircle, List, Boxes } from 'lucide-react';
import { formatMm, distributeAcrossBars } from '@/utils/profileOptimization';
import { osService } from '@/services/osService';
import { Link } from 'react-router-dom';
import { formatOperationalQuantity, getOsMaterialSituation } from '@/utils/osMaterialStatus';

interface OSMaterialsListProps {
  ordemServicoId: string;
}

interface MaterialAvailabilityItem {
  requirement_id?: string;
  company_item_id: string | null;
  item_name: string;
  unit: string;
  canonical_unit: string;
  required: number;
  reserved_for_os: number;
  missing: number;
  status: string;
  sufficient: boolean;
}

interface MaterialAvailability {
  success: boolean;
  sufficient: boolean;
  items: MaterialAvailabilityItem[];
}

interface ConsolidatedMaterial {
  item_name: string;
  item_type: string;
  total_length: number;
  total_quantity: number;
  unit: string;
  bars_needed?: number;
}


export function OSMaterialsList({ ordemServicoId }: OSMaterialsListProps) {
  const [viewMode, setViewMode] = useState<'individual' | 'consolidated'>('individual');

  const { data: materials, isLoading } = useQuery({
    queryKey: ['os-materials', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_materials')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .order('item_name');

      if (error) throw error;
      return data || [];
    },
  });

  const { data: consolidatedMaterials, isLoading: isConsolidatedLoading } = useQuery({
    queryKey: ['os-materials-consolidated', ordemServicoId],
    queryFn: () => osService.getConsolidatedMaterials(ordemServicoId),
    enabled: viewMode === 'consolidated'
  });

  const { data: availability } = useQuery({
    queryKey: ['os-material-availability', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_os_material_availability', {
        _ordem_servico_id: ordemServicoId,
      });
      if (error) throw error;
      return data as unknown as MaterialAvailability;
    },
  });

  if (isLoading || isConsolidatedLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const snapshotEmpty = !materials || materials.length === 0;

  if (snapshotEmpty) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="font-medium text-foreground">Snapshot de materiais indisponível</p>
          <p className="text-sm mt-1">
            A composição histórica desta OS não pode ser recalculada pelo catálogo atual.
          </p>
        </CardContent>
      </Card>
    );
  }
  // Group by item type for individual view
  const profiles = materials.filter(m => m.item_type === 'profile');
  const totalBars = profiles.reduce((sum, p) => sum + (p.bars_needed || 0), 0);
  const totalWaste = profiles.reduce((sum, p) => sum + (p.waste_mm || 0), 0);
  const totalLength = profiles.reduce((sum, p) => sum + (p.total_length_mm || 0), 0);
  const avgWaste = totalLength > 0 
    ? Math.round((totalWaste / (totalLength + totalWaste)) * 1000) / 10 
    : 0;


  return (
    <div className="space-y-6">
      {availability && (
        <Card className={availability.sufficient ? 'border-green-500/30' : 'border-amber-500/50'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {availability.sufficient ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              )}
              Disponibilidade operacional
              <Badge variant={availability.sufficient ? 'default' : 'secondary'}>
                {availability.sufficient ? 'Material suficiente' : 'Material faltante'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Necessário</TableHead>
                    <TableHead className="text-right">Reservado p/ OS</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availability.items.map((item, index) => {
                    const situation = getOsMaterialSituation({
                      status: item.status,
                      reserved: item.reserved_for_os,
                      missing: item.missing,
                    });
                    const badgeVariant = situation === 'Comprar'
                      ? 'destructive'
                      : situation === 'Atendido'
                        ? 'default'
                        : 'secondary';

                    return (
                      <TableRow key={item.requirement_id ?? item.company_item_id ?? `${item.item_name}-${index}`}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="text-right font-mono">{formatOperationalQuantity(item.required, item.canonical_unit)}</TableCell>
                        <TableCell className="text-right font-mono">{formatOperationalQuantity(item.reserved_for_os, item.canonical_unit)}</TableCell>
                        <TableCell className={`text-right font-mono ${Number(item.missing) > 0 ? 'text-destructive font-semibold' : 'text-green-600'}`}>
                          {formatOperationalQuantity(item.missing, item.canonical_unit)}
                        </TableCell>
                        <TableCell><Badge variant={badgeVariant}>{situation}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {!availability.sufficient ? (
              <Button asChild variant="outline">
                <Link to="/pedidos-compra">Ver necessidades de compra</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-start">
        <Tabs
          value={viewMode}
          onValueChange={(value) => {
            if (value === 'individual' || value === 'consolidated') setViewMode(value);
          }}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="individual" className="gap-2">
              <List className="w-4 h-4" />
              Individual
            </TabsTrigger>
            <TabsTrigger value="consolidated" className="gap-2">
              <Boxes className="w-4 h-4" />
              Consolidado
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'individual' ? (
        <>
          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Resumo de Materiais
              </CardTitle>
            </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{profiles.length}</div>
              <div className="text-sm text-muted-foreground">Tipos de Perfis</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{totalBars}</div>
              <div className="text-sm text-muted-foreground">Barras Necessárias</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{formatMm(totalLength)}</div>
              <div className="text-sm text-muted-foreground">Comprimento Total</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className={`text-2xl font-bold ${avgWaste > 20 ? 'text-destructive' : avgWaste > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                {avgWaste}%
              </div>
              <div className="text-sm text-muted-foreground">Desperdício Médio</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profiles List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ruler className="w-5 h-5" />
            Perfis de Alumínio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profiles.map((profile) => {
              // Parse cuts from notes
              const cutsFromNotes = profile.notes?.split(', ').map(s => {
                const match = s.match(/(\d+)x\s*(\d+)mm/);
                if (match) {
                  return { qty: parseInt(match[1]), length: parseInt(match[2]) };
                }
                return null;
              }).filter(Boolean) || [];

              const bars = distributeAcrossBars(
                cutsFromNotes as Array<{ length: number; qty: number }>,
                profile.bar_length_mm || 6000
              );

              return (
                <div key={profile.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{profile.item_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Barra: {formatMm(profile.bar_length_mm || 6000)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {profile.bars_needed} barra{profile.bars_needed !== 1 ? 's' : ''}
                      </Badge>
                      <Badge 
                        variant={
                          (profile.waste_percent || 0) > 20 ? 'destructive' : 
                          (profile.waste_percent || 0) > 10 ? 'secondary' : 
                          'default'
                        }
                      >
                        {profile.waste_percent?.toFixed(1)}% sobra
                      </Badge>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* Cuts breakdown */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Cortes necessários:</div>
                    <div className="flex flex-wrap gap-2">
                      {cutsFromNotes.map((cut, idx) => (
                        <Badge key={idx} variant="secondary" className="font-mono">
                          {cut?.qty}x {cut?.length}mm
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Bar distribution visualization */}
                  {bars.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium">Distribuição nas barras:</div>
                      <div className="space-y-2">
                        {bars.slice(0, 5).map((bar) => (
                          <div key={bar.barIndex} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16">
                              Barra {bar.barIndex}
                            </span>
                            <div className="flex-1 h-6 bg-muted rounded overflow-hidden flex">
                              {bar.cuts.map((cut, idx) => {
                                const widthPercent = (cut.length / (profile.bar_length_mm || 6000)) * 100;
                                return (
                                  <div
                                    key={idx}
                                    className="h-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground border-r border-background"
                                    style={{ width: `${widthPercent * cut.qty}%` }}
                                    title={`${cut.qty}x ${cut.length}mm`}
                                  >
                                    {widthPercent > 8 && `${cut.length}`}
                                  </div>
                                );
                              })}
                              {bar.remainingLength > 0 && (
                                <div 
                                  className="h-full bg-muted-foreground/20 flex items-center justify-center text-[10px]"
                                  style={{ width: `${(bar.remainingLength / (profile.bar_length_mm || 6000)) * 100}%` }}
                                >
                                  {bar.remainingLength > 200 && `${bar.remainingLength}mm`}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              {bar.remainingLength > 0 ? (
                                <span className="text-yellow-600">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  {formatMm(bar.remainingLength)}
                                </span>
                              ) : (
                                <span className="text-green-600">
                                  <CheckCircle className="w-3 h-3 inline mr-1" />
                                  Exato
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                        {bars.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            ... e mais {bars.length - 5} barras
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total: {profile.pieces_count} peças = {formatMm(profile.total_length_mm || 0)}
                    </span>
                    <span className="text-muted-foreground">
                      Sobra: {formatMm(profile.waste_mm || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Boxes className="w-5 h-5" />
              Materiais Consolidados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Tipo</th>
                    <th className="p-3 text-right">Qtd Total</th>
                    <th className="p-3 text-left">Unidade</th>
                    <th className="p-3 text-right">Barras</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(consolidatedMaterials as ConsolidatedMaterial[] | undefined)?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium">{item.item_name}</td>
                      <td className="p-3">
                        <Badge variant="outline">{item.item_type === 'profile' ? 'Perfil' : 'Acessório'}</Badge>
                      </td>
                      <td className="p-3 text-right font-mono">
                        {item.item_type === 'profile' ? formatMm(item.total_length) : item.total_quantity}
                      </td>
                      <td className="p-3">{item.unit}</td>
                      <td className="p-3 text-right">{item.bars_needed || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
