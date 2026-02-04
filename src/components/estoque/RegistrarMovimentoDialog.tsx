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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Package } from 'lucide-react';
import { useItemTypeLabels } from '@/hooks/useItemTypes';

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

  const isEntrada = tipo === 'entrada';
  const motivos = isEntrada ? motivosEntrada : motivosSaida;

  const selectedStockItem = stockItems.find(item => item.id === selectedItem);

  // Agrupar itens por Linha → Tipo (Categoria) → Item
  const itemsByLinhaAndType = useMemo(() => {
    const grouped: Record<string, Record<string, StockItem[]>> = {};
    
    stockItems
      .filter(item => item.item_template)
      .forEach(item => {
        const linhaKey = item.item_template?.linha || 'Sem Linha';
        const typeKey = item.item_template?.type || 'other';
        
        if (!grouped[linhaKey]) grouped[linhaKey] = {};
        if (!grouped[linhaKey][typeKey]) grouped[linhaKey][typeKey] = [];
        
        grouped[linhaKey][typeKey].push(item);
      });
    
    return grouped;
  }, [stockItems]);

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

      // Registrar movimento na tabela stock_movements
      // Usando campos existentes: type, category, description
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

      // Atualizar quantidade no estoque
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
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    movimentoMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção de Item com hierarquia Linha → Categoria → Item */}
          <div className="space-y-2">
            <Label htmlFor="item">Item *</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um item" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {Object.keys(itemsByLinhaAndType).sort().map((linhaKey) => (
                  <SelectGroup key={linhaKey}>
                    <SelectLabel className="font-bold text-primary bg-muted/50 py-2">
                      📁 {linhaKey}
                    </SelectLabel>
                    {Object.keys(itemsByLinhaAndType[linhaKey]).sort().map((typeKey) => (
                      <SelectGroup key={`${linhaKey}-${typeKey}`}>
                        <SelectLabel className="pl-4 text-xs text-muted-foreground font-medium">
                          {itemTypeLabels[typeKey] || typeKey}
                        </SelectLabel>
                        {itemsByLinhaAndType[linhaKey][typeKey].map((item) => (
                          <SelectItem key={item.id} value={item.id} className="pl-8">
                            <div className="flex items-center gap-2">
                              {item.item_template?.image_url ? (
                                <img 
                                  src={item.item_template.image_url} 
                                  alt="" 
                                  className="w-5 h-5 object-contain"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span>{item.item_template?.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({item.quantity} {item.item_template?.unit})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade */}
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

          {/* Motivo */}
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

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes adicionais sobre esta movimentação..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={movimentoMutation.isPending || !selectedItem || !quantidade || !motivo}
              className={isEntrada ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {movimentoMutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
