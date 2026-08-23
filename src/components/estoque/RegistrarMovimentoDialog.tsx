import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { TrendingUp, TrendingDown, Package, Search, FolderOpen, Check, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { useItemTypeLabels } from '@/hooks/useItemTypes';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { cn } from '@/lib/utils';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StockItem {
  id: string;
  item_template_id: string;
  company_item_id?: string | null;
  quantity: number;
  company_item?: { id: string } | null;
  item_template?: {
    id: string;
    name: string;
    unit?: string;
    image_url?: string;
    type?: string;
    linha?: string;
    bar_length_mm?: number | null;
    default_sheet_width_mm?: number | null;
    default_sheet_height_mm?: number | null;
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

const ALL_VALUE = '__all__';

export function RegistrarMovimentoDialog({
  open,
  onOpenChange,
  tipo,
  stockItems,
}: RegistrarMovimentoDialogProps) {
  const { currentCompany } = useAuth();
  const invalidateStock = useInvalidateStock();
  const { labels: itemTypeLabels } = useItemTypeLabels();
  const { data: productLinhas } = useCompanyLinhas();
  
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLinha, setSelectedLinha] = useState<string>(ALL_VALUE);
  const [selectedCategoria, setSelectedCategoria] = useState<string>(ALL_VALUE);
  const [expandedLinhas, setExpandedLinhas] = useState<Set<string>>(new Set());

  // Modo de entrada específico por tipo
  const [inputMode, setInputMode] = useState<'unit' | 'sheet' | 'piece' | 'bar' | 'linear'>('unit');
  const [sheetWidth, setSheetWidth] = useState<string>('');
  const [sheetHeight, setSheetHeight] = useState<string>('');
  const [pieceWidth, setPieceWidth] = useState<string>('');
  const [pieceHeight, setPieceHeight] = useState<string>('');
  const [pieceQty, setPieceQty] = useState<string>('1');
  const [linearMeters, setLinearMeters] = useState<string>('');

  const isEntrada = tipo === 'entrada';
  const motivos = isEntrada ? motivosEntrada : motivosSaida;

  const selectedStockItem = stockItems.find(item => item.id === selectedItem);

  // Classificação da unidade
  const itemType = (selectedStockItem?.item_template?.type || '').toLowerCase();
  const rawUnit = (selectedStockItem?.item_template?.unit || '').toLowerCase().trim();
  const barLengthMm = selectedStockItem?.item_template?.bar_length_mm || 0;
  const barLengthM = barLengthMm > 0 ? barLengthMm / 1000 : 0;

  const isGlass = itemType === 'glass' || itemType === 'vidro' || rawUnit === 'm2' || rawUnit === 'metro quadrado';
  const isProfile = itemType === 'profile' || itemType === 'perfil' || rawUnit === 'barra' || rawUnit === 'barras' || (barLengthMm > 0);

  // Ao trocar de item, definir modo padrão
  const handleSelectItem = (id: string) => {
    setSelectedItem(id);
    const it = stockItems.find(x => x.id === id);
    const t = (it?.item_template?.type || '').toLowerCase();
    const u = (it?.item_template?.unit || '').toLowerCase();
    const bl = it?.item_template?.bar_length_mm || 0;
    if (t === 'glass' || t === 'vidro' || u === 'm2') {
      setInputMode('piece');
    } else if (t === 'profile' || t === 'perfil' || bl > 0) {
      setInputMode('bar');
    } else {
      setInputMode('unit');
    }
    // Reset campos auxiliares
    setSheetWidth(String(it?.item_template?.default_sheet_width_mm || ''));
    setSheetHeight(String(it?.item_template?.default_sheet_height_mm || ''));
    setPieceWidth('');
    setPieceHeight('');
    setPieceQty('1');
    setLinearMeters('');
    setQuantidade('');
  };

  // Calcula a quantidade final (na unidade de estoque) e um resumo textual
  const computed = useMemo(() => {
    if (!selectedStockItem) return { quantity: 0, storageUnit: '', summary: '', autoNote: '' };
    const storageUnit = rawUnit || 'un';

    if (isGlass) {
      if (inputMode === 'piece') {
        const w = parseFloat(pieceWidth) || 0;
        const h = parseFloat(pieceHeight) || 0;
        const q = parseFloat(pieceQty) || 0;
        const areaM2 = (w / 1000) * (h / 1000) * q;
        return {
          quantity: Number(areaM2.toFixed(4)),
          storageUnit: 'm²',
          summary: w && h && q ? `${q}× peça(s) de ${w} × ${h} mm = ${areaM2.toFixed(3)} m²` : '',
          autoNote: w && h && q ? `Peça cortada: ${q}× ${w}×${h} mm` : '',
        };
      }
      if (inputMode === 'sheet') {
        const sw = parseFloat(sheetWidth) || 0;
        const sh = parseFloat(sheetHeight) || 0;
        const sq = parseFloat(quantidade) || 0;
        const areaPer = (sw / 1000) * (sh / 1000);
        const total = areaPer * sq;
        return {
          quantity: Number(total.toFixed(4)),
          storageUnit: 'm²',
          summary: sw && sh && sq ? `${sq}× chapa(s) de ${sw} × ${sh} mm = ${total.toFixed(3)} m²` : '',
          autoNote: sw && sh && sq ? `Chapa inteira: ${sq}× ${sw}×${sh} mm` : '',
        };
      }
    }

    if (isProfile) {
      if (inputMode === 'bar') {
        const q = parseFloat(quantidade) || 0;
        // Armazenamento em barras
        const totalM = barLengthM > 0 ? q * barLengthM : 0;
        return {
          quantity: q,
          storageUnit: 'barra(s)',
          summary: q ? (barLengthM > 0 ? `${q} barra(s) de ${barLengthM} m = ${totalM.toFixed(2)} m` : `${q} barra(s)`) : '',
          autoNote: '',
        };
      }
      if (inputMode === 'linear') {
        const meters = parseFloat(linearMeters) || 0;
        if (barLengthM <= 0) {
          return { quantity: meters, storageUnit: 'm', summary: meters ? `${meters} m lineares` : '', autoNote: '' };
        }
        const bars = meters / barLengthM;
        const barrasInteiras = Math.floor(bars);
        const retalhoM = Number((meters - barrasInteiras * barLengthM).toFixed(3));
        const retalhoTxt = retalhoM > 0 ? ` + retalho de ${retalhoM.toFixed(2)} m` : '';
        return {
          quantity: Number(bars.toFixed(4)),
          storageUnit: 'barra(s) equivalentes',
          summary: meters ? `${meters} m lineares = ${bars.toFixed(3)} barras (${barrasInteiras} inteira(s)${retalhoTxt})` : '',
          autoNote: meters ? `Metro linear: ${meters} m${retalhoM > 0 ? ` (retalho ${retalhoM.toFixed(2)} m)` : ''}` : '',
        };
      }
    }

    // Padrão: unidade simples
    const q = parseFloat(quantidade) || 0;
    return { quantity: q, storageUnit, summary: q ? `${q} ${storageUnit}` : '', autoNote: '' };
  }, [selectedStockItem, isGlass, isProfile, inputMode, pieceWidth, pieceHeight, pieceQty, sheetWidth, sheetHeight, quantidade, linearMeters, barLengthM, rawUnit]);


  // Filtrar itens por busca
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      if (!item.item_template) return false;
      const matchesSearch = !searchTerm || 
        item.item_template.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLinha = selectedLinha === ALL_VALUE || item.item_template.linha === selectedLinha;
      const matchesCategoria = selectedCategoria === ALL_VALUE || item.item_template.type === selectedCategoria;
      return matchesSearch && matchesLinha && matchesCategoria;
    });
  }, [stockItems, searchTerm, selectedLinha, selectedCategoria]);

  // Buscar linhas oficiais da tabela + linhas existentes nos itens (compatibilidade)
  const availableLinhas = useMemo(() => {
    // Linhas oficiais da tabela product_linhas
    const oficialLinhas = productLinhas?.map(l => l.name) || [];
    
    // Também incluir linhas existentes nos itens (para compatibilidade com dados legados)
    const linhasFromItems = new Set<string>();
    stockItems.forEach(item => {
      if (item.item_template?.linha) {
        linhasFromItems.add(item.item_template.linha);
      }
    });
    
    // Merge: oficiais + legados (sem duplicatas)
    const allLinhas = new Set([...oficialLinhas, ...linhasFromItems]);
    return Array.from(allLinhas).sort();
  }, [productLinhas, stockItems]);

  // Extrair categorias únicas baseadas na linha selecionada
  const availableCategorias = useMemo(() => {
    const categorias = new Set<string>();
    stockItems
      .filter(item => selectedLinha === ALL_VALUE || item.item_template?.linha === selectedLinha)
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

  // Auto-expand all linhas when component mounts or items change
  useMemo(() => {
    const allLinhas = Object.keys(itemsByLinhaAndType);
    if (allLinhas.length <= 3) {
      setExpandedLinhas(new Set(allLinhas));
    }
  }, [itemsByLinhaAndType]);

  const toggleLinha = (linha: string) => {
    setExpandedLinhas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linha)) {
        newSet.delete(linha);
      } else {
        newSet.add(linha);
      }
      return newSet;
    });
  };

  const movimentoMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !selectedItem || !motivo) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      const qtd = computed.quantity;
      if (isNaN(qtd) || qtd <= 0) {
        throw new Error('Quantidade calculada inválida — verifique os campos.');
      }

      const stockItem = stockItems.find(item => item.id === selectedItem);
      if (!stockItem) throw new Error('Item não encontrado');

      if (!isEntrada && qtd > stockItem.quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${stockItem.quantity} — tentando ${qtd.toFixed(3)}`);
      }

      const companyItemId = stockItem.company_item_id ?? stockItem.company_item?.id;
      if (!companyItemId) throw new Error('MISSING_COMPANY_ITEM');
      const reasonLabel = motivos.find(entry => entry.value === motivo)?.label ?? motivo;
      const finalDescription = [reasonLabel, computed.autoNote, observacao].filter(Boolean).join(' — ');
      const { data, error } = await supabase.rpc('adjust_company_stock', {
        _company_id: currentCompany.id,
        _company_item_id: companyItemId,
        _delta: isEntrada ? qtd : -qtd,
        _reason: finalDescription,
      });
      if (error) throw error;
      const result = data as { new_quantity?: number };
      return { newQuantity: result.new_quantity ?? stockItem.quantity };
    },
    onSuccess: (data) => {
      invalidateStock();
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
    setSelectedLinha(ALL_VALUE);
    setSelectedCategoria(ALL_VALUE);
    setExpandedLinhas(new Set());
    setInputMode('unit');
    setSheetWidth('');
    setSheetHeight('');
    setPieceWidth('');
    setPieceHeight('');
    setPieceQty('1');
    setLinearMeters('');
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    movimentoMutation.mutate();
  };

  const handleLinhaChange = (value: string) => {
    setSelectedLinha(value);
    setSelectedCategoria(ALL_VALUE);
  };

  const linhasSorted = Object.keys(itemsByLinhaAndType).sort();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] p-0 gap-0 flex flex-col max-h-[90vh]">
        {/* Header fixo */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
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

        {/* Corpo rolável */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Seção de Seleção de Item */}
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              {/* Busca e Filtros */}
              <div className="space-y-3">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar item pelo nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>

                {/* Seletores de Linha e Categoria */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      Linha
                    </Label>
                    <Select value={selectedLinha} onValueChange={handleLinhaChange}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Todas as linhas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VALUE}>Todas as linhas</SelectItem>
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
                    <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VALUE}>Todas as categorias</SelectItem>
                        {availableCategorias.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {itemTypeLabels?.[cat] || cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Item selecionado - mostrar no topo quando houver */}
              {selectedStockItem && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="w-10 h-10 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedStockItem.item_template?.image_url ? (
                      <img 
                        src={selectedStockItem.item_template.image_url} 
                        alt={selectedStockItem.item_template.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium truncate">{selectedStockItem.item_template?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedStockItem.item_template?.linha && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          {selectedStockItem.item_template.linha}
                        </Badge>
                      )}
                      {selectedStockItem.item_template?.type && (
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {itemTypeLabels?.[selectedStockItem.item_template.type] || selectedStockItem.item_template.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge className="flex-shrink-0 text-xs">
                    Estoque: {selectedStockItem.quantity} {selectedStockItem.item_template?.unit}
                  </Badge>
                </div>
              )}

              {/* Grid de Itens Organizado por Linha → Categoria */}
              <div>
                <Label className="text-xs font-medium mb-2 block text-muted-foreground">
                  Selecione o Item * ({filteredItems.length} itens)
                </Label>
                <ScrollArea className="h-[280px] rounded-md border bg-background">
                  {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                      <Package className="h-12 w-12 mb-3 opacity-30" />
                      <p className="text-sm font-medium">Nenhum item encontrado</p>
                      <p className="text-xs mt-1">Tente ajustar os filtros ou busca</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {linhasSorted.map((linhaKey) => {
                        const categorias = itemsByLinhaAndType[linhaKey];
                        const categoriasKeys = Object.keys(categorias).sort();
                        const totalItemsInLinha = categoriasKeys.reduce(
                          (acc, cat) => acc + categorias[cat].length, 0
                        );
                        const isExpanded = expandedLinhas.has(linhaKey);

                        return (
                          <Collapsible
                            key={linhaKey}
                            open={isExpanded}
                            onOpenChange={() => toggleLinha(linhaKey)}
                          >
                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded-md transition-colors">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <FolderOpen className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{linhaKey}</span>
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {totalItemsInLinha} {totalItemsInLinha === 1 ? 'item' : 'itens'}
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-6 pt-2 space-y-3">
                              {categoriasKeys.map((catKey) => {
                                const items = categorias[catKey];
                                const catLabel = itemTypeLabels?.[catKey] || catKey;

                                return (
                                  <div key={catKey} className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Layers className="h-3 w-3" />
                                      <span className="font-medium">{catLabel}</span>
                                      <span>({items.length})</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                      {items.map((item) => (
                                        <div
                                          key={item.id}
                                          onClick={() => handleSelectItem(item.id)}
                                          className={cn(
                                            "relative flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/50",
                                            selectedItem === item.id 
                                              ? "border-primary bg-primary/5 ring-2 ring-primary shadow-sm" 
                                              : "border-border bg-card"
                                          )}
                                        >
                                          {selectedItem === item.id && (
                                            <div className="absolute top-1.5 right-1.5 bg-primary rounded-full p-0.5">
                                              <Check className="h-3 w-3 text-primary-foreground" />
                                            </div>
                                          )}
                                          
                                          {/* Imagem */}
                                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mb-2 overflow-hidden">
                                            {item.item_template?.image_url ? (
                                              <img 
                                                src={item.item_template.image_url} 
                                                alt={item.item_template.name}
                                                className="w-full h-full object-contain"
                                              />
                                            ) : (
                                              <Package className="h-6 w-6 text-muted-foreground/40" />
                                            )}
                                          </div>
                                          
                                          {/* Nome */}
                                          <span className="text-xs font-medium text-center line-clamp-2 leading-tight w-full">
                                            {item.item_template?.name}
                                          </span>
                                          
                                          {/* Estoque */}
                                          <span className={cn(
                                            "text-[10px] mt-1.5 px-2 py-0.5 rounded-full font-medium",
                                            item.quantity <= 0 
                                              ? "bg-destructive/10 text-destructive" 
                                              : item.quantity <= 5
                                              ? "bg-amber-100 text-amber-700"
                                              : "bg-muted text-muted-foreground"
                                          )}>
                                            {item.quantity} {item.item_template?.unit}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* Modo de entrada específico (Vidro / Perfil) */}
            {selectedStockItem && (isGlass || isProfile) && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Modo de {isEntrada ? 'entrada' : 'saída'}:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {isGlass && (
                      <>
                        <Button type="button" size="sm" variant={inputMode === 'piece' ? 'default' : 'outline'} onClick={() => setInputMode('piece')}>
                          Peça cortada (L × A)
                        </Button>
                        <Button type="button" size="sm" variant={inputMode === 'sheet' ? 'default' : 'outline'} onClick={() => setInputMode('sheet')}>
                          Chapa inteira
                        </Button>
                      </>
                    )}
                    {isProfile && (
                      <>
                        <Button type="button" size="sm" variant={inputMode === 'bar' ? 'default' : 'outline'} onClick={() => setInputMode('bar')}>
                          Por barra{barLengthM > 0 ? ` (${barLengthM} m)` : ''}
                        </Button>
                        <Button type="button" size="sm" variant={inputMode === 'linear' ? 'default' : 'outline'} onClick={() => setInputMode('linear')}>
                          Metro linear (com retalho)
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Peça cortada (vidro) */}
                {isGlass && inputMode === 'piece' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Largura (mm)</Label>
                      <Input type="number" min="1" value={pieceWidth} onChange={(e) => setPieceWidth(e.target.value)} placeholder="Ex: 800" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Altura (mm)</Label>
                      <Input type="number" min="1" value={pieceHeight} onChange={(e) => setPieceHeight(e.target.value)} placeholder="Ex: 1200" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input type="number" min="1" step="1" value={pieceQty} onChange={(e) => setPieceQty(e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Chapa inteira (vidro) */}
                {isGlass && inputMode === 'sheet' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Largura chapa (mm)</Label>
                      <Input type="number" min="1" value={sheetWidth} onChange={(e) => setSheetWidth(e.target.value)} placeholder="Ex: 2200" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Altura chapa (mm)</Label>
                      <Input type="number" min="1" value={sheetHeight} onChange={(e) => setSheetHeight(e.target.value)} placeholder="Ex: 3200" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nº de chapas</Label>
                      <Input type="number" min="0.01" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="1" />
                    </div>
                  </div>
                )}

                {/* Barra (perfil) */}
                {isProfile && inputMode === 'bar' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade de barras</Label>
                    <Input type="number" min="0.01" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex: 5" />
                  </div>
                )}

                {/* Metro linear (perfil) */}
                {isProfile && inputMode === 'linear' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Total em metros lineares</Label>
                    <Input type="number" min="0.01" step="0.01" value={linearMeters} onChange={(e) => setLinearMeters(e.target.value)} placeholder="Ex: 12.50" />
                    {barLengthM > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Convertido para barras de {barLengthM} m — o resto é registrado como retalho na observação.
                      </p>
                    )}
                  </div>
                )}

                {/* Resumo do cálculo */}
                {computed.summary && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Será registrado: </span>
                    <span className="font-medium text-primary">{computed.summary}</span>
                  </div>
                )}
              </div>
            )}

            {/* Quantidade simples (padrão) + Motivo */}
            <div className="grid grid-cols-2 gap-4">
              {(!selectedStockItem || (!isGlass && !isProfile)) && (
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
              )}

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


            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Detalhes adicionais sobre esta movimentação..."
                rows={2}
              />
            </div>
          </div>

          {/* Footer fixo */}
          <DialogFooter className="px-6 py-4 border-t bg-background flex-shrink-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!selectedItem || !motivo || computed.quantity <= 0 || movimentoMutation.isPending}
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
