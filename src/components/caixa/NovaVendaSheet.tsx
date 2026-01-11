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
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Search, DollarSign, CreditCard, Smartphone, ShoppingCart, 
  Package, Layers, SquareStack, Sparkles, Wrench, X
} from 'lucide-react';
import { VendaItemCard, VendaItem } from './VendaItemCard';

interface ItemTemplate {
  id: string;
  name: string;
  unit: string;
  type: string;
  price: number;
}

interface CompanyProduct {
  id: string;
  commercial_name: string;
  base_price: number | null;
  product_template?: {
    name: string;
    category: string;
  };
}

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
  }) => Promise<unknown>;
  availableItems: ItemTemplate[];
  availableProducts?: CompanyProduct[];
  isLoading?: boolean;
}

export function NovaVendaSheet({
  open,
  onOpenChange,
  onConfirm,
  availableItems,
  availableProducts = [],
  isLoading = false,
}: NovaVendaSheetProps) {
  const [items, setItems] = useState<VendaItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [discountPercent, setDiscountPercent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'materiais' | 'produtos'>('materiais');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const discountValue = useMemo(() => {
    const percent = parseFloat(discountPercent.replace(',', '.')) || 0;
    return (subtotal * percent) / 100;
  }, [subtotal, discountPercent]);

  const total = subtotal - discountValue;

  // Get unique types for filter
  const itemTypes = useMemo(() => {
    const types = [...new Set(availableItems.map(item => item.type))];
    return types;
  }, [availableItems]);

  const filteredItems = useMemo(() => {
    let filtered = availableItems;
    
    // Filter by type if selected
    if (typeFilter) {
      filtered = filtered.filter(item => item.type === typeFilter);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(term));
    }
    
    return filtered.slice(0, 30);
  }, [availableItems, searchTerm, typeFilter]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return availableProducts.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return availableProducts
      .filter((p) => p.commercial_name.toLowerCase().includes(term))
      .slice(0, 20);
  }, [availableProducts, searchTerm]);

  const addItem = (template: ItemTemplate) => {
    const existingIndex = items.findIndex((i) => i.itemTemplateId === template.id && !i.isProduct);
    
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].totalPrice = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setItems(updated);
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
      setItems([...items, newItem]);
    }
  };

  const addProduct = (product: CompanyProduct) => {
    const newItem: VendaItem = {
      id: crypto.randomUUID(),
      companyProductId: product.id,
      name: product.commercial_name,
      unit: 'un',
      quantity: 1,
      unitPrice: product.base_price || 0,
      totalPrice: product.base_price || 0,
      width: 1000,
      height: 1000,
      isProduct: true,
    };
    setItems([...items, newItem]);
    setSearchTerm('');
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    setItems(items.map((item) => 
      item.id === id 
        ? { ...item, quantity, totalPrice: quantity * item.unitPrice }
        : item
    ));
  };

  const handlePriceChange = (id: string, price: number) => {
    setItems(items.map((item) => 
      item.id === id 
        ? { ...item, unitPrice: price, totalPrice: item.quantity * price }
        : item
    ));
  };

  const handleDimensionsChange = (id: string, width: number, height: number) => {
    setItems(items.map((item) => 
      item.id === id 
        ? { ...item, width, height }
        : item
    ));
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
    });
    resetForm();
  };

  const resetForm = () => {
    setItems([]);
    setCustomerName('');
    setPaymentMethod('dinheiro');
    setDiscountPercent('');
    setSearchTerm('');
    setActiveTab('materiais');
    setTypeFilter(null);
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

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nova Venda
          </SheetTitle>
          <SheetDescription>
            Adicione materiais ou produtos para registrar a venda.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Tabs for Materials vs Products */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'materiais' | 'produtos')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="materiais" className="gap-2">
                <Layers className="h-4 w-4" />
                Materiais
              </TabsTrigger>
              <TabsTrigger value="produtos" className="gap-2">
                <Package className="h-4 w-4" />
                Produtos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="materiais" className="mt-4 space-y-3">
              {/* Type Filter Chips */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={typeFilter === null ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTypeFilter(null)}
                >
                  Todos
                </Button>
                {itemTypes.map((type) => {
                  const getTypeIcon = (t: string) => {
                    switch (t) {
                      case 'profile': return <SquareStack className="h-3 w-3" />;
                      case 'glass': return <Sparkles className="h-3 w-3" />;
                      case 'accessory': return <Wrench className="h-3 w-3" />;
                      default: return null;
                    }
                  };
                  const getTypeLabel = (t: string) => {
                    switch (t) {
                      case 'profile': return 'Perfis';
                      case 'glass': return 'Vidros';
                      case 'accessory': return 'Acessórios';
                      case 'service': return 'Serviços';
                      default: return t;
                    }
                  };
                  return (
                    <Button
                      key={type}
                      type="button"
                      variant={typeFilter === type ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                    >
                      {getTypeIcon(type)}
                      {getTypeLabel(type)}
                    </Button>
                  );
                })}
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchTerm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Results List - always show when filter is active or searching */}
              <div className="border rounded-lg max-h-48 overflow-auto">
                {filteredItems.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    Nenhum material encontrado
                  </p>
                ) : (
                  filteredItems.map((item) => {
                    const getTypeBadge = (t: string) => {
                      switch (t) {
                        case 'profile': return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Perfil</Badge>;
                        case 'glass': return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600">Vidro</Badge>;
                        case 'accessory': return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">Acessório</Badge>;
                        case 'service': return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-600">Serviço</Badge>;
                        default: return null;
                      }
                    };
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full px-3 py-2.5 text-left hover:bg-muted flex items-center gap-3 text-sm border-b last:border-b-0 transition-colors"
                        onClick={() => {
                          addItem(item);
                          setSearchTerm('');
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {getTypeBadge(item.type)}
                            <span className="text-xs text-muted-foreground">{item.unit}</span>
                          </div>
                        </div>
                        <span className="font-semibold text-primary whitespace-nowrap">
                          {formatCurrency(item.price)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {filteredItems.length} de {availableItems.length} materiais
              </p>
            </TabsContent>

            <TabsContent value="produtos" className="mt-4 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar janela, porta, box..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchTerm && (
                <div className="border rounded-lg max-h-40 overflow-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum produto encontrado
                    </p>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between text-sm"
                        onClick={() => addProduct(product)}
                      >
                        <div>
                          <span className="font-medium">{product.commercial_name}</span>
                          {product.product_template?.category && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({product.product_template.category})
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {product.base_price ? formatCurrency(product.base_price) : 'Sob consulta'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {availableProducts.length === 0 && !searchTerm && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum produto ativo. Ative produtos na aba Produtos.
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* Lista de Itens */}
          <div className="flex-1 overflow-hidden">
            <Label className="mb-2 block">Itens da Venda ({items.length})</Label>
            {items.length === 0 ? (
              <div className="h-32 flex items-center justify-center border border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Busque e adicione itens acima
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100%-24px)] pr-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <VendaItemCard
                      key={item.id}
                      item={item}
                      onQuantityChange={handleQuantityChange}
                      onPriceChange={handlePriceChange}
                      onDimensionsChange={handleDimensionsChange}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Cliente e Pagamento */}
          <div className="space-y-4 border-t pt-4">
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

        <SheetFooter className="border-t pt-4">
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
              `Finalizar Venda ${formatCurrency(total)}`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
