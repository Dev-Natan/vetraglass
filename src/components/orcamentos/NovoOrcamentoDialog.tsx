import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { ShoppingCart } from 'lucide-react';
import { formatPhoneBR } from '@/utils/phoneMask';

import {
  quoteSchema,
  DEFAULT_FORM_VALUES,
  type QuoteFormData,
  type QuoteItem,
  type Step,
  type NovoOrcamentoDialogProps,
} from './_novo-orcamento/types';
import { computeTotals, formatCurrency } from './_novo-orcamento/utils';
import { useClientsList } from './_novo-orcamento/hooks/useClientsList';
import { useExistingQuoteItems } from './_novo-orcamento/hooks/useExistingQuoteItems';
import { useQuoteItems } from './_novo-orcamento/hooks/useQuoteItems';
import { useQuoteSubmit } from './_novo-orcamento/hooks/useQuoteSubmit';
import { StepIndicator, steps } from './_novo-orcamento/parts/StepIndicator';
import { ClientStep } from './_novo-orcamento/parts/ClientStep';
import { ProductsStep } from './_novo-orcamento/parts/ProductsStep';
import { SummaryStep } from './_novo-orcamento/parts/SummaryStep';
import { FinalizeStep } from './_novo-orcamento/parts/FinalizeStep';
import { AddProductDialog, AddItemDialog } from './_novo-orcamento/parts/AddPanels';
import { WizardFooter } from './_novo-orcamento/parts/WizardFooter';

export function NovoOrcamentoDialog({ open, onOpenChange, quote, duplicate }: NovoOrcamentoDialogProps) {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();


  const [discountPercent, setDiscountPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>('client');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showMedidasColumn, setShowMedidasColumn] = useState(true);
  const [showM2Column, setShowM2Column] = useState(true);

  const isEditing = !!quote && !duplicate;
  const isDuplicating = !!quote && !!duplicate;

  const { items, setItems, addItem, removeItem, updateItem } = useQuoteItems();

  const { data: clients } = useClientsList(currentCompany?.id);
  const { data: existingItems, isLoading: isLoadingExistingItems, isFetching: isFetchingExistingItems } = useExistingQuoteItems(quote?.id, open);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

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
      form.setValue('customer_phone', formatPhoneBR(client.phone || ''));
      form.setValue('customer_email', client.email || '');

      const addressParts = [client.address, client.city, client.state, client.zip_code].filter(Boolean);
      form.setValue('customer_address', addressParts.join(', '));

      form.setValue('customer_document', client.document || '');
      form.setValue('customer_document_type', client.document_type === 'CNPJ' ? 'juridica' : 'fisica');
    }
  };

  // Reset form when dialog opens/closes or quote changes
  useEffect(() => {
    if (open && quote && !duplicate) {
      // Reset items immediately to avoid showing stale data from previous quote
      setItems([]);
      form.reset({
        customer_name: quote.customer_name,
        customer_phone: formatPhoneBR(quote.customer_phone || ''),
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
      setShowMedidasColumn(quote.show_measures_column ?? true);
      setShowM2Column(quote.show_m2_column ?? true);
      setCurrentStep('products');
      setShowAddProduct(false);
    } else if (open && quote && duplicate) {
      // Duplicating: keep items (loaded below), but start fresh on client step with empty customer
      setItems([]);
      form.reset({
        ...DEFAULT_FORM_VALUES,
        payment_terms: quote.payment_terms || '',
        notes: quote.notes || '',
      });
      setDiscountPercent(0);
      setSelectedClientId('');
      setCurrentStep('client');
      setShowAddProduct(false);
      setShowAddItem(false);
      setShowMedidasColumn(quote.show_measures_column ?? true);
      setShowM2Column(quote.show_m2_column ?? true);
    } else if (open && !quote) {
      form.reset(DEFAULT_FORM_VALUES);
      setItems([]);
      setDiscountPercent(0);
      setCurrentStep('client');
      setShowAddProduct(false);
      setSelectedClientId('');
      setShowAddItem(false);
      setShowMedidasColumn(true);
      setShowM2Column(true);
    }
  }, [open, quote?.id, duplicate, form, setItems]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      // When duplicating, strip ids so items are inserted as new records
      const prepared = isDuplicating
        ? existingItems.map(({ id, ...rest }) => rest as QuoteItem)
        : existingItems;
      setItems(prepared);
    }
  }, [existingItems, setItems, isDuplicating]);


  const totals = useMemo(() => computeTotals(items, discountPercent), [items, discountPercent]);

  const { createMutation, updateMutation } = useQuoteSubmit({
    companyId: currentCompany?.id,
    quote,
    items,
    totals,
    discountPercent,
    showMeasuresColumn: showMedidasColumn,
    showM2Column,
    onClose: () => onOpenChange(false),
  });

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
    width_b?: number;
    height_b?: number;
    width_c?: number;
    height_c?: number;
    vao_width?: number;
    vao_height?: number;
    vao_width_b?: number;
    vao_height_b?: number;
    quantity: number;
    leaves_count?: number;
    glasses_count?: number;
    panels_count?: number;
    sides_count?: number;
    unit_price: number;
    total_price: number;
    has_glass?: boolean;
    glass_color?: string;
    glass_thickness?: string;
    include_contramarco?: boolean;
    excluded_optional_ids?: string[];
    notes?: string;
    components?: Array<{
      description: string;
      quantity: number;
      unit_price: number;
    }>;
  }) => {
    addItem({
      product_template_id: product.product_template_id,
      company_product_id: product.company_product_id,
      description: product.name,
      width: product.width,
      height: product.height,
      width_b: product.width_b,
      height_b: product.height_b,
      width_c: product.width_c,
      height_c: product.height_c,
      vao_width: product.vao_width,
      vao_height: product.vao_height,
      quantity: product.quantity,
      leaves_count: product.leaves_count,
      glasses_count: product.glasses_count,
      panels_count: product.panels_count,
      sides_count: product.sides_count,
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
      notes: product.notes,
    });
    setShowAddProduct(false);
    
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
    width?: number;
    height?: number;
    notes?: string;
  }) => {
    addItem({
      company_item_id: item.company_item_id,
      item_type: 'item',
      description: item.name,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      base_price_m2: item.unit_price,
      unit_price: item.unit_price,
      total_price: item.total_price,
      image_url: item.image_url,
      linha: item.linha,
      category: item.type,
      unit: item.unit,
      notes: item.notes,
    });
    setShowAddItem(false);
    
  };

  const onSubmit = (data: QuoteFormData) => {
    if (isEditing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const canProceedFromClient = (form.watch('customer_name')?.length ?? 0) >= 2;
  const canProceedFromProducts = items.length > 0;

  const autoCreateClientIfNeeded = async () => {
    if (isEditing) return;
    if (selectedClientId && selectedClientId !== 'new') return;
    if (!currentCompany?.id) return;

    const name = (form.getValues('customer_name') || '').trim();
    const phone = (form.getValues('customer_phone') || '').trim();
    const email = (form.getValues('customer_email') || '').trim();
    const address = (form.getValues('customer_address') || '').trim();
    if (name.length < 2) return;

    const normalizedName = name.toLowerCase();
    const phoneDigits = phone.replace(/\D/g, '');
    const duplicate = (clients || []).find((c) => {
      const cName = (c.name || '').trim().toLowerCase();
      const cPhoneDigits = (c.phone || '').replace(/\D/g, '');
      return cName === normalizedName || (phoneDigits.length >= 8 && cPhoneDigits === phoneDigits);
    });
    if (duplicate) {
      setSelectedClientId(duplicate.id);
      return;
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_id: currentCompany.id,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        document: form.getValues('customer_document') || null,
        document_type:
          form.getValues('customer_document_type') === 'juridica' ? 'CNPJ' : 'CPF',
        client_type: 'cliente',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[auto-create-client] insert failed', error);
      return;
    }

    if (data?.id) setSelectedClientId(data.id);
    await queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast({ description: 'Novo cliente cadastrado automaticamente!' });
  };

  const handleNext = async () => {
    if (currentStep === 'client' && canProceedFromClient) {
      await autoCreateClientIfNeeded();
      setCurrentStep('products');
    } else if (currentStep === 'products' && canProceedFromProducts) setCurrentStep('summary');
    else if (currentStep === 'summary') setCurrentStep('finalize');
  };


  const handleBack = () => {
    if (currentStep === 'products') setCurrentStep('client');
    else if (currentStep === 'summary') setCurrentStep('products');
    else if (currentStep === 'finalize') setCurrentStep('summary');
  };

  if (showAddProduct) {
    return (
      <AddProductDialog
        open={open}
        onOpenChange={onOpenChange}
        onAdd={handleAddProduct}
        onCancel={() => setShowAddProduct(false)}
      />
    );
  }

  if (showAddItem) {
    return (
      <AddItemDialog
        open={open}
        onOpenChange={onOpenChange}
        onAdd={handleAddItem}
        onCancel={() => setShowAddItem(false)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b bg-gradient-to-br from-background to-muted/30 space-y-4">
          <div>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <ShoppingCart className="w-6 h-6 text-primary" />
              {isEditing ? 'Editar orçamento' : isDuplicating ? 'Duplicar orçamento' : 'Novo orçamento'}

            </DialogTitle>
            <DialogDescription className="text-primary/80 mt-1">
              Monte sua proposta com cálculo automático.
            </DialogDescription>
          </div>

          <StepIndicator currentStep={currentStep} onStepChange={setCurrentStep} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-muted/20">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {currentStep === 'client' && (
                <ClientStep
                  form={form}
                  isEditing={isEditing}
                  clients={clients}
                  selectedClientId={selectedClientId}
                  onClientSelect={handleClientSelect}
                />
              )}

              {currentStep === 'products' && (
                <ProductsStep
                  items={items}
                  isLoading={isEditing && (isLoadingExistingItems || isFetchingExistingItems) && items.length === 0}
                  onAddProduct={() => setShowAddProduct(true)}
                  onAddItem={() => setShowAddItem(true)}
                  onUpdateItem={updateItem as (i: number, f: keyof QuoteItem, v: unknown) => void}
                  onRemoveItem={removeItem}
                  formatCurrency={formatCurrency}
                />

              )}

              {currentStep === 'summary' && (
                <SummaryStep
                  form={form}
                  items={items}
                  totalAmount={totals.totalAmount}
                  discountPercent={discountPercent}
                  discountAmount={totals.discountAmount}
                  finalAmount={totals.finalAmount}
                  onDiscountChange={setDiscountPercent}
                  onStepChange={setCurrentStep}
                  onRemoveItem={removeItem}
                  formatCurrency={formatCurrency}
                />
              )}

              {currentStep === 'finalize' && (
                <FinalizeStep
                  form={form}
                  finalAmount={totals.finalAmount}
                  itemsCount={items.length}
                  customerName={form.watch('customer_name') || ''}
                  showMedidasColumn={showMedidasColumn}
                  showM2Column={showM2Column}
                  onToggleMedidas={setShowMedidasColumn}
                  onToggleM2={setShowM2Column}
                  formatCurrency={formatCurrency}
                />
              )}
            </form>
          </Form>
        </div>

        <WizardFooter
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          isEditing={isEditing}
          isPending={createMutation.isPending || updateMutation.isPending}
          canProceedFromClient={canProceedFromClient}
          canProceedFromProducts={canProceedFromProducts}
          itemsCount={items.length}
          partialTotal={totals.finalAmount}
          formatCurrency={formatCurrency}
          onCancel={() => onOpenChange(false)}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={form.handleSubmit(onSubmit)}
        />
      </DialogContent>
    </Dialog>
  );
}
