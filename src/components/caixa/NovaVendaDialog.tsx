import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Package, ShoppingCart, FileText, Trash2, Minus,
  DollarSign, CreditCard, Smartphone, Loader2, ArrowLeft, Layers, Box, User
} from 'lucide-react';
import { AddProductPanel } from '@/components/orcamentos/AddProductPanel';

export interface VendaItem {
  id: string;
  itemTemplateId?: string;
  companyProductId?: string;
  productTemplateId?: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  width?: number;
  height?: number;
  isProduct?: boolean;
  isDefaultPrice?: boolean;
}

interface ItemTemplate {
  id: string;
  name: string;
  unit: string;
  type: string;
  price: number;
  linha?: string | null;
  isDefaultPrice?: boolean;
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
  product_template_id?: string | null;
}

type VendaMode = 'orcamento' | 'avulsa';
type ViewMode = 'main' | 'add-product' | 'add-material' | 'material-dimensions';

interface NovaVendaDialogProps {
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

export function NovaVendaDialog({
  open,
  onOpenChange,
  onConfirm,
  availableItems,
  approvedQuotes = [],
  isLoading = false,
}: NovaVendaDialogProps) {
  const { currentCompany } = useAuth();
  
  const [mode, setMode] = useState<VendaMode>('avulsa');
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [items, setItems] = useState<VendaItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [discountPercent, setDiscountPercent] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // Material mode navigation
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<ItemTemplate | null>(null);
  const [materialWidth, setMaterialWidth] = useState('');
  const [materialHeight, setMaterialHeight] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState('1');
  
  const linhas = useMemo(() => getLinhas(availableItems), [availableItems]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const discountValue = useMemo(() => {
    const percent = parseFloat(discountPercent.replace(',', '.')) || 0;
    return (subtotal * percent) / 100;
  }, [subtotal, discountPercent]);

  const total = subtotal - discountValue;

  // Select material for dimensions input
  const selectMaterialForDimensions = (template: ItemTemplate) => {
    setSelectedMaterial(template);
    setMaterialWidth('');
    setMaterialHeight('');
    setMaterialQuantity('1');
    setViewMode('material-dimensions');
  };

  // Add material item with dimensions
  const addMaterialWithDimensions = () => {
    if (!selectedMaterial) return;
    
    const width = parseFloat(materialWidth.replace(',', '.')) || 0;
    const height = parseFloat(materialHeight.replace(',', '.')) || 0;
    const quantity = parseInt(materialQuantity) || 1;
    
    // Calculate based on unit type
    let totalPrice = selectedMaterial.price * quantity;
    const hasDimensions = width > 0 || height > 0;
    
    // For m² or m (linear), calculate based on dimensions
    if (selectedMaterial.unit === 'm²' && width > 0 && height > 0) {
      const areaM2 = (width / 1000) * (height / 1000);
      totalPrice = areaM2 * selectedMaterial.price * quantity;
    } else if (selectedMaterial.unit === 'm' && (width > 0 || height > 0)) {
      const lengthM = Math.max(width, height) / 1000;
      totalPrice = lengthM * selectedMaterial.price * quantity;
    }
    
    const newItem: VendaItem = {
      id: crypto.randomUUID(),
      itemTemplateId: selectedMaterial.id,
      name: selectedMaterial.name,
      unit: selectedMaterial.unit,
      quantity,
      unitPrice: selectedMaterial.price,
      totalPrice,
      width: width > 0 ? width : undefined,
      height: height > 0 ? height : undefined,
      isProduct: false,
      isDefaultPrice: selectedMaterial.isDefaultPrice,
    };
    
    setItems(prev => [...prev, newItem]);
    setSelectedMaterial(null);
    setSelectedLinha(null);
    setViewMode('main');
  };

  // Add product with dimensions (from AddProductPanel)
  const handleAddProduct = (product: {
    product_template_id: string;
    company_product_id?: string;
    name: string;
    base_price: number;
    image_url?: string | null;
    linha?: string | null;
    category?: string;
    width: number;
    height: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    has_glass?: boolean;
    glass_color?: string;
    glass_thickness?: string;
  }) => {
    const newItem: VendaItem = {
      id: crypto.randomUUID(),
      companyProductId: product.company_product_id,
      productTemplateId: product.product_template_id,
      name: product.name,
      unit: 'm²',
      quantity: product.quantity,
      unitPrice: product.unit_price,
      totalPrice: product.total_price,
      width: product.width,
      height: product.height,
      isProduct: true,
    };
    setItems(prev => [...prev, newItem]);
    setViewMode('main');
  };

  // Select quote and load items (orcamento mode)
  const selectQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setCustomerName(quote.customer_name);
    
    const vendaItems: VendaItem[] = (quote.quote_items || []).map(qi => ({
      id: crypto.randomUUID(),
      companyProductId: qi.company_product_id || undefined,
      productTemplateId: qi.product_template_id || undefined,
      name: qi.description,
      unit: 'm²',
      quantity: qi.quantity,
      unitPrice: qi.unit_price,
      totalPrice: qi.total_price,
      width: qi.width || undefined,
      height: qi.height || undefined,
      isProduct: !!(qi.company_product_id || qi.product_template_id),
    }));
    
    setItems(vendaItems);
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      const newQty = Math.max(1, item.quantity + delta);
      
      if (item.isProduct && item.width && item.height) {
        const areaM2 = (item.width / 1000) * (item.height / 1000);
        return { ...item, quantity: newQty, totalPrice: areaM2 * newQty * item.unitPrice };
      }
      
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
    setSelectedMaterial(null);
    setMaterialWidth('');
    setMaterialHeight('');
    setMaterialQuantity('1');
    setViewMode('main');
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {viewMode === 'main' ? (
              <>
                <ShoppingCart className="w-5 h-5" />
                Nova Venda
              </>
            ) : viewMode === 'add-product' ? (
              <>
                <Package className="w-5 h-5" />
                Adicionar Produto
              </>
            ) : (
              <>
                <Layers className="w-5 h-5" />
                Adicionar Material
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {viewMode === 'main' ? (
            <div className="space-y-6 py-4">
              {/* Mode Tabs */}
              <Tabs value={mode} onValueChange={(v) => {
                setMode(v as VendaMode);
                setItems([]);
                setSelectedQuote(null);
                setSelectedLinha(null);
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="avulsa" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Venda Avulsa
                  </TabsTrigger>
                  <TabsTrigger value="orcamento" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Via Orçamento
                  </TabsTrigger>
                </TabsList>

                {/* MODO AVULSA */}
                <TabsContent value="avulsa" className="space-y-4 mt-4">
                  {/* Customer Info */}
                  <div className="rounded-xl border bg-card p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="w-4 h-4" />
                      Cliente (opcional)
                    </div>
                    <Input
                      placeholder="Nome do cliente"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  {/* Items Section */}
                  <div className="rounded-xl border bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Package className="w-4 h-4" />
                        Itens ({items.length})
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setViewMode('add-material')}
                          className="gap-2"
                        >
                          <Layers className="w-4 h-4" />
                          Material
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setViewMode('add-product')}
                          className="gap-2"
                        >
                          <Box className="w-4 h-4" />
                          Produto
                        </Button>
                      </div>
                    </div>

                    {items.length === 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setViewMode('add-material')}
                          className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="font-medium text-sm">Adicionar Material</p>
                          <p className="text-xs mt-1">Perfis, acessórios, vidros</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('add-product')}
                          className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          <Box className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="font-medium text-sm">Adicionar Produto</p>
                          <p className="text-xs mt-1">Janelas, portas, box</p>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div 
                            key={item.id} 
                            className={`p-3 rounded-lg border ${item.isProduct ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{item.name}</p>
                                  {item.isProduct && (
                                    <Badge variant="secondary" className="text-[10px] h-4">Produto</Badge>
                                  )}
                                  {item.isDefaultPrice && (
                                    <Badge variant="outline" className="text-[10px] h-4">Preço padrão</Badge>
                                  )}
                                </div>
                                {item.width || item.height ? (
                                  <p className="text-xs text-muted-foreground">
                                    {item.width}mm × {item.height}mm
                                    {item.unit === 'm²' && item.width && item.height && (
                                      <span> = {((item.width/1000)*(item.height/1000)).toFixed(2)} m²</span>
                                    )}
                                    {item.unit === 'm' && (
                                      <span> = {(Math.max(item.width || 0, item.height || 0)/1000).toFixed(2)} m</span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(item.unitPrice)} / {item.unit} × {item.quantity}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleQuantityChange(item.id, -1)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleQuantityChange(item.id, 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="font-semibold text-sm w-24 text-right">{formatCurrency(item.totalPrice)}</p>
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* MODO ORÇAMENTO */}
                <TabsContent value="orcamento" className="space-y-4 mt-4">
                  {!selectedQuote ? (
                    <div className="rounded-xl border bg-card p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        Selecione um Orçamento Aprovado
                      </div>
                      {approvedQuotes.length === 0 ? (
                        <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">Nenhum orçamento aprovado</p>
                          <p className="text-sm mt-1">Aprove um orçamento para faturá-lo aqui</p>
                        </div>
                      ) : (
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2 pr-4">
                            {approvedQuotes.map((quote) => (
                              <div 
                                key={quote.id} 
                                className="p-4 rounded-lg border cursor-pointer hover:border-primary transition-colors"
                                onClick={() => selectQuote(quote)}
                              >
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
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-card p-4 space-y-4">
                      <div className="flex items-center justify-between">
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
                      
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="p-3 rounded-lg bg-muted/50">
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Payment & Totals - Show when items exist */}
              {items.length > 0 && (
                <>
                  {/* Payment Method */}
                  <div className="rounded-xl border bg-card p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      Pagamento
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Desconto (%)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Forma de Pagamento</Label>
                        <RadioGroup
                          value={paymentMethod}
                          onValueChange={(v) => setPaymentMethod(v as 'dinheiro' | 'cartao' | 'pix')}
                          className="flex gap-3"
                        >
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="dinheiro" id="dinheiro" />
                            <Label htmlFor="dinheiro" className="flex items-center gap-1 cursor-pointer text-sm">
                              <DollarSign className="h-3 w-3" /> Dinheiro
                            </Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="cartao" id="cartao" />
                            <Label htmlFor="cartao" className="flex items-center gap-1 cursor-pointer text-sm">
                              <CreditCard className="h-3 w-3" /> Cartão
                            </Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="pix" id="pix" />
                            <Label htmlFor="pix" className="flex items-center gap-1 cursor-pointer text-sm">
                              <Smartphone className="h-3 w-3" /> PIX
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    {discountValue > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Desconto ({discountPercent}%)</span>
                        <span>-{formatCurrency(discountValue)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold border-t pt-3">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleConfirm} 
                      disabled={isLoading || items.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Finalizando...
                        </>
                      ) : (
                        `Faturar ${formatCurrency(total)}`
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : viewMode === 'add-product' ? (
            <div className="py-4">
              <AddProductPanel
                onAdd={handleAddProduct}
                onCancel={() => setViewMode('main')}
              />
            </div>
          ) : viewMode === 'add-material' ? (
            /* ADD MATERIAL VIEW */
            <div className="py-4 space-y-4">
              {/* Back button */}
              <Button variant="outline" size="sm" onClick={() => {
                setViewMode('main');
                setSelectedLinha(null);
              }}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              {/* Step 1: Select Linha */}
              {!selectedLinha && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Selecione a Linha</Label>
                  {linhas.length === 0 ? (
                    <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                      <Layers className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Nenhum material disponível</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                      {linhas.map((linha) => (
                        <button
                          key={linha}
                          type="button"
                          onClick={() => setSelectedLinha(linha)}
                          className="p-4 rounded-xl border-2 text-center hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <p className="font-medium text-sm">{linha}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {availableItems.filter(i => i.linha === linha).length} itens
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select Items from Linha */}
              {selectedLinha && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Linha: {selectedLinha}</Label>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLinha(null)}>
                      Trocar Linha
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[300px] rounded-xl border bg-muted/20 p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filteredItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectMaterialForDimensions(item)}
                          className="p-3 rounded-lg border text-left hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(item.price)} / {item.unit}
                            </p>
                            {item.isDefaultPrice && (
                              <Badge variant="outline" className="text-[9px] h-4">Padrão</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : viewMode === 'material-dimensions' && selectedMaterial ? (
            /* MATERIAL DIMENSIONS VIEW */
            <div className="py-4 space-y-6">
              {/* Back button */}
              <Button variant="outline" size="sm" onClick={() => {
                setViewMode('add-material');
                setSelectedMaterial(null);
              }}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              {/* Material Info */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Layers className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{selectedMaterial.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(selectedMaterial.price)} / {selectedMaterial.unit}
                      </p>
                      {selectedMaterial.isDefaultPrice && (
                        <Badge variant="outline" className="text-[10px] h-4">Preço padrão</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dimensions Input */}
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <Label className="text-sm font-medium text-muted-foreground">
                  Medidas (opcional)
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="material-width">Largura (mm)</Label>
                    <Input
                      id="material-width"
                      type="text"
                      inputMode="numeric"
                      placeholder="Ex: 1000"
                      value={materialWidth}
                      onChange={(e) => setMaterialWidth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="material-height">Altura (mm)</Label>
                    <Input
                      id="material-height"
                      type="text"
                      inputMode="numeric"
                      placeholder="Ex: 2000"
                      value={materialHeight}
                      onChange={(e) => setMaterialHeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Quantity Input */}
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <Label className="text-sm font-medium text-muted-foreground">Quantidade</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setMaterialQuantity(String(Math.max(1, parseInt(materialQuantity) - 1)))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={materialQuantity}
                    onChange={(e) => setMaterialQuantity(e.target.value)}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setMaterialQuantity(String(parseInt(materialQuantity) + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preview and Actions */}
              <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Preço unitário</span>
                  <span>{formatCurrency(selectedMaterial.price)} / {selectedMaterial.unit}</span>
                </div>
                {(parseFloat(materialWidth) > 0 || parseFloat(materialHeight) > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Medidas</span>
                    <span>
                      {parseFloat(materialWidth) || 0}mm × {parseFloat(materialHeight) || 0}mm
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantidade</span>
                  <span>{parseInt(materialQuantity) || 1}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>Total estimado</span>
                  <span className="text-primary">
                    {(() => {
                      const width = parseFloat(materialWidth.replace(',', '.')) || 0;
                      const height = parseFloat(materialHeight.replace(',', '.')) || 0;
                      const qty = parseInt(materialQuantity) || 1;
                      
                      if (selectedMaterial.unit === 'm²' && width > 0 && height > 0) {
                        const areaM2 = (width / 1000) * (height / 1000);
                        return formatCurrency(areaM2 * selectedMaterial.price * qty);
                      } else if (selectedMaterial.unit === 'm' && (width > 0 || height > 0)) {
                        const lengthM = Math.max(width, height) / 1000;
                        return formatCurrency(lengthM * selectedMaterial.price * qty);
                      }
                      return formatCurrency(selectedMaterial.price * qty);
                    })()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => {
                  setViewMode('add-material');
                  setSelectedMaterial(null);
                }}>
                  Cancelar
                </Button>
                <Button onClick={addMaterialWithDimensions}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar à Venda
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
