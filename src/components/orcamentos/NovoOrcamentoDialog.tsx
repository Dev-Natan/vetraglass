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
import { Plus, Trash2, Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const quoteSchema = z.object({
  customer_name: z.string().min(2, 'Nome é obrigatório'),
  customer_phone: z.string().optional(),
  customer_email: z.string().email('Email inválido').optional().or(z.literal('')),
  customer_address: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteItem {
  id?: string;
  company_product_id?: string;
  description: string;
  width?: number;
  height?: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  // Selection state
  selectedLinha?: string;
  selectedCategory?: string;
}

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  notes?: string | null;
  valid_until: string | null;
}

interface NovoOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote | null;
}

export function NovoOrcamentoDialog({ open, onOpenChange, quote }: NovoOrcamentoDialogProps) {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);

  const isEditing = !!quote;

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_address: '',
      valid_until: '',
      notes: '',
    },
  });

  // Fetch company products with linha and category
  const { data: companyProducts } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select(`
          id,
          commercial_name,
          base_price,
          product_templates (
            linha,
            category,
            min_width,
            max_width,
            min_height,
            max_height
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id && open
  });

  // Get unique linhas from products
  const linhas = [...new Set(companyProducts?.map(p => p.product_templates?.linha).filter(Boolean) || [])];
  
  // Get categories for a specific linha
  const getCategoriesForLinha = (linha: string) => {
    const categories = companyProducts
      ?.filter(p => p.product_templates?.linha === linha)
      .map(p => p.product_templates?.category)
      .filter(Boolean) || [];
    return [...new Set(categories)];
  };

  // Get products for a specific linha and category
  const getProductsForLinhaAndCategory = (linha: string, category: string) => {
    return companyProducts?.filter(
      p => p.product_templates?.linha === linha && p.product_templates?.category === category
    ) || [];
  };

  // Category translation map
  const categoryLabels: Record<string, string> = {
    window: 'Janela',
    door: 'Porta',
    partition: 'Divisória',
    mirror: 'Espelho',
    shower: 'Box',
    facade: 'Fachada',
    other: 'Outros',
  };

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
      return data as QuoteItem[];
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
        valid_until: quote.valid_until || '',
        notes: quote.notes || '',
      });
    } else if (open && !quote) {
      form.reset({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_address: '',
        valid_until: '',
        notes: '',
      });
      setItems([]);
      setDiscountPercent(0);
    }
  }, [open, quote, form]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems);
    }
  }, [existingItems]);

  const addItem = () => {
    setItems([...items, {
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      selectedLinha: '',
      selectedCategory: '',
    }]);
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const selectLinha = (index: number, linha: string) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      selectedLinha: linha,
      selectedCategory: '',
      company_product_id: undefined,
      description: '',
      unit_price: 0,
      total_price: 0,
    };
    setItems(newItems);
  };

  const selectCategory = (index: number, category: string) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      selectedCategory: category,
      company_product_id: undefined,
      description: '',
      unit_price: 0,
      total_price: 0,
    };
    setItems(newItems);
  };

  const selectProduct = (index: number, productId: string) => {
    const product = companyProducts?.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        company_product_id: productId,
        description: product.commercial_name,
        unit_price: Number(product.base_price) || 0,
        total_price: (newItems[index].quantity || 1) * (Number(product.base_price) || 0),
      };
      setItems(newItems);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = totalAmount * (discountPercent / 100);
  const finalAmount = totalAmount - discountAmount;

  const createMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      // Create quote
      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          company_id: currentCompany.id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_email: data.customer_email || null,
          customer_address: data.customer_address || null,
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

      // Create items
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map(item => ({
            quote_id: newQuote.id,
            company_product_id: item.company_product_id || null,
            description: item.description,
            width: item.width || null,
            height: item.height || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
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

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_email: data.customer_email || null,
          customer_address: data.customer_address || null,
          valid_until: data.valid_until || null,
          notes: data.notes || null,
          total_amount: totalAmount,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          final_amount: finalAmount,
        })
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      // Delete existing items and recreate
      await supabase.from('quote_items').delete().eq('quote_id', quote.id);

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map(item => ({
            quote_id: quote.id,
            company_product_id: item.company_product_id || null,
            description: item.description,
            width: item.width || null,
            height: item.height || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Customer Info */}
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

            {/* Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Itens do Orçamento</h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="w-4 h-4" />
                  Adicionar Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum item adicionado</p>
                  <Button type="button" variant="link" onClick={addItem}>
                    Adicionar primeiro item
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-3">
                          {/* Linha → Categoria → Produto Selection */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Linha</label>
                              <Select
                                value={item.selectedLinha || ''}
                                onValueChange={(value) => selectLinha(index, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecionar linha" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border">
                                  {linhas.map(linha => (
                                    <SelectItem key={linha} value={linha!}>
                                      {linha}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Categoria</label>
                              <Select
                                value={item.selectedCategory || ''}
                                onValueChange={(value) => selectCategory(index, value)}
                                disabled={!item.selectedLinha}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecionar categoria" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border">
                                  {item.selectedLinha && getCategoriesForLinha(item.selectedLinha).map(category => (
                                    <SelectItem key={category} value={category!}>
                                      {categoryLabels[category!] || category}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Produto</label>
                              <Select
                                value={item.company_product_id || ''}
                                onValueChange={(value) => selectProduct(index, value)}
                                disabled={!item.selectedLinha || !item.selectedCategory}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecionar produto" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border">
                                  {item.selectedLinha && item.selectedCategory && 
                                    getProductsForLinhaAndCategory(item.selectedLinha, item.selectedCategory).map(product => (
                                      <SelectItem key={product.id} value={product.id}>
                                        {product.commercial_name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          {/* Dimensions and Description */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-2">
                              <label className="text-xs text-muted-foreground">Descrição</label>
                              <Input
                                value={item.description}
                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                placeholder="Descrição do item"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Largura (mm)</label>
                              <Input
                                type="number"
                                value={item.width || ''}
                                onChange={(e) => updateItem(index, 'width', Number(e.target.value))}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Altura (mm)</label>
                              <Input
                                type="number"
                                value={item.height || ''}
                                onChange={(e) => updateItem(index, 'height', Number(e.target.value))}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-destructive shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Quantidade</label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Preço Unitário</label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                            min={0}
                            step={0.01}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Total</label>
                          <Input
                            value={formatCurrency(item.total_price)}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Desconto (%)</span>
                <Input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-20 text-right"
                />
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Desconto</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(finalAmount)}</span>
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
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {isEditing ? 'Salvar Alterações' : 'Criar Orçamento'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
