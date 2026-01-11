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
import { 
  Loader2, DollarSign, CreditCard, Smartphone, ShoppingCart
} from 'lucide-react';
import { VendaItemCard, VendaItem } from './VendaItemCard';
import { UniversalProductSearch } from './UniversalProductSearch';

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
  product_template_id: string;
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

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const discountValue = useMemo(() => {
    const percent = parseFloat(discountPercent.replace(',', '.')) || 0;
    return (subtotal * percent) / 100;
  }, [subtotal, discountPercent]);

  const total = subtotal - discountValue;

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
      width: 0,
      height: 0,
      isProduct: true,
    };
    setItems([...items, newItem]);
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      
      if (item.isProduct && item.width && item.height) {
        // For products: area (m²) × quantity × unit price
        const areaM2 = (item.width / 1000) * (item.height / 1000);
        return { ...item, quantity, totalPrice: areaM2 * quantity * item.unitPrice };
      }
      
      // For materials: quantity × unit price
      return { ...item, quantity, totalPrice: quantity * item.unitPrice };
    }));
  };

  const handlePriceChange = (id: string, price: number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      
      if (item.isProduct && item.width && item.height) {
        // For products: area (m²) × quantity × unit price
        const areaM2 = (item.width / 1000) * (item.height / 1000);
        return { ...item, unitPrice: price, totalPrice: areaM2 * item.quantity * price };
      }
      
      // For materials: quantity × unit price
      return { ...item, unitPrice: price, totalPrice: item.quantity * price };
    }));
  };

  const handleDimensionsChange = (id: string, width: number, height: number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      
      // Calculate area in m² (dimensions are in mm)
      const areaM2 = (width / 1000) * (height / 1000);
      // Total = area × quantity × unit price (price per m²)
      const totalPrice = areaM2 * item.quantity * item.unitPrice;
      
      return { ...item, width, height, totalPrice };
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
    });
    resetForm();
  };

  const resetForm = () => {
    setItems([]);
    setCustomerName('');
    setPaymentMethod('dinheiro');
    setDiscountPercent('');
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
          {/* Universal Search */}
          <div className="space-y-2">
            <Label>Adicionar Item</Label>
            <UniversalProductSearch
              availableItems={availableItems}
              availableProducts={availableProducts}
              onSelectMaterial={addItem}
              onSelectProduct={addProduct}
            />
          </div>

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
