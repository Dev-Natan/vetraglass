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
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, Package, ShoppingCart, User, ChevronRight, ChevronLeft, 
  Check, Trash2, FileText, Layers
} from 'lucide-react';
import { AddProductPanel } from './AddProductPanel';
import { AddItemPanel } from './AddItemPanel';
import { QuoteItemCard } from './QuoteItemCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const quoteSchema = z.object({
  customer_name: z.string().min(2, 'Nome do cliente é obrigatório (mínimo 2 caracteres)').max(100, 'Nome deve ter no máximo 100 caracteres'),
  customer_phone: z.string().optional().refine(val => {
    if (!val) return true;
    return val.replace(/\D/g, '').length >= 10;
  }, { message: 'Telefone deve ter pelo menos 10 dígitos' }),
  customer_email: z.string().email('Formato de e-mail inválido (ex: nome@email.com)').optional().or(z.literal('')),
  customer_address: z.string().max(200, 'Endereço deve ter no máximo 200 caracteres').optional(),
  customer_document: z.string().optional(),
  customer_document_type: z.string().optional(),
  customer_profession: z.string().max(100, 'Profissão deve ter no máximo 100 caracteres').optional(),
  customer_marital_status: z.string().optional(),
  payment_terms: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().max(1000, 'Observações devem ter no máximo 1000 caracteres').optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteItem {
  id?: string;
  company_product_id?: string;
  product_template_id?: string;
  company_item_id?: string;
  item_type?: 'product' | 'item';
  description: string;
  width?: number;
  height?: number;
  vao_width?: number;
  vao_height?: number;
  quantity: number;
  base_price_m2: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
  linha?: string | null;
  category?: string;
  unit?: string;
  has_glass?: boolean;
  glass_color?: string;
  glass_thickness?: string;
  include_contramarco?: boolean;
  excluded_optional_ids?: string[];
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

type Step = 'client' | 'products' | 'review';

export function NovoOrcamentoDialog({ open, onOpenChange, quote }: NovoOrcamentoDialogProps) {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>('client');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showContractFields, setShowContractFields] = useState(false);

  const isEditing = !!quote;

  // Fetch registered clients
  const { data: clients } = useQuery({
    queryKey: ['clients', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

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

  // Handle client selection - auto-fill form fields
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    
    if (clientId === 'new') {
      form.setValue('customer_name', '');
      form.setValue('customer_phone', '');
      form.setValue('customer_email', '');
      form.setValue('customer_address', '');
      form.setValue('customer_document', '');
      form.setValue('customer_document_type', 'fisica');
      return;
    }
    
    const client = clients?.find(c => c.id === clientId);
    if (client) {
      form.setValue('customer_name', client.name || '');
      form.setValue('customer_phone', client.phone || '');
      form.setValue('customer_email', client.email || '');
      
      const addressParts = [
        client.address,
        client.city,
        client.state,
        client.zip_code
      ].filter(Boolean);
      form.setValue('customer_address', addressParts.join(', '));
      
      form.setValue('customer_document', client.document || '');
      form.setValue('customer_document_type', client.document_type === 'CNPJ' ? 'juridica' : 'fisica');
    }
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
      return (data || []).map(item => ({
        ...item,
        base_price_m2: item.width && item.height 
          ? item.unit_price / ((item.width / 1000) * (item.height / 1000)) 
          : item.unit_price,
        item_type: item.company_item_id ? 'item' : 'product',
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
      // Ao editar, iniciar na etapa de produtos (cliente já definido)
      setCurrentStep('products');
      setShowAddProduct(false);
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
      setCurrentStep('client');
      setShowAddProduct(false);
      setSelectedClientId('');
      setShowContractFields(false);
      setShowAddItem(false);
    }
  }, [open, quote, form]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems);
    }
  }, [existingItems]);

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
    vao_width?: number;
    vao_height?: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    has_glass?: boolean;
    glass_color?: string;
    glass_thickness?: string;
    include_contramarco?: boolean;
    excluded_optional_ids?: string[];
  }) => {
    const newItem: QuoteItem = {
      product_template_id: product.product_template_id,
      company_product_id: product.company_product_id,
      description: product.name,
      width: product.width,
      height: product.height,
      vao_width: product.vao_width,
      vao_height: product.vao_height,
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
      include_contramarco: product.include_contramarco,
      excluded_optional_ids: product.excluded_optional_ids,
    };
    setItems([...items, newItem]);
    setShowAddProduct(false);
    toast({ title: 'Produto adicionado!' });
  };

  const handleAddItem = (item: {
    company_item_id: string;
    name: string;
    unit: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    image_url?: string | null;
    linha?: string | null;
    type?: string;
  }) => {
    const newItem: QuoteItem = {
      company_item_id: item.company_item_id,
      item_type: 'item',
      description: item.name,
      quantity: item.quantity,
      base_price_m2: item.unit_price,
      unit_price: item.unit_price,
      total_price: item.total_price,
      image_url: item.image_url,
      linha: item.linha,
      category: item.type,
      unit: item.unit,
    };
    setItems([...items, newItem]);
    setShowAddItem(false);
    toast({ title: 'Item adicionado!' });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Função para atualizar item (edição inline)
  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const updated = { ...item, [field]: value };
      
      // Recalcular preços quando dimensões ou quantidade mudam
      if (field === 'width' || field === 'height' || field === 'quantity' || field === 'base_price_m2') {
        const width = field === 'width' ? value : updated.width || 0;
        const height = field === 'height' ? value : updated.height || 0;
        const quantity = field === 'quantity' ? value : updated.quantity || 1;
        const basePriceM2 = field === 'base_price_m2' ? value : updated.base_price_m2 || 0;
        
        const areaM2 = (width / 1000) * (height / 1000);
        const unitPrice = areaM2 * basePriceM2;
        const totalPrice = unitPrice * quantity;
        
        return {
          ...updated,
          width,
          height,
          quantity,
          base_price_m2: basePriceM2,
          unit_price: unitPrice,
          total_price: totalPrice,
        };
      }
      
      return updated;
    }));
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
            company_item_id: item.company_item_id || null,
            item_type: item.item_type || 'product',
            description: item.description,
            width: item.width || null,
            height: item.height || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            unit: item.unit || null,
            has_glass: item.has_glass ?? false,
            glass_color: item.glass_color || null,
            glass_thickness: item.glass_thickness || null,
            include_contramarco: item.include_contramarco ?? true,
            excluded_optional_ids: item.excluded_optional_ids || [],
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
            company_item_id: item.company_item_id || null,
            item_type: item.item_type || 'product',
            description: item.description,
            width: item.width || null,
            height: item.height || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            unit: item.unit || null,
            has_glass: item.has_glass ?? false,
            glass_color: item.glass_color || null,
            glass_thickness: item.glass_thickness || null,
            include_contramarco: item.include_contramarco ?? true,
            excluded_optional_ids: item.excluded_optional_ids || [],
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

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'client', label: 'Cliente', icon: <User className="w-4 h-4" /> },
    { key: 'products', label: 'Produtos', icon: <Package className="w-4 h-4" /> },
    { key: 'review', label: 'Finalizar', icon: <Check className="w-4 h-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const canProceedFromClient = form.watch('customer_name')?.length >= 2;
  const canProceedFromProducts = items.length > 0;

  const handleNext = () => {
    if (currentStep === 'client' && canProceedFromClient) {
      setCurrentStep('products');
    } else if (currentStep === 'products' && canProceedFromProducts) {
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'products') {
      setCurrentStep('client');
    } else if (currentStep === 'review') {
      setCurrentStep('products');
    }
  };

  if (showAddProduct) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Adicionar Produto
            </DialogTitle>
            <DialogDescription>
              Selecione o produto e configure as dimensões.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <AddProductPanel
              onAdd={handleAddProduct}
              onCancel={() => setShowAddProduct(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showAddItem) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Adicionar Item Avulso
            </DialogTitle>
            <DialogDescription>
              Selecione o item (perfil, acessório, vidro avulso, etc).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <AddItemPanel
              onAdd={handleAddItem}
              onCancel={() => setShowAddItem(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'client' && 'Informe os dados do cliente'}
            {currentStep === 'products' && 'Adicione os produtos do orçamento'}
            {currentStep === 'review' && 'Revise e finalize o orçamento'}
          </DialogDescription>
          
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (index < currentStepIndex) {
                      setCurrentStep(step.key);
                    }
                  }}
                  disabled={index > currentStepIndex}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    currentStep === step.key
                      ? "bg-primary text-primary-foreground"
                      : index < currentStepIndex
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.icon}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Step 1: Client */}
              {currentStep === 'client' && (
                <div className="space-y-4">
                  {/* Se estiver editando, mostrar dados do cliente como resumo somente leitura */}
                  {isEditing ? (
                    <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Cliente</span>
                        <Badge variant="secondary">Dados preservados</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{form.watch('customer_name')}</span>
                        </div>
                        {form.watch('customer_phone') && (
                          <p className="text-sm text-muted-foreground pl-6">{form.watch('customer_phone')}</p>
                        )}
                        {form.watch('customer_email') && (
                          <p className="text-sm text-muted-foreground pl-6">{form.watch('customer_email')}</p>
                        )}
                        {form.watch('customer_address') && (
                          <p className="text-sm text-muted-foreground pl-6">{form.watch('customer_address')}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Para alterar dados do cliente, acesse o cadastro de clientes.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Client Selector - apenas para novos orçamentos */}
                      {(clients?.length || 0) > 0 && (
                        <div className="space-y-2">
                          <FormLabel>Cliente Cadastrado</FormLabel>
                          <Select value={selectedClientId} onValueChange={handleClientSelect}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione ou digite novo cliente..." />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border shadow-lg z-50">
                              <SelectItem value="new">
                                <span className="text-primary">+ Novo Cliente</span>
                              </SelectItem>
                              {clients?.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Essential Fields */}
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
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="customer_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefone</FormLabel>
                              <FormControl>
                                <Input placeholder="(00) 00000-0000" {...field} />
                              </FormControl>
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
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {/* Collapsible Contract Fields - apenas para novos orçamentos */}
                  {!isEditing && (
                    <Collapsible open={showContractFields} onOpenChange={setShowContractFields}>
                      <CollapsibleTrigger asChild>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <FileText className="w-4 h-4" />
                          Dados para contrato (opcional)
                          <ChevronRight className={cn(
                            "w-4 h-4 ml-auto transition-transform",
                            showContractFields && "rotate-90"
                          )} />
                        </Button>
                      </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="customer_document"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPF/CNPJ</FormLabel>
                              <FormControl>
                                <Input placeholder="000.000.000-00" {...field} />
                              </FormControl>
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
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="fisica">Pessoa Física</option>
                                  <option value="juridica">Pessoa Jurídica</option>
                                </select>
                              </FormControl>
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
                                <Input placeholder="Ex: Empresário" {...field} />
                              </FormControl>
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
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="">Selecione...</option>
                                  <option value="Solteiro(a)">Solteiro(a)</option>
                                  <option value="Casado(a)">Casado(a)</option>
                                  <option value="Divorciado(a)">Divorciado(a)</option>
                                  <option value="Viúvo(a)">Viúvo(a)</option>
                                </select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  )}
                </div>
              )}

              {/* Step 2: Products */}
              {currentStep === 'products' && (
                <div className="space-y-4">
                  {items.length === 0 ? (
                    <div className="space-y-4">
                      <p className="text-center text-muted-foreground text-sm">
                        Adicione produtos completos ou itens avulsos ao orçamento
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setShowAddProduct(true)}
                          className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="font-medium text-sm">Produto</p>
                          <p className="text-xs mt-1">Janelas, portas, etc</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddItem(true)}
                          className="border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="font-medium text-sm">Item Avulso</p>
                          <p className="text-xs mt-1">Perfis, vidros, acessórios</p>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <QuoteItemCard
                          key={item.id || index}
                          item={item}
                          index={index}
                          onUpdate={updateItem}
                          onRemove={removeItem}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                      
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => setShowAddProduct(true)}
                        >
                          <Package className="w-4 h-4" />
                          Produto
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => setShowAddItem(true)}
                        >
                          <Layers className="w-4 h-4" />
                          Item Avulso
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Review */}
              {currentStep === 'review' && (
                <div className="space-y-4">
                  {/* Client Summary */}
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Cliente</span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setCurrentStep('client')}
                      >
                        Editar
                      </Button>
                    </div>
                    <p className="font-semibold">{form.watch('customer_name')}</p>
                    {form.watch('customer_phone') && (
                      <p className="text-sm text-muted-foreground">{form.watch('customer_phone')}</p>
                    )}
                  </div>

                  {/* Products Summary */}
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Produtos ({items.length})
                      </span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setCurrentStep('products')}
                      >
                        Editar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="truncate flex-1">{item.description}</span>
                          <span className="font-medium ml-2">{formatCurrency(item.total_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment & Validity */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="valid_until"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Válido até</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
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
                            <Input placeholder="50% entrada + 50% entrega" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Observações adicionais..." rows={2} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Totals */}
                  <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
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
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-6 pt-4 border-t flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={currentStepIndex === 0 ? () => onOpenChange(false) : handleBack}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
          </Button>

          {currentStep !== 'review' ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={
                (currentStep === 'client' && !canProceedFromClient) ||
                (currentStep === 'products' && !canProceedFromProducts)
              }
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Salvar Alterações' : 'Criar Orçamento'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
