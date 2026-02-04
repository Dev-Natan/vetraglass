import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Package, Search, FolderOpen, ChevronRight, Check, Layers } from 'lucide-react';
import { useItemTypeLabels } from '@/hooks/useItemTypes';
import { cn } from '@/lib/utils';

interface StockItem {
  id: string;
  item_template_id: string;
  quantity: number;
  item_template?: {
    id: string;
    name: string;
    unit?: string;
    image_url?: string;
    type?: string;
    linha?: string;
  };
}

interface RegistrarMovimentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: 'entrada' | 'saida';
  stockItems: StockItem[];
}

const motivosEntrada = [
  { value: 'compra', label: 'Compra de fornecedor' },
  { value: 'devolucao_cliente', label: 'Devolução de cliente' },
  { value: 'ajuste_inventario', label: 'Ajuste de inventário' },
  { value: 'transferencia', label: 'Transferência entre lojas' },
  { value: 'outro', label: 'Outro' },
];

const motivosSaida = [
  { value: 'venda', label: 'Venda' },
  { value: 'uso_interno', label: 'Uso interno / Produção' },
  { value: 'perda', label: 'Perda / Quebra' },
  { value: 'devolucao_fornecedor', label: 'Devolução a fornecedor' },
  { value: 'ajuste_inventario', label: 'Ajuste de inventário' },
  { value: 'outro', label: 'Outro' },
];

export function RegistrarMovimentoDialog({
  open,
  onOpenChange,
  tipo,
  stockItems,
}: RegistrarMovimentoDialogProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const itemTypeLabels = useItemTypeLabels();
  
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');

  const isEntrada = tipo === 'entrada';
  const motivos = isEntrada ? motivosEntrada : motivosSaida;

  const selectedStockItem = stockItems.find(item => item.id === selectedItem);

  // Filtrar itens por busca
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      if (!item.item_template) return false;
      const matchesSearch = !searchTerm || 
        item.item_template.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLinha = !selectedLinha || item.item_template.linha === selectedLinha;
      const matchesCategoria = !selectedCategoria || item.item_template.type === selectedCategoria;
      return matchesSearch && matchesLinha && matchesCategoria;
    });
  }, [stockItems, searchTerm, selectedLinha, selectedCategoria]);

  // Extrair linhas únicas
  const availableLinhas = useMemo(() => {
    const linhas = new Set<string>();
    stockItems.forEach(item => {
      if (item.item_template?.linha) {
        linhas.add(item.item_template.linha);
      }
    });
    return Array.from(linhas).sort();
  }, [stockItems]);

  // Extrair categorias únicas baseadas na linha selecionada
  const availableCategorias = useMemo(() => {
    const categorias = new Set<string>();
    stockItems
      .filter(item => !selectedLinha || item.item_template?.linha === selectedLinha)
      .forEach(item => {
        if (item.item_template?.type) {
          categorias.add(item.item_template.type);
        }
      });
    return Array.from(categorias).sort();
  }, [stockItems, selectedLinha]);

  // Agrupar itens filtrados por Linha → Categoria
  const itemsByLinhaAndType = useMemo(() => {
    const grouped: Record<string, Record<string, StockItem[]>> = {};
    
    filteredItems.forEach(item => {
      const linhaKey = item.item_template?.linha || 'Sem Linha';
      const typeKey = item.item_template?.type || 'other';
      
      if (!grouped[linhaKey]) grouped[linhaKey] = {};
      if (!grouped[linhaKey][typeKey]) grouped[linhaKey][typeKey] = [];
      
      grouped[linhaKey][typeKey].push(item);
    });
    
    return grouped;
  }, [filteredItems]);

  const movimentoMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !selectedItem || !quantidade || !motivo) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      const qtd = parseFloat(quantidade);
      if (isNaN(qtd) || qtd <= 0) {
        throw new Error('Quantidade inválida');
      }

      const stockItem = stockItems.find(item => item.id === selectedItem);
      if (!stockItem) throw new Error('Item não encontrado');

      // Verificar se há estoque suficiente para saída
      if (!isEntrada && qtd > stockItem.quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${stockItem.quantity}`);
      }

      const newQuantity = isEntrada 
        ? stockItem.quantity + qtd 
        : stockItem.quantity - qtd;

      const { error: movimentoError } = await supabase
        .from('stock_movements')
        .insert({
          company_id: currentCompany.id,
          item_template_id: stockItem.item_template_id,
          type: isEntrada ? 'entrada' : 'saida',
          category: motivo,
          quantity: qtd,
          description: observacao || null,
          created_by: user?.id,
        });

      if (movimentoError) throw movimentoError;

      const { error: stockError } = await supabase
        .from('company_stock')
        .update({ quantity: newQuantity })
        .eq('id', selectedItem);

      if (stockError) throw stockError;

      return { newQuantity };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success(
        isEntrada 
          ? `Entrada registrada. Novo saldo: ${data.newQuantity}` 
          : `Saída registrada. Novo saldo: ${data.newQuantity}`
      );
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao registrar movimento');
    },
  });

  const handleClose = () => {
    setSelectedItem('');
    setQuantidade('');
    setMotivo('');
    setObservacao('');
    setSearchTerm('');
    setSelectedLinha('');
    setSelectedCategoria('');
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    movimentoMutation.mutate();
  };

  const handleLinhaSelect = (linha: string) => {
    setSelectedLinha(linha === selectedLinha ? '' : linha);
    setSelectedCategoria('');
  };

  const handleCategoriaSelect = (categoria: string) => {
    setSelectedCategoria(categoria === selectedCategoria ? '' : categoria);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isEntrada ? (
              <>
                <TrendingUp className="h-5 w-5 text-green-600" />
                Registrar Entrada
              </>
            ) : (
              <>
                <TrendingDown className="h-5 w-5 text-red-600" />
                Registrar Saída
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEntrada 
              ? 'Adicione itens ao estoque registrando a entrada.'
              : 'Registre a saída de itens do estoque.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-4 overflow-hidden">
          {/* Seção de Seleção de Item */}
          <div className="flex flex-col gap-3 flex-1 min-h-0 border rounded-lg p-3 bg-muted/30">
            {/* Busca */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Seletores de Linha e Categoria */}
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  Linha
                </Label>
                <Select value={selectedLinha} onValueChange={(value) => {
                  setSelectedLinha(value === 'all' ? '' : value);
                  setSelectedCategoria('');
                }}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Todas as linhas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as linhas</SelectItem>
                    {availableLinhas.map((linha) => (
                      <SelectItem key={linha} value={linha}>
                        {linha}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Categoria
                </Label>
                <Select value={selectedCategoria} onValueChange={(value) => setSelectedCategoria(value === 'all' ? '' : value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {availableCategorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {itemTypeLabels[cat] || cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grid de Itens */}
            <div className="flex-1 min-h-0">
              <Label className="text-xs font-medium mb-2 block text-muted-foreground">
                Selecione o Item * ({filteredItems.length} itens)
              </Label>
              <ScrollArea className="h-[200px] rounded-md border bg-background p-2">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Package className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum item encontrado</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item.id)}
                        className={cn(
                          "relative flex flex-col items-center p-2 rounded-lg border cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/50",
                          selectedItem === item.id 
                            ? "border-primary bg-primary/5 ring-2 ring-primary shadow-sm" 
                            : "border-border bg-card"
                        )}
                      >
                        {selectedItem === item.id && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        
                        {/* Imagem */}
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center mb-1 overflow-hidden">
                          {item.item_template?.image_url ? (
                            <img 
                              src={item.item_template.image_url} 
                              alt={item.item_template.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground/50" />
                          )}
                        </div>
                        
                        {/* Nome */}
                        <span className="text-[10px] font-medium text-center line-clamp-2 leading-tight">
                          {item.item_template?.name}
                        </span>
                        
                        {/* Estoque */}
                        <span className={cn(
                          "text-[9px] mt-0.5 px-1.5 py-0.5 rounded-full",
                          item.quantity <= 0 
                            ? "bg-destructive/10 text-destructive" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {item.quantity} {item.item_template?.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Item selecionado */}
            {selectedStockItem && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20 flex-shrink-0">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedStockItem.item_template?.name}</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  Estoque: {selectedStockItem.quantity} {selectedStockItem.item_template?.unit}
                </Badge>
              </div>
            )}
          </div>

          {/* Campos de Quantidade, Motivo e Observação */}
          <div className="grid grid-cols-2 gap-4 flex-shrink-0">
            <div className="space-y-2">
              <Label htmlFor="quantidade">
                Quantidade * 
                {selectedStockItem?.item_template?.unit && (
                  <span className="text-muted-foreground ml-1">
                    ({selectedStockItem.item_template.unit})
                  </span>
                )}
              </Label>
              <Input
                id="quantidade"
                type="number"
                step="0.01"
                min="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 10"
                required
              />
              {selectedStockItem && !isEntrada && (
                <p className="text-xs text-muted-foreground">
                  Disponível: {selectedStockItem.quantity} {selectedStockItem.item_template?.unit}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 flex-shrink-0">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes adicionais sobre esta movimentação..."
              rows={2}
            />
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!selectedItem || !quantidade || !motivo || movimentoMutation.isPending}
              className={isEntrada ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {movimentoMutation.isPending ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}