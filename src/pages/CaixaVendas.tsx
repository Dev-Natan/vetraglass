import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Lock, Plus, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Parser } from 'expr-eval';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { AbrirCaixaDialog } from '@/components/caixa/AbrirCaixaDialog';
import { FecharCaixaDialog } from '@/components/caixa/FecharCaixaDialog';
import { NovaVendaDialog, VendaItem } from '@/components/caixa/NovaVendaDialog';
import { CaixaResumo } from '@/components/caixa/CaixaResumo';
import { VendasTable } from '@/components/caixa/VendasTable';
import { CancelarVendaDialog } from '@/components/caixa/CancelarVendaDialog';
import { DetalhesVendaDialog } from '@/components/caixa/DetalhesVendaDialog';
import { generateSalePdf } from '@/utils/generateSalePdf';

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all';

// Função para calcular quantidade baseada na fórmula do componente
function calculateFormulaQuantity(formula: string, width: number, height: number, piecesQty: number): number {
  try {
    // Converter mm para metros para cálculos
    const L = width / 1000; // Largura em metros
    const A = height / 1000; // Altura em metros
    
    // Substituir variáveis comuns na fórmula
    let processedFormula = formula
      .replace(/largura/gi, 'L')
      .replace(/altura/gi, 'A')
      .replace(/,/g, '.'); // Tratar vírgulas decimais
    
    const parser = new Parser();
    const result = parser.evaluate(processedFormula, { L, A, l: L, a: A });
    
    // Multiplicar pela quantidade de peças e converter para metros
    return (result / 1000) * piecesQty;
  } catch (error) {
    console.error('Erro ao calcular fórmula:', formula, error);
    return 0;
  }
}

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  discount_percent: number | null;
  payment_method: string;
  payment_status: string;
  created_at: string;
  notes: string | null;
}

export default function CaixaVendas() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [abrirCaixaOpen, setAbrirCaixaOpen] = useState(false);
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false);
  const [novaVendaOpen, setNovaVendaOpen] = useState(false);
  const [cancelarVendaOpen, setCancelarVendaOpen] = useState(false);
  const [detalhesVendaOpen, setDetalhesVendaOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
  const [pendingOpenNewSale, setPendingOpenNewSale] = useState(false);

  // Buscar caixa aberto
  const { data: openCashRegister, isLoading: loadingCashRegister } = useQuery({
    queryKey: ['cash-register-open', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Open new sale dialog if ?novo=true in URL (after cash register loads)
  useEffect(() => {
    if (searchParams.get('novo') === 'true') {
      setPendingOpenNewSale(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Open dialog once cash register is loaded and open
  useEffect(() => {
    if (pendingOpenNewSale && openCashRegister) {
      setNovaVendaOpen(true);
      setPendingOpenNewSale(false);
    }
  }, [pendingOpenNewSale, openCashRegister]);

  // Buscar vendas do dia (se caixa aberto) - para resumo do caixa atual
  const { data: todaySales = [] } = useQuery({
    queryKey: ['sales-today', openCashRegister?.id],
    queryFn: async () => {
      if (!openCashRegister?.id) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('cash_register_id', openCashRegister.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!openCashRegister?.id,
  });

  // Calcular datas para filtro de período
  const getDateRange = (period: PeriodFilter) => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'week':
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfDay(now) };
      case 'all':
        return { start: null, end: null };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  // Buscar vendas com filtro de período
  const { data: filteredSales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales-filtered', currentCompany?.id, periodFilter],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { start, end } = getDateRange(periodFilter);
      
      let query = supabase
        .from('sales')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      
      if (start) {
        query = query.gte('created_at', start.toISOString());
      }
      if (end) {
        query = query.lte('created_at', end.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar todos os itens disponíveis com fallback de preço
  const { data: availableItems = [] } = useQuery({
    queryKey: ['available-items', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Buscar todos os item_templates ativos
      const { data: allItems, error: itemsError } = await supabase
        .from('item_templates')
        .select('id, name, unit, type, linha, default_price')
        .eq('is_active', true);
      
      if (itemsError) throw itemsError;
      
      // Buscar preços da empresa
      const { data: companyPrices, error: pricesError } = await supabase
        .from('company_item_prices')
        .select('item_template_id, price')
        .eq('company_id', currentCompany.id);
      
      if (pricesError) throw pricesError;
      
      // Mapear preços: company_price ?? default_price
      const priceMap = new Map<string, number>();
      (companyPrices || []).forEach(cp => {
        if (cp.item_template_id && cp.price !== null) {
          priceMap.set(cp.item_template_id, cp.price);
        }
      });
      
      return (allItems || []).map(item => {
        const companyPrice = priceMap.get(item.id);
        const hasCompanyPrice = companyPrice !== undefined;
        return {
          id: item.id,
          name: item.name,
          unit: item.unit,
          type: item.type,
          linha: item.linha,
          price: hasCompanyPrice ? companyPrice : (item.default_price || 0),
          isDefaultPrice: !hasCompanyPrice,
        };
      });
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar produtos da empresa com product_template_id e linha
  const { data: availableProducts = [] } = useQuery({
    queryKey: ['available-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('company_products')
        .select(`
          id,
          commercial_name,
          base_price,
          product_template_id,
          product_template:product_templates (
            name,
            category,
            linha
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar orçamentos aprovados
  const { data: approvedQuotes = [] } = useQuery({
    queryKey: ['approved-quotes', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          customer_name,
          total_amount,
          final_amount,
          status,
          created_at,
          quote_items (
            id,
            description,
            quantity,
            unit_price,
            total_price,
            width,
            height,
            company_product_id,
            product_template_id
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Calcular resumo do caixa (excluindo vendas canceladas)
  const cashSummary = useMemo(() => {
    const openingAmount = openCashRegister?.opening_amount || 0;
    const activeSales = todaySales.filter((s) => s.payment_status !== 'cancelled');
    const totalDinheiro = activeSales
      .filter((s) => s.payment_method === 'dinheiro')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCartao = activeSales
      .filter((s) => s.payment_method === 'cartao')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalPix = activeSales
      .filter((s) => s.payment_method === 'pix')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalVendas = totalDinheiro + totalCartao + totalPix;
    const expectedAmount = openingAmount + totalDinheiro;

    return {
      openingAmount,
      totalDinheiro,
      totalCartao,
      totalPix,
      totalVendas,
      expectedAmount,
    };
  }, [openCashRegister, todaySales]);

  // Mutation: Abrir caixa
  const openCashMutation = useMutation({
    mutationFn: async (openingAmount: number) => {
      if (!currentCompany?.id || !user?.id) throw new Error('Dados inválidos');
      
      const { data, error } = await supabase
        .from('cash_registers')
        .insert({
          company_id: currentCompany.id,
          opened_by: user.id,
          opening_amount: openingAmount,
          status: 'open',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Caixa aberto com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      setAbrirCaixaOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao abrir caixa: ${error.message}`);
    },
  });

  // Mutation: Fechar caixa
  const closeCashMutation = useMutation({
    mutationFn: async ({ actualAmount, notes }: { actualAmount: number; notes: string }) => {
      if (!openCashRegister?.id || !user?.id) throw new Error('Dados inválidos');
      
      const difference = actualAmount - cashSummary.expectedAmount;
      
      const { data, error } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          closing_amount: cashSummary.expectedAmount,
          actual_amount: actualAmount,
          difference,
          notes,
        })
        .eq('id', openCashRegister.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Caixa fechado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      setFecharCaixaOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao fechar caixa: ${error.message}`);
    },
  });

  // Mutation: Nova venda
  const newSaleMutation = useMutation({
    mutationFn: async (data: {
      items: VendaItem[];
      customerName: string;
      paymentMethod: 'dinheiro' | 'cartao' | 'pix';
      discountPercent: number;
      discountAmount: number;
      subtotal: number;
      total: number;
      quoteId?: string;
    }) => {
      if (!openCashRegister?.id || !currentCompany?.id || !user?.id) {
        throw new Error('Caixa não está aberto');
      }

      // Criar venda
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          company_id: currentCompany.id,
          cash_register_id: openCashRegister.id,
          customer_name: data.customerName || null,
          subtotal: data.subtotal,
          discount_percent: data.discountPercent,
          discount_amount: data.discountAmount,
          total_amount: data.total,
          payment_method: data.paymentMethod,
          payment_status: 'paid',
          sold_by: user.id,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Criar itens da venda
      const saleItems = data.items.map((item) => ({
        sale_id: sale.id,
        item_template_id: item.itemTemplateId || null,
        company_product_id: item.companyProductId || null,
        item_name: item.name,
        item_unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        width: item.width || null,
        height: item.height || null,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Mapa para acumular as quantidades a subtrair de cada item_template_id
      const stockDeductions: Map<string, number> = new Map();

      // Processar vendas de materiais diretos
      for (const item of data.items) {
        if (item.itemTemplateId && !item.isProduct) {
          const currentQty = stockDeductions.get(item.itemTemplateId) || 0;
          stockDeductions.set(item.itemTemplateId, currentQty + item.quantity);
        }
      }

      // Processar vendas de produtos - calcular componentes
      for (const item of data.items) {
        if (item.isProduct && item.width && item.height) {
          // Determinar o product_template_id: via productTemplateId direto OU via companyProductId
          let productTemplateId = item.productTemplateId;
          
          if (!productTemplateId && item.companyProductId) {
            const product = availableProducts.find(p => p.id === item.companyProductId);
            productTemplateId = product?.product_template_id;
          }
          
          if (!productTemplateId) continue;

          // Buscar os componentes do template do produto
          const { data: templateItems, error: templateError } = await supabase
            .from('product_template_items')
            .select(`
              item_template_id,
              quantity_formula,
              pieces_quantity,
              item_template:item_templates (
                id,
                name,
                unit
              )
            `)
            .eq('product_template_id', productTemplateId)
            .or(`company_id.is.null,company_id.eq.${currentCompany.id}`);

          if (templateError) {
            console.error('Erro ao buscar componentes:', templateError);
            continue;
          }

          // Calcular quantidade de cada componente baseado nas dimensões
          for (const templateItem of templateItems || []) {
            if (!templateItem.item_template_id || !templateItem.quantity_formula) continue;

            // Calcular quantidade usando a fórmula (item.quantity é a quantidade de produtos vendidos)
            const componentQty = calculateFormulaQuantity(
              templateItem.quantity_formula,
              item.width,
              item.height,
              templateItem.pieces_quantity || 1
            ) * item.quantity;

            if (componentQty > 0) {
              const currentQty = stockDeductions.get(templateItem.item_template_id) || 0;
              stockDeductions.set(templateItem.item_template_id, currentQty + componentQty);
            }
          }
        }
      }

      // Aplicar todas as deduções de estoque
      for (const [itemTemplateId, deductionQty] of stockDeductions) {
        const { data: stockItem } = await supabase
          .from('company_stock')
          .select('id, quantity')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .maybeSingle();

        if (stockItem) {
          await supabase
            .from('company_stock')
            .update({ quantity: Math.max(0, stockItem.quantity - deductionQty) })
            .eq('id', stockItem.id);
        }
      }

      // Marcar orçamento como faturado (se veio de um orçamento)
      if (data.quoteId) {
        await supabase
          .from('quotes')
          .update({ status: 'invoiced' })
          .eq('id', data.quoteId);
      }

      // Calculate commission for employees with commission enabled
      // Get seller employee (if user is linked to an employee)
      const { data: sellerEmployee } = await supabase
        .from('employees')
        .select('id, commission_enabled, commission_percent, commission_type')
        .eq('company_id', currentCompany.id)
        .eq('user_id', user.id)
        .eq('commission_enabled', true)
        .maybeSingle();

      if (sellerEmployee && sellerEmployee.commission_enabled) {
        // Calculate commission using the database function
        await supabase.rpc('calculate_sale_commission', {
          _sale_id: sale.id,
          _employee_id: sellerEmployee.id,
        });
      }

      return sale;
    },
    onSuccess: (sale) => {
      toast.success(`Venda #${String(sale.sale_number).padStart(4, '0')} registrada!`);
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['approved-quotes'] });
      setNovaVendaOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar venda: ${error.message}`);
    },
  });

  // Mutation: Cancelar venda
  const cancelSaleMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');

      // 1. Buscar itens da venda para restaurar estoque
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select(`
          id,
          item_template_id,
          company_product_id,
          quantity,
          width,
          height
        `)
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      // 2. Restaurar estoque dos itens
      const stockRestorations: Map<string, number> = new Map();

      // Restaurar materiais diretos
      for (const item of saleItems || []) {
        if (item.item_template_id && !item.company_product_id) {
          const currentQty = stockRestorations.get(item.item_template_id) || 0;
          stockRestorations.set(item.item_template_id, currentQty + item.quantity);
        }
      }

      // Restaurar componentes de produtos
      for (const item of saleItems || []) {
        if (item.company_product_id && item.width && item.height) {
          // Buscar product_template_id do company_product
          const { data: companyProduct } = await supabase
            .from('company_products')
            .select('product_template_id')
            .eq('id', item.company_product_id)
            .single();

          if (!companyProduct?.product_template_id) continue;

          // Buscar componentes do produto
          const { data: templateItems } = await supabase
            .from('product_template_items')
            .select('item_template_id, quantity_formula, pieces_quantity')
            .eq('product_template_id', companyProduct.product_template_id)
            .or(`company_id.is.null,company_id.eq.${currentCompany.id}`);

          for (const templateItem of templateItems || []) {
            if (!templateItem.item_template_id || !templateItem.quantity_formula) continue;

            const componentQty = calculateFormulaQuantity(
              templateItem.quantity_formula,
              item.width,
              item.height,
              templateItem.pieces_quantity || 1
            ) * item.quantity;

            if (componentQty > 0) {
              const currentQty = stockRestorations.get(templateItem.item_template_id) || 0;
              stockRestorations.set(templateItem.item_template_id, currentQty + componentQty);
            }
          }
        }
      }

      // Aplicar restaurações de estoque
      for (const [itemTemplateId, restoreQty] of stockRestorations) {
        const { data: stockItem } = await supabase
          .from('company_stock')
          .select('id, quantity')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .maybeSingle();

        if (stockItem) {
          await supabase
            .from('company_stock')
            .update({ quantity: stockItem.quantity + restoreQty })
            .eq('id', stockItem.id);
        }
      }

      // 3. Atualizar status da venda para cancelada
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .update({
          payment_status: 'cancelled',
          notes: reason ? `Cancelado: ${reason}` : 'Venda cancelada',
        })
        .eq('id', saleId)
        .select()
        .single();

      if (saleError) throw saleError;

      return sale;
    },
    onSuccess: (sale) => {
      toast.success(`Venda #${String(sale.sale_number).padStart(4, '0')} cancelada!`);
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      setCancelarVendaOpen(false);
      setSelectedSale(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar venda: ${error.message}`);
    },
  });

  const handleCancelSale = (sale: Sale) => {
    setSelectedSale(sale);
    setCancelarVendaOpen(true);
  };

  const handlePrintReceipt = async (sale: Sale) => {
    try {
      // Buscar dados completos da venda
      const { data: fullSale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', sale.id)
        .single();

      if (saleError) throw saleError;

      // Buscar itens da venda
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id);

      if (itemsError) throw itemsError;

      // Gerar PDF
      generateSalePdf(
        fullSale,
        saleItems || [],
        currentCompany ? {
          name: currentCompany.name,
          cnpj: currentCompany.cnpj,
          phone: currentCompany.phone,
          email: currentCompany.email,
          address: currentCompany.address,
        } : null
      );

      toast.success('Comprovante gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar comprovante:', error);
      toast.error('Erro ao gerar comprovante');
    }
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDetalhesVendaOpen(true);
  };

  const periodLabels: Record<PeriodFilter, string> = {
    today: 'Hoje',
    yesterday: 'Ontem',
    week: 'Esta Semana',
    month: 'Este Mês',
    all: 'Todas',
  };

  const isCashOpen = !!openCashRegister;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Caixa & Vendas
            </h1>
            {isCashOpen && openCashRegister && (
              <p className="text-sm text-muted-foreground mt-1">
                Caixa aberto em {format(new Date(openCashRegister.opened_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {isCashOpen ? (
              <>
                <Button variant="outline" onClick={() => setFecharCaixaOpen(true)}>
                  <Lock className="mr-2 h-4 w-4" />
                  Fechar Caixa
                </Button>
                <Button onClick={() => setNovaVendaOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Venda
                </Button>
              </>
            ) : (
              <Button onClick={() => setAbrirCaixaOpen(true)}>
                <Unlock className="mr-2 h-4 w-4" />
                Abrir Caixa
              </Button>
            )}
          </div>
        </div>

        {loadingCashRegister ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : isCashOpen ? (
          <>
            {/* Resumo */}
            <CaixaResumo
              openingAmount={cashSummary.openingAmount}
              totalDinheiro={cashSummary.totalDinheiro}
              totalCartao={cashSummary.totalCartao}
              totalPix={cashSummary.totalPix}
              totalVendas={cashSummary.totalVendas}
            />

            {/* Vendas do Dia */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">
                  Vendas do Caixa Atual
                </CardTitle>
                <Badge variant="secondary">
                  {todaySales.filter(s => s.payment_status !== 'cancelled').length} vendas
                </Badge>
              </CardHeader>
              <CardContent>
                <VendasTable 
                  sales={todaySales} 
                  onViewDetails={handleViewDetails}
                  onCancelSale={handleCancelSale}
                  onPrintReceipt={handlePrintReceipt}
                />
              </CardContent>
            </Card>

            {/* Histórico de Vendas com Filtro */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">
                  Histórico de Vendas
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="yesterday">Ontem</SelectItem>
                      <SelectItem value="week">Esta Semana</SelectItem>
                      <SelectItem value="month">Este Mês</SelectItem>
                      <SelectItem value="all">Todas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary">
                    {filteredSales.filter(s => s.payment_status !== 'cancelled').length} vendas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSales ? (
                  <div className="h-20 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : (
                  <VendasTable 
                    sales={filteredSales} 
                    onViewDetails={handleViewDetails}
                    onCancelSale={handleCancelSale}
                    onPrintReceipt={handlePrintReceipt}
                  />
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Caixa Fechado</h3>
              <p className="text-muted-foreground mb-4">
                Abra o caixa para começar a registrar vendas.
              </p>
              <Button onClick={() => setAbrirCaixaOpen(true)}>
                <Unlock className="mr-2 h-4 w-4" />
                Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <AbrirCaixaDialog
        open={abrirCaixaOpen}
        onOpenChange={setAbrirCaixaOpen}
        onConfirm={(amount) => openCashMutation.mutateAsync(amount)}
        isLoading={openCashMutation.isPending}
      />

      <FecharCaixaDialog
        open={fecharCaixaOpen}
        onOpenChange={setFecharCaixaOpen}
        onConfirm={(actualAmount, notes) => closeCashMutation.mutateAsync({ actualAmount, notes })}
        summary={cashSummary}
        isLoading={closeCashMutation.isPending}
      />

      <NovaVendaDialog
        open={novaVendaOpen}
        onOpenChange={setNovaVendaOpen}
        onConfirm={(data) => newSaleMutation.mutateAsync(data)}
        availableItems={availableItems}
        approvedQuotes={approvedQuotes}
        isLoading={newSaleMutation.isPending}
      />

      <CancelarVendaDialog
        open={cancelarVendaOpen}
        onOpenChange={setCancelarVendaOpen}
        sale={selectedSale}
        onConfirm={(saleId, reason) => cancelSaleMutation.mutateAsync({ saleId, reason })}
        isLoading={cancelSaleMutation.isPending}
      />

      <DetalhesVendaDialog
        open={detalhesVendaOpen}
        onOpenChange={setDetalhesVendaOpen}
        sale={selectedSale}
        onPrint={handlePrintReceipt}
      />
    </MainLayout>
  );
}
