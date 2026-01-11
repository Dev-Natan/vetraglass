import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Lock, Plus, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Parser } from 'expr-eval';

import { AbrirCaixaDialog } from '@/components/caixa/AbrirCaixaDialog';
import { FecharCaixaDialog } from '@/components/caixa/FecharCaixaDialog';
import { NovaVendaSheet } from '@/components/caixa/NovaVendaSheet';
import { CaixaResumo } from '@/components/caixa/CaixaResumo';
import { VendasTable } from '@/components/caixa/VendasTable';
import { VendaItem } from '@/components/caixa/VendaItemCard';

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

export default function CaixaVendas() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [abrirCaixaOpen, setAbrirCaixaOpen] = useState(false);
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false);
  const [novaVendaOpen, setNovaVendaOpen] = useState(false);

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

  // Buscar vendas do dia (se caixa aberto)
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

  // Buscar itens disponíveis com preço da empresa
  const { data: availableItems = [] } = useQuery({
    queryKey: ['available-items', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Buscar itens com preço da empresa
      const { data: itemPrices, error: pricesError } = await supabase
        .from('company_item_prices')
        .select(`
          price,
          item_template:item_templates (
            id,
            name,
            unit,
            type,
            linha
          )
        `)
        .eq('company_id', currentCompany.id);
      
      if (pricesError) throw pricesError;
      
      return (itemPrices || [])
        .filter((ip) => ip.item_template)
        .map((ip) => ({
          id: (ip.item_template as any).id,
          name: (ip.item_template as any).name,
          unit: (ip.item_template as any).unit,
          type: (ip.item_template as any).type,
          linha: (ip.item_template as any).linha,
          price: ip.price || 0,
        }));
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar produtos da empresa com product_template_id
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
            category
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

  // Calcular resumo do caixa
  const cashSummary = useMemo(() => {
    const openingAmount = openCashRegister?.opening_amount || 0;
    const totalDinheiro = todaySales
      .filter((s) => s.payment_method === 'dinheiro')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCartao = todaySales
      .filter((s) => s.payment_method === 'cartao')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalPix = todaySales
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
                  Vendas de Hoje
                </CardTitle>
                <Badge variant="secondary">{todaySales.length} vendas</Badge>
              </CardHeader>
              <CardContent>
                <VendasTable sales={todaySales} />
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

      <NovaVendaSheet
        open={novaVendaOpen}
        onOpenChange={setNovaVendaOpen}
        onConfirm={(data) => newSaleMutation.mutateAsync(data)}
        availableItems={availableItems}
        availableProducts={availableProducts}
        approvedQuotes={approvedQuotes}
        isLoading={newSaleMutation.isPending}
      />
    </MainLayout>
  );
}
