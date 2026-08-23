import { parseCurrencyBRL } from '@/utils/currencyMask';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Package, ShoppingCart, FileText, Trash2, Minus,
  DollarSign, CreditCard, Smartphone, Loader2, ArrowLeft, Layers, Box, User, Calculator, Search
} from 'lucide-react';
import { AddProductPanel } from '@/components/orcamentos/AddProductPanel';
import { AddToStockDialog } from './AddToStockDialog';
import { createUuid } from '@/utils/createUuid';
import { InstallmentPaymentSheet, PaymentConfig } from './InstallmentPaymentSheet';
import type { SaleCompositionLine } from '@/utils/buildCompositionFromFormula';
import { buildImmediateItemSnapshot, snapshotMaterials, type FulfillmentMode } from '@/utils/canonicalEngineeringSnapshot';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export interface VendaItem {
  id: string;
  itemTemplateId?: string;
  companyProductId?: string;
  productTemplateId?: string;
  name: string;
  unit: string;
  type?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  width?: number;
  height?: number;
  isProduct?: boolean;
  isDefaultPrice?: boolean;
  composition?: SaleCompositionLine[];
  engineeringSnapshot?: Json;
  fulfillmentMode?: FulfillmentMode;
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
  // Campos financeiros da VIEW
  total_deposits?: number;
  total_sold?: number;
  pending_amount?: number;
  financial_status?: 'pending' | 'partially_paid' | 'fully_paid' | string;
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
  composition_snapshot?: Json | null;
  fulfillment_mode?: FulfillmentMode | null;
}

type VendaMode = 'orcamento' | 'avulsa';
type ViewMode = 'main' | 'add-product' | 'add-material' | 'material-dimensions';

interface NovaVendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    items: VendaItem[];
    customerName: string;
    paymentConfig: PaymentConfig;
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
  const [discountPercent, setDiscountPercent] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // Payment configuration state
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  
  // Material mode navigation
  const [selectedLinha, setSelectedLinha] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<ItemTemplate | null>(null);
  const [materialWidth, setMaterialWidth] = useState('');
  const [materialHeight, setMaterialHeight] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState('1');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  
  // Stock check dialog state
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [pendingItem, setPendingItem] = useState<VendaItem | null>(null);
  const [isAddingStock, setIsAddingStock] = useState(false);
  
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();
  
  // Fetch company stock to check if item exists
  const { data: companyStock } = useQuery({
    queryKey: ['company-stock', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_stock')
        .select('item_template_id, quantity')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false, // Prevent refetch on input focus
  });
  
  const linhas = useMemo(() => getLinhas(availableItems), [availableItems]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const discountValue = useMemo(() => {
    const percent = parseCurrencyBRL(discountPercent);
    return (subtotal * percent) / 100;
  }, [subtotal, discountPercent]);

  // Créditos já recebidos no orçamento (entradas + faturamentos anteriores),
  // calculados a partir dos registros reais em quote_deposits + sales com
  // deduplicação por (amount, timestamp ±5s) para evitar dupla contagem
  // quando uma venda anterior gerou também um registro de depósito.
  const { data: previouslyPaid = 0 } = useQuery({
    queryKey: ['quote-previously-paid', selectedQuote?.id],
    enabled: !!selectedQuote?.id,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (!selectedQuote?.id) return 0;
      const [depRes, salRes] = await Promise.all([
        supabase
          .from('quote_deposits')
          .select('amount, received_at, created_at')
          .eq('quote_id', selectedQuote.id)
          .eq('status', 'received'),
        supabase
          .from('sales')
          .select('paid_amount, total_amount, created_at, cancelled_at')
          .eq('quote_id', selectedQuote.id)
          .is('cancelled_at', null),
      ]);
      const deposits = (depRes.data || []).map(d => ({
        amount: Number(d.amount) || 0,
        ts: new Date(d.received_at || d.created_at || Date.now()).getTime(),
      }));
      const sales = (salRes.data || []).map(s => ({
        amount: Number(s.paid_amount ?? s.total_amount) || 0,
        ts: new Date(s.created_at || Date.now()).getTime(),
      }));
      // Dedup: para cada depósito, se existe venda com mesmo valor dentro
      // de ±5s, considera que ambos representam a mesma transação e conta
      // apenas uma vez (a venda tem prioridade).
      const TOL = 5000;
      const seen = new Set<number>();
      let recomputed = 0;
      for (const s of sales) recomputed += s.amount;
      for (const d of deposits) {
        const hit = sales.findIndex(
          (s, i) => !seen.has(i) && s.amount === d.amount && Math.abs(s.ts - d.ts) <= TOL
        );
        if (hit >= 0) seen.add(hit);
        else recomputed += d.amount;
      }
      return Math.max(0, recomputed);
    },
  });

  // Mapa de "Total Já Pago" (deduplicado) por orçamento aprovado, para
  // exibição consistente nos cards da listagem. Segue a mesma regra de
  // deduplicação (amount + timestamp ±5s) usada no rodapé.
  const approvedQuoteIds = useMemo(
    () => (approvedQuotes || []).map(q => q.id).filter(Boolean),
    [approvedQuotes]
  );
  const { data: paidByQuote = {} } = useQuery<Record<string, number>>({
    queryKey: ['approved-quotes-paid-map', approvedQuoteIds],
    enabled: approvedQuoteIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const [depRes, salRes] = await Promise.all([
        supabase
          .from('quote_deposits')
          .select('quote_id, amount, received_at, created_at')
          .in('quote_id', approvedQuoteIds)
          .eq('status', 'received'),
        supabase
          .from('sales')
          .select('quote_id, paid_amount, total_amount, created_at, cancelled_at')
          .in('quote_id', approvedQuoteIds)
          .is('cancelled_at', null),
      ]);
      const TOL = 5000;
      const result: Record<string, number> = {};
      for (const qid of approvedQuoteIds) {
        const deposits = (depRes.data || [])
          .filter(d => d.quote_id === qid)
          .map(d => ({
            amount: Number(d.amount) || 0,
            ts: new Date(d.received_at || d.created_at || Date.now()).getTime(),
          }));
        const sales = (salRes.data || [])
          .filter(s => s.quote_id === qid)
          .map(s => ({
            amount: Number(s.paid_amount ?? s.total_amount) || 0,
            ts: new Date(s.created_at || Date.now()).getTime(),
          }));
        const seen = new Set<number>();
        let paid = 0;
        for (const s of sales) paid += s.amount;
        for (const d of deposits) {
          const hit = sales.findIndex(
            (s, i) => !seen.has(i) && s.amount === d.amount && Math.abs(s.ts - d.ts) <= TOL
          );
          if (hit >= 0) seen.add(hit);
          else paid += d.amount;
        }
        result[qid] = Math.max(0, paid);
      }
      return result;
    },
  });

  const grossTotal = subtotal - discountValue;
  const total = Math.max(0, grossTotal - previouslyPaid);

  // Select material for dimensions input
  const selectMaterialForDimensions = (template: ItemTemplate) => {
    setSelectedMaterial(template);
    setMaterialWidth('');
    setMaterialHeight('');
    setMaterialQuantity('1');
    setViewMode('material-dimensions');
  };

  // Add material item with dimensions
  // Profile price is always per bar (6000mm = 6m), calculate proportionally when selling fractional
  const PROFILE_BAR_LENGTH_MM = 6000;
  
  // Check if item exists in stock
  const checkItemInStock = (itemTemplateId: string): boolean => {
    if (!companyStock) return false;
    return companyStock.some(stock => stock.item_template_id === itemTemplateId);
  };
  
  // Get stock quantity for an item
  const getStockQuantity = (itemTemplateId: string): number => {
    if (!companyStock) return 0;
    const stockItem = companyStock.find(stock => stock.item_template_id === itemTemplateId);
    return stockItem?.quantity || 0;
  };
  
  // Add item to stock
  const addItemToStock = async (itemTemplateId: string, quantity: number) => {
    if (!currentCompany?.id) return;
    
    setIsAddingStock(true);
    try {
      const itemType = availableItems.find(i => i.id === itemTemplateId)?.type;
      
      const { error } = await supabase
        .from('company_stock')
        .insert({
          company_id: currentCompany.id,
          item_template_id: itemTemplateId,
          quantity,
          min_quantity: 0,
          is_active: true,
          allow_fractional: itemType === 'profile',
        });
      
      if (error) throw error;
      
      toast.success('Item adicionado ao estoque com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['company-stock', currentCompany.id] });
      invalidateStock();
    } catch (error) {
      console.error('Error adding to stock:', error);
      toast.error('Erro ao adicionar item ao estoque');
    } finally {
      setIsAddingStock(false);
    }
  };
  
  // Create VendaItem from selected material
  const createVendaItem = (): VendaItem | null => {
    if (!selectedMaterial) return null;
    
    const width = parseCurrencyBRL(materialWidth);
    const height = parseCurrencyBRL(materialHeight);
    const quantity = parseInt(materialQuantity) || 1;
    
    // Calculate based on unit type
    let totalPrice = selectedMaterial.price * quantity;
    
    if (selectedMaterial.type === 'profile') {
      // Profile: price is per bar (6000mm), calculate proportionally
      if (width > 0) {
        const pricePerMm = selectedMaterial.price / PROFILE_BAR_LENGTH_MM;
        totalPrice = pricePerMm * width * quantity;
      }
    } else if (selectedMaterial.unit === 'm²' && width > 0 && height > 0) {
      // Glass/other m² items: calculate area
      const areaM2 = (width / 1000) * (height / 1000);
      totalPrice = areaM2 * selectedMaterial.price * quantity;
    } else if (selectedMaterial.unit === 'm' && (width > 0 || height > 0)) {
      // Linear items
      const lengthM = Math.max(width, height) / 1000;
      totalPrice = lengthM * selectedMaterial.price * quantity;
    }
    
    return {
      id: createUuid(),
      itemTemplateId: selectedMaterial.id,
      name: selectedMaterial.name,
      unit: selectedMaterial.unit,
      type: selectedMaterial.type,
      quantity,
      unitPrice: Number((totalPrice / quantity).toFixed(2)),
      totalPrice,
      width: width > 0 ? width : undefined,
      height: selectedMaterial.type !== 'profile' && height > 0 ? height : undefined,
      isProduct: false,
      isDefaultPrice: selectedMaterial.isDefaultPrice,
    };
  };
  
  // Finalize adding item to sale
  const finalizeAddItem = async (item: VendaItem) => {
    if (!currentCompany?.id || !item.itemTemplateId) {
      toast.error('MISSING_COMPANY_ITEM');
      return;
    }
    try {
      const snapshot = await buildImmediateItemSnapshot({
        companyId: currentCompany.id,
        itemTemplateId: item.itemTemplateId,
        quantity: item.quantity,
        width: item.width,
        height: item.height,
      });
      setItems(prev => [...prev, {
        ...item,
        engineeringSnapshot: snapshot as unknown as Json,
        fulfillmentMode: snapshot.fulfillment_mode,
      }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'INVALID_ENGINEERING_RULE');
      return;
    }
    setSelectedMaterial(null);
    setSelectedLinha(null);
    setPendingItem(null);
    setShowStockDialog(false);
    setViewMode('main');
  };
  
  const addMaterialWithDimensions = async () => {
    if (!selectedMaterial) return;
    
    const newItem = createVendaItem();
    if (!newItem) return;
    
    // Check if item exists in stock
    const isInStock = checkItemInStock(selectedMaterial.id);
    
    if (!isInStock) {
      // Show dialog to add to stock
      setPendingItem(newItem);
      setShowStockDialog(true);
    } else {
      // Check if quantity sold exceeds stock
      const stockQuantity = getStockQuantity(selectedMaterial.id);
      const quantitySold = parseInt(materialQuantity) || 1;
      
      if (quantitySold > stockQuantity) {
        const isProfile = selectedMaterial.type === 'profile';
        const stockDisplay = isProfile ? `${stockQuantity} barras (${stockQuantity * 6}m)` : `${stockQuantity} ${selectedMaterial.unit}`;
        const soldDisplay = isProfile ? `${quantitySold} barras` : `${quantitySold} ${selectedMaterial.unit}`;
        
        toast.warning(
          `Atenção: Quantidade vendida (${soldDisplay}) é maior que o estoque disponível (${stockDisplay}).`,
          { duration: 5000 }
        );
      }
      
      // Item is in stock, add directly
      await finalizeAddItem(newItem);
    }
  };
  
  // Handle stock dialog confirm
  const handleStockDialogConfirm = async (quantity: number) => {
    if (!selectedMaterial || !pendingItem) return;
    
    await addItemToStock(selectedMaterial.id, quantity);
    await finalizeAddItem(pendingItem);
  };
  
  // Handle stock dialog skip
  const handleStockDialogSkip = () => {
    if (pendingItem) {
      void finalizeAddItem(pendingItem);
    }
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
    composition_snapshot?: Json;
    fulfillment_mode?: FulfillmentMode;
  }) => {
    const itemId = createUuid();
    const newItem: VendaItem = {
      id: itemId,
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
      composition: [],
      engineeringSnapshot: product.composition_snapshot,
      fulfillmentMode: product.fulfillment_mode,
    };
    setItems(prev => [...prev, newItem]);
    setViewMode('main');

    if (product.composition_snapshot) {
      const lines = snapshotMaterials(product.composition_snapshot).map((material, index) => {
        const row = material as Record<string, Json>;
        return {
          id: String(row.key || row.source_rule_id || index),
          companyItemId: typeof row.company_item_id === 'string' ? row.company_item_id : null,
          itemTemplateId: typeof row.item_template_id === 'string' ? row.item_template_id : null,
          itemName: String(row.item_name || 'Material'),
          unit: String(row.unit || 'un'),
          itemType: typeof row.material_type === 'string' ? row.material_type : undefined,
          quantity: Number(row.quantity || 0),
          source: 'formula' as const,
        };
      });
      setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, composition: lines } : it));
    } else if (currentCompany?.id) {
      void supabase.rpc('build_fixed_engineering_snapshot', {
        _company_id: currentCompany.id,
        _product_template_id: product.product_template_id,
        _width: product.width,
        _height: product.height,
        _quantity: product.quantity,
        _opening_width: product.width,
        _opening_height: product.height,
      }).then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          return;
        }
        setItems((prev) => prev.map((it) => it.id === itemId ? {
          ...it,
          engineeringSnapshot: data,
          fulfillmentMode: product.fulfillment_mode || 'PRODUCTION',
        } : it));
      });
    }
  };

  // Select quote and load items (orcamento mode)
  const selectQuote = (quote: Quote) => {
    // Verificar se já está totalmente pago (não deveria chegar aqui, mas por segurança)
    if (quote.financial_status === 'fully_paid') {
      toast.error('Este orçamento já foi totalmente faturado. Não é possível faturar novamente.');
      return;
    }
    
    setSelectedQuote(quote);
    setCustomerName(quote.customer_name);
    
    // Usar mesmo cálculo deduplicado do card/rodapé
    const alreadyPaid = paidByQuote[quote.id] ?? 0;
    if (alreadyPaid > 0) {
      const pendingAmount = Math.max(0, (Number(quote.final_amount) || 0) - alreadyPaid);
      toast.info(
        `Este orçamento possui uma entrada anterior já recebida de ${formatCurrency(alreadyPaid)}. Saldo restante a faturar: ${formatCurrency(pendingAmount)}`,
        { duration: 6000 }
      );
    }
    
    // Valor fechado no ato da aprovação (já com desconto da forma escolhida).
    // Escalamos proporcionalmente os preços dos itens para que a soma bata
    // exatamente com esse valor — assim Subtotal/Total do rodapé refletem
    // o valor líquido combinado, não o bruto de tabela.
    const rawItems = quote.quote_items || [];
    const rawSum = rawItems.reduce((s, qi) => s + (Number(qi.total_price) || 0), 0);
    const lockedTotal = Number(quote.final_amount) || rawSum;
    const scale = rawSum > 0 ? lockedTotal / rawSum : 1;
    const vendaItems: VendaItem[] = rawItems.map(qi => {
      const scaledTotal = Number(((qi.total_price || 0) * scale).toFixed(2));
      const qty = qi.quantity || 1;
      return {
        id: createUuid(),
        companyProductId: qi.company_product_id || undefined,
        productTemplateId: qi.product_template_id || undefined,
        name: qi.description,
        unit: 'm²',
        quantity: qty,
        unitPrice: Number((scaledTotal / qty).toFixed(2)),
        totalPrice: scaledTotal,
        width: qi.width || undefined,
        height: qi.height || undefined,
        isProduct: !!(qi.company_product_id || qi.product_template_id),
        engineeringSnapshot: qi.composition_snapshot || undefined,
        fulfillmentMode: qi.fulfillment_mode || undefined,
      };
    });

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

  const handlePaymentConfirm = (config: PaymentConfig) => {
    setPaymentConfig(config);
  };

  const autoCreateClientIfNeeded = async () => {
    if (mode !== 'avulsa') return;
    if (!currentCompany?.id) return;
    const name = (customerName || '').trim();
    if (name.length < 2) return;

    const normalized = name.toLowerCase();
    const { data: existing } = await supabase
      .from('clients')
      .select('id, name')
      .eq('company_id', currentCompany.id)
      .ilike('name', name)
      .limit(1);

    if (existing && existing.some((c) => (c.name || '').trim().toLowerCase() === normalized)) {
      return;
    }

    const { error } = await supabase.from('clients').insert({
      company_id: currentCompany.id,
      name,
      is_active: true,
    });

    if (error) {
      console.error('[auto-create-client] insert failed', error);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast.success('Novo cliente cadastrado automaticamente!');
  };

  const handleConfirm = async () => {
    if (!paymentConfig) {
      toast.error('Configure o pagamento antes de finalizar');
      return;
    }
    if (items.some((item) => !item.engineeringSnapshot || !item.fulfillmentMode)) {
      toast.error('SNAPSHOT_MISSING');
      return;
    }
    await autoCreateClientIfNeeded();
    await onConfirm({
      items,
      customerName,
      paymentConfig,
      discountPercent: parseCurrencyBRL(discountPercent),
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
    setDiscountPercent('');
    setSelectedQuote(null);
    setSelectedLinha(null);
    setSelectedMaterial(null);
    setMaterialWidth('');
    setMaterialHeight('');
    setMaterialQuantity('1');
    setMaterialSearchQuery('');
    setViewMode('main');
    setMode('avulsa');
    setPendingItem(null);
    setShowStockDialog(false);
    setPaymentConfig(null);
    setPaymentSheetOpen(false);
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

  // Get items filtered by linha and search
  const filteredItems = useMemo(() => {
    if (!selectedLinha) return [];
    let items = availableItems.filter(item => item.linha === selectedLinha);
    if (materialSearchQuery) {
      const q = materialSearchQuery.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(q));
    }
    return items;
  }, [availableItems, selectedLinha, materialSearchQuery]);

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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm truncate">{item.name}</p>
                                  {item.isProduct && (
                                    <Badge variant="secondary" className="text-[10px] h-4">Produto</Badge>
                                  )}
                                  {item.isDefaultPrice && (
                                    <Badge variant="outline" className="text-[10px] h-4">Preço padrão</Badge>
                                  )}
                                </div>
                                {item.type === 'profile' && item.width ? (
                                  <p className="text-xs text-muted-foreground">
                                    {item.width}mm = {(item.width/1000).toFixed(2)} m
                                  </p>
                                ) : item.width || item.height ? (
                                  <p className="text-xs text-muted-foreground">
                                    {item.width}mm × {item.height}mm
                                    {item.unit === 'm²' && item.width && item.height && (
                                      <span> = {((item.width/1000)*(item.height/1000)).toFixed(2)} m²</span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(item.unitPrice)} / {item.unit} × {item.quantity}
                                  </p>
                                )}
                                {item.isProduct && item.composition && item.composition.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {item.composition.length} item(ns) de estoque na composição
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
                            {approvedQuotes.map((quote) => {
                              const totalPaid = paidByQuote[quote.id] ?? 0;
                              const quoteTotal = Number(quote.final_amount) || 0;
                              const remaining = Math.max(0, quoteTotal - totalPaid);
                              const hasPayments = totalPaid > 0;

                              return (
                                <div
                                  key={quote.id}
                                  className={`p-4 rounded-lg border cursor-pointer hover:border-primary transition-colors ${
                                    hasPayments ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : ''
                                  }`}
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
                                      {hasPayments ? (
                                        <>
                                          <p className="text-xs text-muted-foreground line-through">
                                            {formatCurrency(quoteTotal)}
                                          </p>
                                          <p className="font-semibold text-primary">
                                            {formatCurrency(remaining)}
                                          </p>
                                        </>
                                      ) : (
                                        <p className="font-semibold text-primary">
                                          {formatCurrency(quoteTotal)}
                                        </p>
                                      )}
                                      <Badge variant="secondary">{quote.quote_items?.length || 0} itens</Badge>
                                    </div>
                                  </div>

                                  {hasPayments && (
                                    <div className="mt-3 p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-amber-800 dark:text-amber-200">🟡 Valor Total do Orçamento</span>
                                        <span className="font-medium text-amber-900 dark:text-amber-100">{formatCurrency(quoteTotal)}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-blue-800 dark:text-blue-200">🔵 Total Já Pago / Recebido</span>
                                        <span className="font-medium text-blue-900 dark:text-blue-100">{formatCurrency(totalPaid)}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-300/50">
                                        <span className="text-green-800 dark:text-green-200 font-medium">🟢 Saldo Restante a Faturar</span>
                                        <span className="font-bold text-green-900 dark:text-green-100">{formatCurrency(remaining)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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
                      
                      {/* Resumo financeiro do orçamento selecionado */}
                      {previouslyPaid > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Resumo Financeiro
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Valor Original</p>
                              <p className="font-medium">{formatCurrency(selectedQuote.final_amount)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Já Recebido</p>
                              <p className="font-medium text-amber-600">-{formatCurrency(previouslyPaid)}</p>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-amber-200 dark:border-amber-700">
                              <p className="text-muted-foreground">Saldo a Cobrar</p>
                              <p className="font-bold text-lg text-green-600">
                                {formatCurrency(Math.max(0, selectedQuote.final_amount - previouslyPaid))}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
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
                  {/* Discount & Payment Config */}
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
                        <Button 
                          type="button"
                          variant="outline" 
                          className="w-full justify-start gap-2"
                          onClick={() => setPaymentSheetOpen(true)}
                        >
                          <Calculator className="w-4 h-4" />
                          {paymentConfig ? (
                            <span className="flex-1 text-left">
                              {paymentConfig.type === 'full' ? 'À Vista' : 
                               paymentConfig.type === 'partial' ? `Entrada + Saldo` :
                               `${paymentConfig.installmentsCount}x`}
                              {' - '}
                              {paymentConfig.method === 'dinheiro' ? 'Dinheiro' :
                               paymentConfig.method === 'cartao' ? 'Cartão' :
                               paymentConfig.method === 'pix' ? 'PIX' :
                               paymentConfig.method === 'boleto' ? 'Boleto' : 'Transferência'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Configurar pagamento</span>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Payment Summary */}
                    {paymentConfig && paymentConfig.type !== 'full' && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Entrada (hoje)</span>
                          <span className="font-medium text-green-600">{formatCurrency(paymentConfig.paidAmount)}</span>
                        </div>
                        {paymentConfig.installments.length > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              A receber ({paymentConfig.installments.length} parcela{paymentConfig.installments.length > 1 ? 's' : ''})
                            </span>
                            <span className="font-medium text-orange-600">
                              {formatCurrency(total - paymentConfig.paidAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
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
                    {selectedQuote && previouslyPaid > 0 && (
                      <>
                        <div className="flex justify-between text-sm font-medium border-t pt-2">
                          <span className="text-muted-foreground">Total do Orçamento</span>
                          <span>{formatCurrency(grossTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-amber-600">Já recebido (entradas / vendas anteriores)</span>
                          <span className="font-medium text-amber-600">
                            -{formatCurrency(previouslyPaid)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xl font-bold border-t pt-3">
                          <span>Saldo a Cobrar</span>
                          <span className="text-primary">{formatCurrency(total)}</span>
                        </div>
                      </>
                    )}
                    {!(selectedQuote && previouslyPaid > 0) && (
                      <div className="flex justify-between text-xl font-bold border-t pt-3">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(total)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleConfirm} 
                      disabled={isLoading || items.length === 0 || !paymentConfig}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Finalizando...
                        </>
                      ) : (
                        // `total` já representa o Saldo a Cobrar
                        // (grossTotal - previouslyPaid). Não subtrair novamente.
                        `Faturar ${formatCurrency(total)}`
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* Payment Sheet — total já é o saldo restante, não passar dedução extra */}
              <InstallmentPaymentSheet
                open={paymentSheetOpen}
                onOpenChange={setPaymentSheetOpen}
                totalAmount={total}
                onConfirm={handlePaymentConfirm}
                quoteDepositAmount={0}
              />
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

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Pesquisar material..."
                      value={materialSearchQuery}
                      onChange={(e) => setMaterialSearchQuery(e.target.value)}
                      className="pl-9"
                    />
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
                  {selectedMaterial.type === 'profile' ? 'Tamanho (opcional)' : 'Medidas (opcional)'}
                </Label>
                {selectedMaterial.type === 'profile' ? (
                  /* Profile - only length field */
                  <div className="space-y-2">
                    <Label htmlFor="material-length">Comprimento (mm)</Label>
                    <Input
                      id="material-length"
                      type="text"
                      inputMode="numeric"
                      placeholder="Ex: 6000"
                      value={materialWidth}
                      onChange={(e) => setMaterialWidth(e.target.value)}
                    />
                  </div>
                ) : (
                  /* Other types - width and height */
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
                )}
              </div>

              {/* Quantity Input */}
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <Label className="text-sm font-medium text-muted-foreground">
                  {selectedMaterial.type === 'profile' ? 'Quantidade de barras' : 'Quantidade'}
                </Label>
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
                {selectedMaterial.type === 'profile' && parseFloat(materialWidth) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comprimento</span>
                    <span>{parseFloat(materialWidth) || 0}mm</span>
                  </div>
                )}
                {selectedMaterial.type !== 'profile' && (parseFloat(materialWidth) > 0 || parseFloat(materialHeight) > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Medidas</span>
                    <span>
                      {parseFloat(materialWidth) || 0}mm × {parseFloat(materialHeight) || 0}mm
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedMaterial.type === 'profile' ? 'Quantidade de barras' : 'Quantidade'}
                  </span>
                  <span>{parseInt(materialQuantity) || 1}</span>
                </div>
                {selectedMaterial.type === 'profile' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total metros lineares</span>
                    <span>{((parseInt(materialQuantity) || 1) * 6).toFixed(1)}m</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-3">
                  <span>Total estimado</span>
                  <span className="text-primary">
                    {(() => {
                      const width = parseCurrencyBRL(materialWidth);
                      const height = parseCurrencyBRL(materialHeight);
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
      
      {/* Add to Stock Dialog */}
      <AddToStockDialog
        open={showStockDialog}
        onOpenChange={setShowStockDialog}
        itemName={selectedMaterial?.name || pendingItem?.name || ''}
        itemUnit={selectedMaterial?.unit || pendingItem?.unit || ''}
        itemType={selectedMaterial?.type || pendingItem?.type}
        onConfirm={handleStockDialogConfirm}
        onSkip={handleStockDialogSkip}
        isLoading={isAddingStock}
      />

    </Dialog>
  );
}
