import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, DollarSign, CreditCard, Smartphone, ShoppingCart, 
  FileText, Package, Trash2, Plus, Minus
} from 'lucide-react';
import { VendaItem } from './VendaItemCard';

interface ItemTemplate {
  id: string;
  name: string;
  unit: string;
  type: string;
  price: number;
  linha?: string | null;
}

interface CompanyProduct {
  id: string;
  commercial_name: string;
  base_price: number | null;
  product_template_id: string;
  product_template?: {
    name: string;
    category: string;
    linha?: string | null;
  };
}

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  total_amount: number;
  final_amount: number;
  status: string;
  created_at: string;
  quote_items?: QuoteItem[];
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  width?: number | null;
  height?: number | null;
  company_product_id?: string | null;
}

type VendaMode = 'orcamento' | 'avulsa';

interface NovaVendaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    items: VendaItem[];
    customerName: string;
    paymentMethod: 'dinheiro' | 'cartao' | 'pix';
    discountPercent: number;
    discountAmount: number;
    subtotal: number;
    total: number;
    quoteId?: string;
  }) => Promise<unknown>;
  availableItems: ItemTemplate[];
  availableProducts?: CompanyProduct[];
  approvedQuotes?: Quote[];
  isLoading?: boolean;
}

// Get unique linhas from items
function getLinhas(items: ItemTemplate[]): string[] {
  const linhas = new Set<string>();
  items.forEach(item => {
    if (item.linha) linhas.add(item.linha);
  });
  return Array.from(linhas).sort();
}

export function NovaVendaSheet({
  open,
  onOpenChange,
  onConfirm,
  availableItems,
  availableProducts = [],
  approvedQuotes = [],
  isLoading = false,
}: NovaVendaSheetProps) {
  const [mode, setMode] = useState<VendaMode>('avulsa');
  const [items, setItems] = useState<VendaItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [discountPercent, setDiscountPercent] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // Avulsa mode navigation
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  
  const linhas = useMemo(() => getLinhas(availableItems), [availableItems]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const discountValue = useMemo(() => {
    const percent = parseFloat(discountPercent.replace(',', '.')) || 0;
    return (subtotal * percent) / 100;
  }, [subtotal, discountPercent]);

  const total = subtotal - discountValue;

  // Add material item (avulsa mode)
  const addItem = (template: ItemTemplate) => {
    const existingIndex = items.findIndex((i) => i.itemTemplateId === template.id && !i.isProduct);
    
    if (existingIndex >= 0) {
      setItems(prev => {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].totalPrice = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
        return updated;
      });
    } else {
      const newItem: VendaItem = {
        id: crypto.randomUUID(),
        itemTemplateId: template.id,
        name: template.name,
        unit: template.unit,
        quantity: 1,
        unitPrice: template.price,
        totalPrice: template.price,
        isProduct: false,
      };
      setItems(prev => [...prev, newItem]);
    }
  };

  // Select quote and load items (orcamento mode)
  const selectQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setCustomerName(quote.customer_name);
    
    // Convert quote items to venda items (read-only)
    const vendaItems: VendaItem[] = (quote.quote_items || []).map(qi => ({
      id: crypto.randomUUID(),
      companyProductId: qi.company_product_id || undefined,
      name: qi.description,
      unit: 'm²',
      quantity: qi.quantity,
      unitPrice: qi.unit_price,
      totalPrice: qi.total_price,
      width: qi.width || undefined,
      height: qi.height || undefined,
      isProduct: !!qi.company_product_id,
    }));
    
    setItems(vendaItems);
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty, totalPrice: newQty * item.unitPrice };
    }));
  };

  const handleRemove = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleConfirm = async () => {
    await onConfirm({
      items,
      customerName,
      paymentMethod,
      discountPercent: parseFloat(discountPercent.replace(',', '.')) || 0,
      discountAmount: discountValue,
      subtotal,
      total,
      quoteId: selectedQuote?.id,
    });
    resetForm();
  };

  const resetForm = () => {
    setItems([]);
    setCustomerName('');
    setPaymentMethod('dinheiro');
    setDiscountPercent('');
    setSelectedQuote(null);
    setSelectedLinha(null);
    setMode('avulsa');
  };

  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      onOpenChange(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Get items filtered by linha
  const filteredItems = useMemo(() => {
    if (!selectedLinha) return [];
    return availableItems.filter(item => item.linha === selectedLinha);
  }, [availableItems, selectedLinha]);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nova Venda
          </SheetTitle>
          <SheetDescription>
            Escolha o tipo de venda
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6">
          {/* Mode Tabs */}
          <Tabs value={mode} onValueChange={(v) => {
            setMode(v as VendaMode);
            setItems([]);
            setSelectedQuote(null);
            setSelectedLinha(null);
          }} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="orcamento" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Via Orçamento
              </TabsTrigger>
              <TabsTrigger value="avulsa" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Venda Avulsa
              </TabsTrigger>
            </TabsList>

            {/* MODO ORÇAMENTO */}
            <TabsContent value="orcamento" className="flex-1 overflow-hidden flex flex-col m-0">
              {!selectedQuote ? (
                <div className="flex-1 overflow-hidden">
                  <Label className="mb-2 block">Selecione um Orçamento Aprovado</Label>
                  {approvedQuotes.length === 0 ? (
                    <div className="h-32 flex items-center justify-center border border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Nenhum orçamento aprovado disponível
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-64">
                      <div className="space-y-2 pr-4">
                        {approvedQuotes.map((quote) => (
                          <Card 
                            key={quote.id} 
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => selectQuote(quote)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    Orçamento #{String(quote.quote_number).padStart(4, '0')}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {quote.customer_name}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-primary">
                                    {formatCurrency(quote.final_amount)}
                                  </p>
                                  <Badge variant="secondary">{quote.quote_items?.length || 0} itens</Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium">
                        Orçamento #{String(selectedQuote.quote_number).padStart(4, '0')}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedQuote.customer_name}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedQuote(null);
                      setItems([]);
                    }}>
                      Trocar
                    </Button>
                  </div>
                  
                  <Label className="mb-2 block">Itens do Orçamento (somente leitura)</Label>
                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-4">
                      {items.map((item) => (
                        <Card key={item.id} className="bg-muted/50">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{item.name}</p>
                                {item.width && item.height && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.width}mm × {item.height}mm
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm">Qtd: {item.quantity}</p>
                                <p className="font-semibold text-sm">{formatCurrency(item.totalPrice)}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            {/* MODO AVULSA */}
            <TabsContent value="avulsa" className="flex-1 overflow-hidden flex flex-col m-0">
              {/* Step 1: Select Linha */}
              {!selectedLinha && (
                <div className="flex-1 overflow-hidden">
                  <Label className="mb-2 block">Selecione a Linha</Label>
                  <ScrollArea className="h-48">
                    <div className="grid grid-cols-2 gap-2 pr-4">
                      {linhas.map((linha) => (
                        <Card 
                          key={linha}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => setSelectedLinha(linha)}
                        >
                          <CardContent className="p-4 text-center">
                            <p className="font-medium">{linha}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Step 2: Select Items from Linha */}
              {selectedLinha && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Linha: {selectedLinha}</Label>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLinha(null)}>
                      Trocar Linha
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-40 mb-4">
                    <div className="grid grid-cols-2 gap-2 pr-4">
                      {filteredItems.map((item) => (
                        <Card 
                          key={item.id}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => addItem(item)}
                        >
                          <CardContent className="p-3">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(item.price)} / {item.unit}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Items added */}
                  {items.length > 0 && (
                    <>
                      <Label className="mb-2 block">Itens Adicionados ({items.length})</Label>
                      <ScrollArea className="flex-1">
                        <div className="space-y-2 pr-4">
                          {items.map((item) => (
                            <Card key={item.id}>
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatCurrency(item.unitPrice)} × {item.quantity} = {formatCurrency(item.totalPrice)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleQuantityChange(item.id, -1)}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleQuantityChange(item.id, 1)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => handleRemove(item.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Payment Section - Show when items exist */}
          {items.length > 0 && (
            <div className="space-y-4 border-t pt-4 mt-4">
              {mode === 'avulsa' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Cliente (opcional)</Label>
                    <Input
                      id="customer-name"
                      placeholder="Nome do cliente"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount">Desconto (%)</Label>
                    <Input
                      id="discount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as 'dinheiro' | 'cartao' | 'pix')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dinheiro" id="dinheiro" />
                    <Label htmlFor="dinheiro" className="flex items-center gap-1 cursor-pointer">
                      <DollarSign className="h-4 w-4" /> Dinheiro
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cartao" id="cartao" />
                    <Label htmlFor="cartao" className="flex items-center gap-1 cursor-pointer">
                      <CreditCard className="h-4 w-4" /> Cartão
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix" className="flex items-center gap-1 cursor-pointer">
                      <Smartphone className="h-4 w-4" /> PIX
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Totais */}
              <div className="border-t pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto ({discountPercent}%):</span>
                    <span>-{formatCurrency(discountValue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t p-6">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || items.length === 0}
            className="flex-1 sm:flex-initial"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              `Faturar Venda ${formatCurrency(total)}`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
