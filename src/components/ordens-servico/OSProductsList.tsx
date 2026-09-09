import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { osService, OSItem } from '@/services/osService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogDescription, DialogTrigger 
} from '@/components/ui/dialog';
import { 
  History, Wrench, RefreshCw, AlertTriangle, 
  Maximize2, Ruler, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { regenerateOSDocuments } from '@/utils/generateOSDocuments';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OSProductsListProps {
  ordemServicoId: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function humanizeSpecification(value: unknown): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string' || !value.trim()) return null;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) return null;
  return value.replaceAll('_', ' ').trim();
}

function snapshotSpecifications(snapshot: unknown): string[] {
  const root = asRecord(snapshot);
  if (!root) return [];

  const result = new Set<string>();
  const entries = [
    ...(Array.isArray(root.materials) ? root.materials : []),
    ...(Array.isArray(root.glass_pieces) ? root.glass_pieces : []),
  ];

  for (const entry of entries) {
    const specification = asRecord(asRecord(entry)?.specification);
    if (!specification) continue;
    const type = humanizeSpecification(specification.type);
    const color = humanizeSpecification(specification.color);
    const thickness = humanizeSpecification(specification.thickness_mm);
    const finish = humanizeSpecification(specification.finish);
    const label = [
      type,
      color,
      thickness ? `${thickness} mm` : null,
      finish,
    ].filter(Boolean).join(' · ');
    if (label) result.add(label);
  }

  return Array.from(result);
}

export function OSProductsList({ ordemServicoId }: OSProductsListProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState<OSItem | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  
  const { data: items, isLoading } = useQuery({
    queryKey: ['os-items', ordemServicoId],
    queryFn: () => osService.getOSItems(ordemServicoId)
  });

  const { data: history } = useQuery({
    queryKey: ['os-dimension-history', selectedItem?.id],
    queryFn: () => osService.getDimensionHistory(selectedItem!.id),
    enabled: !!selectedItem && isHistoryOpen
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { 
      largura: number; 
      altura: number; 
      largura_producao_b?: number | null;
      altura_producao_b?: number | null;
      largura_producao_c?: number | null;
      altura_producao_c?: number | null;
      notes: string 
    }) => 
      osService.updateProductionDimensions(selectedItem!.id, {
        largura_producao: data.largura,
        altura_producao: data.altura,
        largura_producao_b: data.largura_producao_b,
        altura_producao_b: data.altura_producao_b,
        largura_producao_c: data.largura_producao_c,
        altura_producao_c: data.altura_producao_c,
        technical_notes: data.notes
      }, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-items', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-materials', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-cutting-plan', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-composition-accessories', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-composition-glasses', ordemServicoId] });
      
      toast.success('Ajuste técnico salvo e cálculos atualizados!');
      setIsAdjusting(false);
    },
    onError: (error: Error) => toast.error('Erro ao salvar ajuste: ' + error.message)
  });


  const recalculateMutation = useMutation({
    mutationFn: (osItemId?: string) => regenerateOSDocuments(ordemServicoId, osItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-items', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-materials', ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ['os-cutting-plan', ordemServicoId] });
      toast.success('Cálculos atualizados com sucesso!');
    },
    onError: (error: Error) => toast.error('Erro ao recalcular: ' + error.message)
  });

  if (isLoading) return <div className="p-8 text-center">Carregando produtos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Produtos da OS</h3>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={() => recalculateMutation.mutate(undefined)}
          disabled={recalculateMutation.isPending}
        >
          {recalculateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Recalcular Todos
        </Button>
      </div>

      <div className="grid gap-4">
        {items?.map((item) => {
          const specifications = snapshotSpecifications(item.engineering_snapshot);
          return (
          <Card key={item.id} className={item.recalculation_required ? 'border-amber-500 bg-amber-50/10' : ''}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold">{item.product_name}</h4>
                    <Badge variant="secondary">{item.quantity}x</Badge>
                    {item.recalculation_required && (
                      <Badge variant="destructive" className="bg-amber-600 text-white gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Recalcular
                      </Badge>
                    )}
                  </div>
                  
                  {(item.profile_color_name || specifications.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {item.profile_color_name ? (
                        <Badge variant="outline">Cor: {item.profile_color_name}</Badge>
                      ) : null}
                      {specifications.map((specification) => (
                        <Badge key={specification} variant="outline">{specification}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 mt-4">
                    {/* Side A */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                        <Label className="text-muted-foreground text-xs uppercase">Lado A - Venda (Bloqueado)</Label>
                        <div className="flex items-center gap-2 font-mono text-lg opacity-60">
                          <Maximize2 className="w-4 h-4" />
                          {item.largura_venda} x {item.altura_venda} mm
                        </div>
                      </div>
                      <div className="space-y-1 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                        <Label className="text-primary/70 text-xs uppercase font-bold">Lado A - Produção</Label>
                        <div className="flex items-center gap-2 font-mono text-lg text-primary font-bold">
                          <Ruler className="w-4 h-4" />
                          {item.largura_producao} x {item.altura_producao} mm
                        </div>
                      </div>
                    </div>

                    {/* Side B */}
                    {(item.largura_venda_b || item.largura_producao_b) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                          <Label className="text-muted-foreground text-xs uppercase">Lado B - Venda</Label>
                          <div className="flex items-center gap-2 font-mono text-lg opacity-60">
                            <Maximize2 className="w-4 h-4" />
                            {item.largura_venda_b || '-'} x {item.altura_venda_b || '-'} mm
                          </div>
                        </div>
                        <div className="space-y-1 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                          <Label className="text-primary/70 text-xs uppercase font-bold">Lado B - Produção</Label>
                          <div className="flex items-center gap-2 font-mono text-lg text-primary font-bold">
                            <Ruler className="w-4 h-4" />
                            {item.largura_producao_b || '-'} x {item.altura_producao_b || '-'} mm
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Side C */}
                    {(item.largura_venda_c || item.largura_producao_c) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                          <Label className="text-muted-foreground text-xs uppercase">Lado C - Venda</Label>
                          <div className="flex items-center gap-2 font-mono text-lg opacity-60">
                            <Maximize2 className="w-4 h-4" />
                            {item.largura_venda_c || '-'} x {item.altura_venda_c || '-'} mm
                          </div>
                        </div>
                        <div className="space-y-1 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                          <Label className="text-primary/70 text-xs uppercase font-bold">Lado C - Produção</Label>
                          <div className="flex items-center gap-2 font-mono text-lg text-primary font-bold">
                            <Ruler className="w-4 h-4" />
                            {item.largura_producao_c || '-'} x {item.altura_producao_c || '-'} mm
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {item.technical_notes && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      Obs: {item.technical_notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap md:flex-col gap-2 justify-start md:justify-center">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => {
                      setSelectedItem(item);
                      setIsAdjusting(true);
                    }}
                  >
                    <Wrench className="w-4 h-4" />
                    Ajuste Técnico
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => {
                      setSelectedItem(item);
                      setIsHistoryOpen(true);
                    }}
                  >
                    <History className="w-4 h-4" />
                    Ver Histórico
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => recalculateMutation.mutate(item.id)}
                    disabled={recalculateMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Recalcular
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Adjust Dimensions Dialog */}
      <Dialog open={isAdjusting} onOpenChange={setIsAdjusting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste Técnico - {selectedItem?.product_name}</DialogTitle>
            <DialogDescription>
              Altere as medidas reais para produção. O orçamento comercial permanecerá intacto.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              <div className="font-semibold text-sm border-b pb-1">Lado A (Principal)</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Largura A (mm)</Label>
                  <Input 
                    id="width" 
                    type="number" 
                    defaultValue={selectedItem?.largura_producao} 
                    onChange={(e) => selectedItem && (selectedItem.largura_producao = Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Altura A (mm)</Label>
                  <Input 
                    id="height" 
                    type="number" 
                    defaultValue={selectedItem?.altura_producao}
                    onChange={(e) => selectedItem && (selectedItem.altura_producao = Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Lado B Fields (if multi-side) */}
            {(selectedItem?.largura_venda_b || selectedItem?.largura_producao_b) && (
              <div className="space-y-4 pt-2">
                <div className="font-semibold text-sm border-b pb-1">Lado B</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width_b">Largura B (mm)</Label>
                    <Input 
                      id="width_b" 
                      type="number" 
                      defaultValue={selectedItem?.largura_producao_b || 0} 
                      onChange={(e) => selectedItem && (selectedItem.largura_producao_b = Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height_b">Altura B (mm)</Label>
                    <Input 
                      id="height_b" 
                      type="number" 
                      defaultValue={selectedItem?.altura_producao_b || 0}
                      onChange={(e) => selectedItem && (selectedItem.altura_producao_b = Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Lado C Fields (if multi-side) */}
            {(selectedItem?.largura_venda_c || selectedItem?.largura_producao_c) && (
              <div className="space-y-4 pt-2">
                <div className="font-semibold text-sm border-b pb-1">Lado C</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width_c">Largura C (mm)</Label>
                    <Input 
                      id="width_c" 
                      type="number" 
                      defaultValue={selectedItem?.largura_producao_c || 0} 
                      onChange={(e) => selectedItem && (selectedItem.largura_producao_c = Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height_c">Altura C (mm)</Label>
                    <Input 
                      id="height_c" 
                      type="number" 
                      defaultValue={selectedItem?.altura_producao_c || 0}
                      onChange={(e) => selectedItem && (selectedItem.altura_producao_c = Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Label htmlFor="notes">Observações Técnicas</Label>
              <Textarea 
                id="notes" 
                placeholder="Ex: Ajuste por conta do prumo da parede"
                defaultValue={selectedItem?.technical_notes || ''}
                onChange={(e) => selectedItem && (selectedItem.technical_notes = e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjusting(false)}>Cancelar</Button>
            <Button 
              onClick={() => adjustMutation.mutate({
                largura: selectedItem!.largura_producao,
                altura: selectedItem!.altura_producao,
                largura_producao_b: selectedItem!.largura_producao_b,
                altura_producao_b: selectedItem!.altura_producao_b,
                largura_producao_c: selectedItem!.largura_producao_c,
                altura_producao_c: selectedItem!.altura_producao_c,
                notes: selectedItem!.technical_notes || ''
              })}
              disabled={adjustMutation.isPending}
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Ajustes - {selectedItem?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
            {!history?.length ? (
              <p className="text-center text-muted-foreground py-8">Nenhum histórico registrado.</p>
            ) : (
              history.map(log => (
                <div key={log.id} className="border-l-2 border-primary pl-4 py-1 space-y-1">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{log.profiles?.full_name || 'Usuário'}</span>
                    <span>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <p className="text-sm font-medium">
                    {log.field === 'largura_producao' ? 'Largura' : 'Altura'} alterada: 
                    <span className="text-muted-foreground line-through ml-2">{log.previous_value}mm</span>
                    <span className="text-primary font-bold ml-2">→ {log.new_value}mm</span>
                  </p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHistoryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
