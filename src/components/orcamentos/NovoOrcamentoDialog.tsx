import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Package, ShoppingCart, User, FileText } from 'lucide-react';
import { AddProductPanel } from './AddProductPanel';
import { QuoteItemCard } from './QuoteItemCard';

const quoteSchema = z.object({
  customer_name: z.string().min(2, 'Nome é obrigatório'),
  customer_phone: z.string().optional(),
  customer_email: z.string().email('Email inválido').optional().or(z.literal('')),
  customer_address: z.string().optional(),
  customer_document: z.string().optional(),
  customer_document_type: z.string().optional(),
  customer_profession: z.string().optional(),
  customer_marital_status: z.string().optional(),
  payment_terms: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteItem {
  id?: string;
  company_product_id?: string;
  product_template_id?: string;
  description: string;
  width?: number;
  height?: number;
  quantity: number;
  base_price_m2: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
  linha?: string | null;
  category?: string;
  has_glass?: boolean;
  glass_color?: string;
  glass_thickness?: string;
}

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  customer_document?: string | null;
  customer_document_type?: string | null;
  customer_profession?: string | null;
  customer_marital_status?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  valid_until: string | null;
}

interface NovoOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote | null;
}

type ViewMode = 'form' | 'add-product';

export function NovoOrcamentoDialog({ open, onOpenChange, quote }: NovoOrcamentoDialogProps) {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('form');

  const isEditing = !!quote;

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_address: '',
      customer_document: '',
      customer_document_type: 'fisica',
      customer_profession: '',
      customer_marital_status: '',
      payment_terms: '',
      valid_until: '',
      notes: '',
    },
  });

  // Fetch quote items when editing
  const { data: existingItems } = useQuery({
    queryKey: ['quote-items', quote?.id],
    queryFn: async () => {
      if (!quote?.id) return [];
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id);
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        base_price_m2: item.width && item.height 
          ? item.unit_price / ((item.width / 1000) * (item.height / 1000)) 
          : item.unit_price,
      })) as QuoteItem[];
    },
    enabled: !!quote?.id && open
  });

  // Reset form when dialog opens/closes or quote changes
  useEffect(() => {
    if (open && quote) {
      form.reset({
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone || '',
        customer_email: quote.customer_email || '',
        customer_address: quote.customer_address || '',
        customer_document: quote.customer_document || '',
        customer_document_type: quote.customer_document_type || 'fisica',
        customer_profession: quote.customer_profession || '',
        customer_marital_status: quote.customer_marital_status || '',
        payment_terms: quote.payment_terms || '',
        valid_until: quote.valid_until || '',
        notes: quote.notes || '',
      });
      setViewMode('form');
    } else if (open && !quote) {
      form.reset({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_address: '',
        customer_document: '',
        customer_document_type: 'fisica',
        customer_profession: '',
        customer_marital_status: '',
        payment_terms: '',
        valid_until: '',
        notes: '',
      });
      setItems([]);
      setDiscountPercent(0);
      setViewMode('form');
    }
  }, [open, quote, form]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems);
    }
  }, [existingItems]);

  const calculatePriceFromDimensions = (item: QuoteItem, basePrice: number) => {
    const widthM = (item.width || 0) / 1000;
    const heightM = (item.height || 0) / 1000;
    const area = widthM * heightM;
    
    if (area > 0) {
      return basePrice * area;
    }
    return basePrice;
  };

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
    const newItem: QuoteItem = {
      product_template_id: product.product_template_id,
      company_product_id: product.company_product_id,
      description: product.name,
      width: product.width,
      height: product.height,
      quantity: product.quantity,
      base_price_m2: product.base_price,
      unit_price: product.unit_price,
      total_price: product.total_price,
      image_url: product.image_url,
      linha: product.linha,
      category: product.category,
      has_glass: product.has_glass,
      glass_color: product.glass_color,
      glass_thickness: product.glass_thickness,
    };
    setItems([...items, newItem]);
    setViewMode('form');
    toast({ title: 'Produto adicionado!' });
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate price based on dimensions
    if (field === 'width' || field === 'height' || field === 'base_price_m2') {
      const item = newItems[index];
      const basePrice = item.base_price_m2 || 0;
      
      if (basePrice > 0) {
        const calculatedPrice = calculatePriceFromDimensions(item, basePrice);
        newItems[index].unit_price = Math.round(calculatedPrice * 100) / 100;
      }
    }
    
    // Recalculate total
    newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = totalAmount * (discountPercent / 100);
  const finalAmount = totalAmount - discountAmount;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const createMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          company_id: currentCompany.id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_email: data.customer_email || null,
          customer_address: data.customer_address || null,
          customer_document: data.customer_document || null,
          customer_document_type: data.customer_document_type || 'fisica',
          customer_profession: data.customer_profession || null,
          customer_marital_status: data.customer_marital_status || null,
          payment_terms: data.payment_terms || null,
          valid_until: data.valid_until || null,
          notes: data.notes || null,
          total_amount: totalAmount,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          final_amount: finalAmount,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map(item => ({
            quote_id: newQuote.id,
            company_product_id: item.company_product_id || null,
            product_template_id: item.product_template_id || null,
            description: item.description,
            width: item.width || null,
            height: item.height || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            has_glass: item.has_glass ?? false,
            glass_color: item.glass_color || null,
            glass_thickness: item.glass_thickness || null,
          })));

        if (itemsError) throw itemsError;
      }

      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento criado com sucesso!' });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar orçamento', description: error.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!quote?.id) throw new Error('Orçamento não encontrado');

      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_email: data.customer_email || null,
          customer_address: data.customer_address || null,
          customer_document: data.customer_document || null,
          customer_document_type: data.customer_document_type || 'fisica',
          customer_profession: data.customer_profession || null,
          customer_marital_status: data.customer_marital_status || null,
          payment_terms: data.payment_terms || null,
          valid_until: data.valid_until || null,
          notes: data.notes || null,
          total_amount: totalAmount,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          final_amount: finalAmount,
        })
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      await supabase.from('quote_items').delete().eq('quote_id', quote.id);

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map(item => ({
            quote_id: quote.id,
            company_product_id: item.company_product_id || null,
            product_template_id: item.product_template_id || null,
            description: item.description,
            width: item.width || null,
            height: item.height || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            has_glass: item.has_glass ?? false,
            glass_color: item.glass_color || null,
            glass_thickness: item.glass_thickness || null,
          })));

        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Orçamento atualizado com sucesso!' });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar orçamento', description: error.message, variant: 'destructive' });
    }
  });

  const onSubmit = (data: QuoteFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {viewMode === 'form' ? (
              <>
                <ShoppingCart className="w-5 h-5" />
                {isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Adicionar Produto
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {viewMode === 'form' ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                {/* Customer Info Section */}
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="w-4 h-4" />
                    Dados do Cliente
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Cliente *</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customer_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customer_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="email@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="valid_until"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Válido até</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                      </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_terms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forma de Pagamento</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: 50% entrada + 50% na entrega" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="customer_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Endereço completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contract Fields Section */}
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    Dados para Contrato (opcional)
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_document"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF/CNPJ</FormLabel>
                          <FormControl>
                            <Input placeholder="000.000.000-00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customer_document_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Pessoa</FormLabel>
                          <FormControl>
                            <select 
                              {...field} 
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              <option value="fisica">Pessoa Física</option>
                              <option value="juridica">Pessoa Jurídica</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customer_profession"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profissão</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Empresário, Autônomo..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customer_marital_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado Civil</FormLabel>
                          <FormControl>
                            <select 
                              {...field} 
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              <option value="">Selecione...</option>
                              <option value="Solteiro(a)">Solteiro(a)</option>
                              <option value="Casado(a)">Casado(a)</option>
                              <option value="Divorciado(a)">Divorciado(a)</option>
                              <option value="Viúvo(a)">Viúvo(a)</option>
                              <option value="União Estável">União Estável</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                </div>

                {/* Items Section */}
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Package className="w-4 h-4" />
                      Produtos ({items.length})
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setViewMode('add-product')}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </Button>
                  </div>

                  {items.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setViewMode('add-product')}
                      className="w-full border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Nenhum produto adicionado</p>
                      <p className="text-sm mt-1">Clique para selecionar um produto</p>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <QuoteItemCard
                          key={index}
                          item={item}
                          index={index}
                          onUpdate={updateItem}
                          onRemove={removeItem}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Desconto (%)</span>
                    <Input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-20 h-8 text-right bg-background"
                    />
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Desconto</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold border-t pt-3">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(finalAmount)}</span>
                  </div>
                </div>

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Observações adicionais..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Actions */}
                <div className="flex justify-end gap-3 pb-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {isEditing ? 'Salvar Alterações' : 'Criar Orçamento'}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="py-4">
              <AddProductPanel
                onAdd={handleAddProduct}
                onCancel={() => setViewMode('form')}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
