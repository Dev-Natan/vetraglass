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
    mutationFn: (data: { largura: number; altura: number; notes: string }) => 
      osService.updateProductionDimensions(selectedItem!.id, {
        largura_producao: data.largura,
        altura_producao: data.altura,
        technical_notes: data.notes
      }, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-items', ordemServicoId] });
      toast.success('Medidas de produção atualizadas! Recalcule o plano para aplicar as mudanças.');
      setIsAdjusting(false);
    },
    onError: (error: Error) => toast.error('Erro: ' + error.message)
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
          onClick={() => recalculateMutation.mutate()}
          disabled={recalculateMutation.isPending}
        >
          {recalculateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Recalcular Todos
        </Button>
      </div>

      <div className="grid gap-4">
        {items?.map(item => (
          <Card key={item.id} className={item.recalculation_required ? 'border-amber-500 bg-amber-50/10' : ''}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold">{item.product_name}</h4>
                    <Badge variant="secondary">{item.quantity}x</Badge>
                    {item.recalculation_required && (
                      <Badge variant="warning" className="bg-amber-500 text-white gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Recalcular
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
                      <Label className="text-muted-foreground text-xs uppercase">Medidas de Venda (Bloqueado)</Label>
                      <div className="flex items-center gap-2 font-mono text-lg opacity-60">
                        <Maximize2 className="w-4 h-4" />
                        {item.largura_venda} x {item.altura_venda} mm
                      </div>
                    </div>
                    <div className="space-y-1 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                      <Label className="text-primary/70 text-xs uppercase font-bold">Medidas de Produção</Label>
                      <div className="flex items-center gap-2 font-mono text-lg text-primary font-bold">
                        <Ruler className="w-4 h-4" />
                        {item.largura_producao} x {item.altura_producao} mm
                      </div>
                    </div>
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
        ))}
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
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">Largura de Produção (mm)</Label>
                <Input 
                  id="width" 
                  type="number" 
                  defaultValue={selectedItem?.largura_producao} 
                  onChange={(e) => selectedItem && (selectedItem.largura_producao = Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Altura de Produção (mm)</Label>
                <Input 
                  id="height" 
                  type="number" 
                  defaultValue={selectedItem?.altura_producao}
                  onChange={(e) => selectedItem && (selectedItem.altura_producao = Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
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
